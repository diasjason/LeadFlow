import { MessageChannel, MessageDirection } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { getMessageProvider } from '@/lib/messaging/provider'
import { getFollowUpTemplate } from '@/lib/messaging/templates'
import { prisma } from '@/lib/prisma'
import { getDueFollowUpsFilter, processFollowUp } from '@/lib/workflow/engine'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()
    const dueLeads = await prisma.lead.findMany({
      where: getDueFollowUpsFilter(now),
      include: {
        organization: true,
      },
      take: 100,
      orderBy: { nextFollowUpAt: 'asc' },
    })

    let processed = 0
    let messaged = 0
    let autoClosed = 0
    const errors: string[] = []

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

        if (sendResult.success) {
          messaged++
        }

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
      errors,
    })
  } catch (error) {
    console.error('Cron follow-up error:', error)
    return NextResponse.json({ error: 'Cron processing failed' }, { status: 500 })
  }
}
