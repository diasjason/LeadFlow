// src/app/api/messages/webhook/route.ts
// ─────────────────────────────────────────────
// WHATSAPP WEBHOOK — v2 with Vapi integration
//
// Flow:
//   Customer replies → message saved → AI analyzes intent
//   → If interested: lead → HOT/INTERESTED, Vapi call triggered
//   → If not interested: lead → COLD
//   → Existing reactivation & button logic preserved
// ─────────────────────────────────────────────

import { MessageChannel, MessageDirection, MessageStatus } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { reactivateLead } from '@/lib/workflow/engine'
import { detectIntent } from '@/lib/vapi/ai-intent-detector'
import { buildRealEstateAssistant } from '@/lib/vapi/vapi-assistant-templates'
import { getVapiProvider } from '@/lib/vapi/vapi-provider'

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get('hub.mode')
  const token = request.nextUrl.searchParams.get('hub.verify_token')
  const challenge = request.nextUrl.searchParams.get('hub.challenge')

  if (
    mode === 'subscribe' &&
    token &&
    token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN
  ) {
    return new NextResponse(challenge ?? '', { status: 200 })
  }

  return NextResponse.json({ error: 'Verification failed' }, { status: 403 })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const entries = Array.isArray(body.entry) ? body.entry : []

    for (const entry of entries) {
      for (const change of entry?.changes ?? []) {
        const value = change?.value
        if (!value) continue

        for (const message of value.messages ?? []) {
          await handleIncomingMessage(message, value.metadata)
        }

        for (const status of value.statuses ?? []) {
          await handleStatusUpdate(status)
        }
      }
    }

    return NextResponse.json({ status: 'ok' })
  } catch (error) {
    console.error('Webhook processing error:', error)
    return NextResponse.json({ status: 'ok' })
  }
}

type MetaMessage = {
  id: string
  from: string
  timestamp: string
  text?: { body: string }
  button?: { text?: string }
  interactive?: { button_reply?: { title?: string } }
}

async function handleIncomingMessage(
  message: MetaMessage,
  metadata?: { phone_number_id?: string }
) {
  if (!metadata?.phone_number_id) return

  const organization = await prisma.organization.findFirst({
    where: { whatsappPhoneId: metadata.phone_number_id },
  })
  if (!organization) return

  const senderPhone = String(message.from ?? '')
  const lead = await prisma.lead.findFirst({
    where: {
      organizationId: organization.id,
      phone: {
        contains: senderPhone.slice(-10),
      },
    },
  })

  if (!lead) return

  const body =
    message.text?.body ??
    message.button?.text ??
    message.interactive?.button_reply?.title ??
    '[media]'

  // Save inbound message
  await prisma.message.create({
    data: {
      leadId: lead.id,
      channel: MessageChannel.WHATSAPP,
      direction: MessageDirection.INBOUND,
      status: MessageStatus.DELIVERED,
      body,
      externalId: message.id,
      deliveredAt: new Date(),
    },
  })

  await prisma.lead.update({
    where: { id: lead.id },
    data: { lastContactAt: new Date() },
  })

  // ── Re-activation: CLOSED_LOST → NEW ──
  if (lead.stage === 'CLOSED_LOST') {
    const reactivation = reactivateLead()

    await prisma.$transaction([
      prisma.lead.update({
        where: { id: lead.id },
        data: {
          stage: reactivation.stage,
          category: reactivation.category,
          attempts: reactivation.attempts,
          nextFollowUpAt: reactivation.nextFollowUpAt,
        },
      }),
      prisma.stageTransition.create({
        data: {
          leadId: lead.id,
          fromStage: 'CLOSED_LOST',
          toStage: reactivation.stage,
          reason: 'auto_reactivated_inbound_reply',
        },
      }),
    ])
  }

  // ── Button quick-replies ──
  const buttonText = (
    message.button?.text ?? message.interactive?.button_reply?.title ?? ''
  ).toLowerCase()

  if (buttonText.includes('not interested')) {
    await prisma.lead.update({
      where: { id: lead.id },
      data: { category: 'COLD' },
    })
    return
  }

  // Explicit interest via button → fast track to Vapi call
  const isExplicitInterest =
    buttonText.includes('schedule') ||
    buttonText.includes('visit') ||
    buttonText.includes('yes')

  if (isExplicitInterest) {
    await promoteToInterested(lead.id, lead.stage)
    await triggerVapiCall({ lead, organization, body, messageBody: body })
    return
  }

  // ── AI Intent Detection (text messages) ──
  const advancedStages = ['VISIT_SCHEDULED', 'VISIT_DONE', 'DOCS_COLLECTED', 'CLOSED_WON']
  if (advancedStages.includes(lead.stage)) return
  if (body === '[media]' || body.trim().length < 2) return

  try {
    const recentMessages = await prisma.message.findMany({
      where: { leadId: lead.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { body: true, direction: true },
    })

    const messageHistory = recentMessages
      .reverse()
      .map(m => `${m.direction === 'INBOUND' ? 'Lead' : 'Us'}: ${m.body}`)

    const intent = await detectIntent(body, {
      name: lead.name,
      previousMessages: messageHistory,
    })

    console.log(`[webhook] Intent for lead ${lead.id}:`, {
      interested: intent.interested,
      shouldTriggerCall: intent.shouldTriggerCall,
      confidence: intent.confidence,
      extractedData: intent.extractedData,
    })

    if (!intent.interested) {
      if (intent.confidence === 'HIGH') {
        await prisma.lead.update({
          where: { id: lead.id },
          data: { category: 'COLD' },
        })
      }
      return
    }

    // Save extracted property preferences to metadata
    const existingMetadata = (lead.metadata ?? {}) as Record<string, unknown>
    const freshExtractedData = {
      propertyType: intent.extractedData.propertyType,
      location: intent.extractedData.location,
      budget: intent.extractedData.budget,
    }

    if (
      intent.extractedData.propertyType ||
      intent.extractedData.location ||
      intent.extractedData.budget
    ) {
      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          metadata: {
            ...existingMetadata,
            ...freshExtractedData,
          },
        },
      })
    }

    // Promote to INTERESTED + HOT
    await promoteToInterested(lead.id, lead.stage)

    // Trigger Vapi call — pass freshExtractedData directly (not stale existingMetadata)
    if (intent.shouldTriggerCall) {
      await triggerVapiCall({
        lead,
        organization,
        body,
        messageBody: body,
        extractedData: freshExtractedData,
      })
    }
  } catch (intentError) {
    console.error('[webhook] Intent detection failed:', intentError)
    // Never throw — webhook must always return 200
  }
}

// ─── Helpers ─────────────────────────────────

async function promoteToInterested(leadId: string, currentStage: string) {
  const stagesToPromote = ['NEW', 'CONTACTED', 'FOLLOW_UP']
  if (!stagesToPromote.includes(currentStage)) return

  await prisma.$transaction([
    prisma.lead.update({
      where: { id: leadId },
      data: { stage: 'INTERESTED', category: 'HOT' },
    }),
    prisma.stageTransition.create({
      data: {
        leadId,
        fromStage: currentStage as never,
        toStage: 'INTERESTED',
        reason: 'auto_interested_from_whatsapp_reply',
      },
    }),
  ])
}

async function triggerVapiCall(params: {
  lead: {
    id: string
    name: string
    phone: string
    metadata?: Record<string, unknown>
  }
  organization: { name: string }
  body: string
  messageBody: string
  extractedData?: {
    propertyType?: string
    location?: string
  }
}) {
  const { lead, organization, extractedData } = params

  const meta = (lead.metadata ?? {}) as Record<string, unknown>
  const propertyType =
    extractedData?.propertyType ?? (meta.propertyType as string | undefined)
  const location =
    extractedData?.location ?? (meta.location as string | undefined)

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL
  if (!baseUrl) {
    console.error('[webhook] NEXT_PUBLIC_BASE_URL not set — cannot build Vapi tools URL')
    return
  }

  const assistantConfig = buildRealEstateAssistant({
    leadName: lead.name,
    leadId: lead.id,
    orgName: organization.name,
    propertyType,
    location,
    serverBaseUrl: baseUrl,
  })

  try {
    const vapi = getVapiProvider()
    const result = await vapi.makeCall({
      toPhone: lead.phone,
      assistantConfig,
      metadata: {
        leadId: lead.id,
        orgName: organization.name,
      },
    })

    if (result.success) {
      console.log(`[webhook] Vapi call initiated: ${result.callId} → lead ${lead.id}`)
      await prisma.message.create({
        data: {
          leadId: lead.id,
          channel: MessageChannel.PHONE,
          direction: MessageDirection.OUTBOUND,
          status: MessageStatus.SENT,
          body: `📞 AI call initiated (Vapi call ID: ${result.callId})`,
          externalId: result.callId ?? null,
        },
      })
    } else {
      console.error(`[webhook] Vapi call failed for lead ${lead.id}:`, result.error)
    }
  } catch (err) {
    console.error('[webhook] Vapi call exception:', err)
  }
}

type MetaStatus = {
  id: string
  status: string
}

async function handleStatusUpdate(statusUpdate: MetaStatus) {
  const statusMap: Record<string, MessageStatus> = {
    sent: MessageStatus.SENT,
    delivered: MessageStatus.DELIVERED,
    read: MessageStatus.READ,
    failed: MessageStatus.FAILED,
  }

  const mappedStatus = statusMap[statusUpdate.status]
  if (!mappedStatus) return

  const message = await prisma.message.findFirst({
    where: { externalId: statusUpdate.id },
    select: { id: true },
  })

  if (!message) return

  await prisma.message.update({
    where: { id: message.id },
    data: {
      status: mappedStatus,
      ...(mappedStatus === MessageStatus.DELIVERED ? { deliveredAt: new Date() } : {}),
      ...(mappedStatus === MessageStatus.READ ? { readAt: new Date() } : {}),
    },
  })
}
