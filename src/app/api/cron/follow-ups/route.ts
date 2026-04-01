import { MessageChannel, MessageDirection } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { getMessageProvider } from '@/lib/messaging/provider'
import { getFollowUpTemplate } from '@/lib/messaging/templates'
import { prisma } from '@/lib/prisma'
import { getDueFollowUpsFilter, processFollowUp } from '@/lib/workflow/engine'
import { buildRealEstateAssistant } from '@/lib/vapi/vapi-assistant-templates'
import { getVapiProvider } from '@/lib/vapi/vapi-provider'

// ── How many WhatsApp follow-ups before switching to Vapi outbound ──
const WHATSAPP_ATTEMPTS_BEFORE_VAPI = 3
// ── Minutes to wait after CALL NOW message before triggering outbound ──
const CALL_NOW_TIMEOUT_MINUTES = 30

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()
    let vapiTriggered = 0
    let callNowTimeouts = 0
    const errors: string[] = []

    // ── 1. Check CALL NOW timeouts (30-min inbound window expired) ──
    const callNowTimeout = new Date(now.getTime() - CALL_NOW_TIMEOUT_MINUTES * 60 * 1000)

    const callNowLeads = await prisma.lead.findMany({
      where: {
        stage: 'INTERESTED',
        // We filter in JS after fetching — metadata JSON filtering varies by DB
      },
      include: { organization: true },
      take: 50,
    })

    for (const lead of callNowLeads) {
      try {
        const meta = (lead.metadata ?? {}) as Record<string, unknown>
        const callNowSentAt = meta.callNowSentAt ? new Date(meta.callNowSentAt as string) : null
        const lastInboundCallAt = meta.lastInboundCallAt
          ? new Date(meta.lastInboundCallAt as string)
          : null

        // Only process leads where CALL NOW was sent > 30 min ago
        if (!callNowSentAt || callNowSentAt > callNowTimeout) continue

        // Skip if they already called in after the CALL NOW message
        if (lastInboundCallAt && lastInboundCallAt > callNowSentAt) continue

        // Trigger outbound Vapi call
        const triggered = await triggerVapiOutbound(lead, lead.organization)
        if (triggered) {
          // Clear callNowSentAt so we don't retry
          await prisma.lead.update({
            where: { id: lead.id },
            data: {
              metadata: { ...meta, callNowSentAt: null },
            },
          })
          callNowTimeouts++
          vapiTriggered++
        }
      } catch (err) {
        errors.push(`[callNow] Lead ${lead.id}: ${String(err)}`)
      }
    }

    // ── 2. Regular WhatsApp follow-ups (+ switch to Vapi after threshold) ──
    const dueLeads = await prisma.lead.findMany({
      where: getDueFollowUpsFilter(now),
      include: { organization: true },
      take: 100,
      orderBy: { nextFollowUpAt: 'asc' },
    })

    let processed = 0
    let messaged = 0
    let autoClosed = 0

    for (const lead of dueLeads) {
      try {
        const result = processFollowUp({
          attempts: lead.attempts,
          maxAttempts: lead.maxAttempts,
          stage: lead.stage,
        })

        if (result.autoClosedReason) {
          await prisma.$transaction([
            prisma.lead.update({
              where: { id: lead.id },
              data: {
                attempts: result.attempts,
                stage: result.stage,
                category: result.category ?? undefined,
                nextFollowUpAt: null,
                lastContactAt: result.lastContactAt,
              },
            }),
            prisma.stageTransition.create({
              data: {
                leadId: lead.id,
                fromStage: lead.stage,
                toStage: result.stage,
                reason: result.autoClosedReason,
              },
            }),
            prisma.followUp.create({
              data: {
                leadId: lead.id,
                attemptNumber: result.attempts,
                status: 'AUTO_CLOSED',
                scheduledAt: now,
                completedAt: now,
                outcome: result.autoClosedReason,
                channel: MessageChannel.WHATSAPP,
              },
            }),
          ])

          autoClosed++
          processed++
          continue
        }

        // ── Switch to Vapi after N WhatsApp attempts ──
        if (result.attempts > WHATSAPP_ATTEMPTS_BEFORE_VAPI) {
          const triggered = await triggerVapiOutbound(lead, lead.organization)
          if (triggered) {
            await prisma.lead.update({
              where: { id: lead.id },
              data: {
                attempts: result.attempts,
                nextFollowUpAt: result.nextFollowUpAt,
                lastContactAt: result.lastContactAt,
              },
            })
            vapiTriggered++
            messaged++
          }
          processed++
          continue
        }

        // ── Standard WhatsApp follow-up ──
        if (!lead.organization.whatsappPhoneId || !lead.organization.whatsappToken) {
          errors.push(`Lead ${lead.id}: WhatsApp not configured`)
          processed++
          continue
        }

        const provider = getMessageProvider(lead.organization)
        const template = getFollowUpTemplate(result.attempts)
        const firstName = lead.name.trim().split(' ')[0] ?? 'there'

        const sendResult = await provider.sendMessage({
          to: lead.phone,
          body: '',
          templateId: template.name,
          templateParams: {
            '1': firstName,
            '2': lead.organization.name,
          },
        })

        await prisma.$transaction([
          prisma.lead.update({
            where: { id: lead.id },
            data: {
              attempts: result.attempts,
              stage: result.stage,
              nextFollowUpAt: result.nextFollowUpAt,
              lastContactAt: result.lastContactAt,
            },
          }),
          prisma.message.create({
            data: {
              leadId: lead.id,
              channel: MessageChannel.WHATSAPP,
              direction: MessageDirection.OUTBOUND,
              status: sendResult.success ? 'SENT' : 'FAILED',
              body: `Follow-up attempt ${result.attempts}`,
              templateId: template.name,
              externalId: sendResult.externalId ?? null,
            },
          }),
          prisma.followUp.create({
            data: {
              leadId: lead.id,
              attemptNumber: result.attempts,
              status: sendResult.success ? 'COMPLETED' : 'SCHEDULED',
              scheduledAt: now,
              completedAt: sendResult.success ? now : null,
              messageTemplate: template.name,
              channel: MessageChannel.WHATSAPP,
            },
          }),
          ...(lead.stage !== result.stage
            ? [
                prisma.stageTransition.create({
                  data: {
                    leadId: lead.id,
                    fromStage: lead.stage,
                    toStage: result.stage,
                    reason: `auto_followup_${result.attempts}`,
                  },
                }),
              ]
            : []),
        ])

        if (sendResult.success) messaged++

        processed++
      } catch (leadError) {
        errors.push(`Lead ${lead.id}: ${String(leadError)}`)
      }
    }

    return NextResponse.json({
      success: true,
      processed,
      dueLeads: dueLeads.length,
      messaged,
      autoClosed,
      callNowTimeouts,
      vapiTriggered,
      errors,
    })
  } catch (error) {
    console.error('Cron follow-up error:', error)
    return NextResponse.json({ error: 'Cron processing failed' }, { status: 500 })
  }
}

// ─── Vapi Outbound Helper ────────────────────

async function triggerVapiOutbound(
  lead: {
    id: string
    name: string
    phone: string
    metadata: unknown
    organizationId: string
  },
  organization: { name: string }
): Promise<boolean> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL
  if (!baseUrl) return false

  const meta = (lead.metadata ?? {}) as Record<string, unknown>

  const assistantConfig = buildRealEstateAssistant({
    leadName: lead.name,
    leadId: lead.id,
    orgName: organization.name,
    propertyType: typeof meta.propertyType === 'string' ? meta.propertyType : undefined,
    location: typeof meta.location === 'string' ? meta.location : undefined,
    serverBaseUrl: baseUrl,
  })

  try {
    const vapi = getVapiProvider()
    const result = await vapi.makeCall({
      toPhone: lead.phone,
      assistantConfig,
      metadata: { leadId: lead.id, orgName: organization.name },
    })

    if (result.success) {
      await prisma.message.create({
        data: {
          leadId: lead.id,
          channel: MessageChannel.PHONE,
          direction: MessageDirection.OUTBOUND,
          status: 'SENT',
          body: `📞 AI outbound call initiated (Vapi call ID: ${result.callId})`,
          externalId: result.callId ?? null,
        },
      })
      console.log(`[cron] Outbound call started: ${result.callId} → lead ${lead.id}`)
      return true
    }

    console.error(`[cron] Vapi call failed for lead ${lead.id}:`, result.error)
    return false
  } catch (err) {
    console.error(`[cron] Vapi exception for lead ${lead.id}:`, err)
    return false
  }
}
