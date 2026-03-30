// src/app/api/vapi/webhook/route.ts
// ─────────────────────────────────────────────
// VAPI WEBHOOK HANDLER
//
// Handles two types of events from Vapi:
//
// 1. TOOL CALLS (mid-call):
//    - get_lead_info      → return lead data + WhatsApp history
//    - book_appointment   → create DB visit record + WhatsApp confirmation
//    - update_lead_status → save call outcome to DB
//
// 2. END-OF-CALL REPORT:
//    - Saves transcript, summary, recording URL to lead metadata
// ─────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMessageProvider } from '@/lib/messaging/provider'
import { MessageChannel, MessageDirection, MessageStatus } from '@prisma/client'

// ─── Webhook Entry Point ──────────────────────

export async function POST(request: NextRequest) {
  try {
    // Verify secret
    const secret = request.headers.get('x-vapi-secret')
    if (
      process.env.VAPI_WEBHOOK_SECRET &&
      secret !== process.env.VAPI_WEBHOOK_SECRET
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { type } = body

    // ── Tool call (mid-call) ──
    if (type === 'tool-calls') {
      return handleToolCall(body)
    }

    // ── End of call report ──
    if (type === 'end-of-call-report') {
      return handleEndOfCallReport(body)
    }

    // ── Status update (call started, ringing, etc.) ──
    if (type === 'status-update') {
      console.log(`[vapi-webhook] Call ${body.call?.id} status: ${body.status}`)
      return NextResponse.json({ received: true })
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('[vapi-webhook] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// ─── Tool Call Handler ───────────────────────

async function handleToolCall(body: VapiToolCallBody) {
  const results: ToolResult[] = []

  for (const toolCall of body.toolCallList ?? []) {
    const { id, function: fn } = toolCall
    const args = fn.arguments ?? {}

    console.log(`[vapi-webhook] Tool call: ${fn.name}`, args)

    try {
      switch (fn.name) {
        case 'get_lead_info': {
          const result = await getLeadInfo(args.lead_id)
          results.push({ toolCallId: id, result: JSON.stringify(result) })
          break
        }
        case 'book_appointment': {
          const result = await bookAppointment(args)
          results.push({ toolCallId: id, result: JSON.stringify(result) })
          break
        }
        case 'update_lead_status': {
          const result = await updateLeadStatus(args)
          results.push({ toolCallId: id, result: JSON.stringify(result) })
          break
        }
        default:
          results.push({
            toolCallId: id,
            result: JSON.stringify({ error: `Unknown tool: ${fn.name}` }),
          })
      }
    } catch (err) {
      console.error(`[vapi-webhook] Tool ${fn.name} failed:`, err)
      results.push({
        toolCallId: id,
        result: JSON.stringify({ error: 'Tool execution failed' }),
      })
    }
  }

  return NextResponse.json({ results })
}

// ─── get_lead_info ───────────────────────────

async function getLeadInfo(leadId: string) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
      organization: {
        select: { name: true },
      },
    },
  })

  if (!lead) {
    return { error: 'Lead not found' }
  }

  const metadata = (lead.metadata ?? {}) as Record<string, unknown>

  // Format recent WhatsApp history for the AI
  const recentMessages = lead.messages
    .reverse()
    .map(m => `[${m.direction === 'INBOUND' ? 'Lead' : 'Us'}]: ${m.body}`)
    .join('\n')

  return {
    id: lead.id,
    name: lead.name,
    phone: lead.phone,
    stage: lead.stage,
    category: lead.category,
    source: lead.source,
    notes: lead.notes,
    propertyType: metadata.propertyType ?? null,
    location: metadata.location ?? null,
    budget: metadata.budget ?? null,
    attempts: lead.attempts,
    recentMessages: recentMessages || 'No previous messages',
    organizationName: lead.organization?.name,
  }
}

// ─── book_appointment ────────────────────────

async function bookAppointment(args: {
  lead_id: string
  visit_date: string
  visit_time: string
  property_type?: string
  location?: string
  notes?: string
}) {
  const lead = await prisma.lead.findUnique({
    where: { id: args.lead_id },
    include: {
      organization: true,
    },
  })

  if (!lead) return { success: false, error: 'Lead not found' }

  const visitDateTime = new Date(`${args.visit_date}T${args.visit_time}:00`)

  // Update lead to VISIT_SCHEDULED
  const existingMetadata = (lead.metadata ?? {}) as Record<string, unknown>
  await prisma.$transaction([
    prisma.lead.update({
      where: { id: args.lead_id },
      data: {
        stage: 'VISIT_SCHEDULED',
        category: 'HOT',
        visitDate: visitDateTime,
        metadata: {
          ...existingMetadata,
          propertyType: args.property_type ?? existingMetadata.propertyType,
          location: args.location ?? existingMetadata.location,
        },
      },
    }),
    prisma.stageTransition.create({
      data: {
        leadId: args.lead_id,
        fromStage: lead.stage,
        toStage: 'VISIT_SCHEDULED',
        reason: 'booked_via_vapi_call',
      },
    }),
  ])

  // Send WhatsApp confirmation
  let whatsappSent = false
  try {
    if (lead.organization?.whatsappPhoneId && lead.organization?.whatsappToken) {
      const provider = getMessageProvider(lead.organization)
      const firstName = lead.name.split(' ')[0]

      const visitDateFormatted = visitDateTime.toLocaleDateString('en-IN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
      const visitTimeFormatted = visitDateTime.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })

      const confirmationMsg =
        `✅ *Site Visit Confirmed!*\n\n` +
        `Hi ${firstName}! Your site visit has been booked:\n\n` +
        `📅 *Date:* ${visitDateFormatted}\n` +
        `🕐 *Time:* ${visitTimeFormatted}\n` +
        (args.property_type ? `🏠 *Property:* ${args.property_type}\n` : '') +
        (args.location ? `📍 *Location:* ${args.location}\n` : '') +
        `\nOur team will meet you at the site. See you there! 🏡`

      const result = await provider.sendMessage({
        to: lead.phone,
        body: confirmationMsg,
      })

      if (result.success) {
        await prisma.message.create({
          data: {
            leadId: args.lead_id,
            channel: MessageChannel.WHATSAPP,
            direction: MessageDirection.OUTBOUND,
            status: MessageStatus.SENT,
            body: confirmationMsg,
            externalId: result.externalId ?? null,
          },
        })
        whatsappSent = true
      }
    }
  } catch (err) {
    console.error('[vapi-webhook] WhatsApp confirmation failed:', err)
  }

  // Create follow-up record for post-visit
  const dayAfterVisit = new Date(visitDateTime)
  dayAfterVisit.setDate(dayAfterVisit.getDate() + 1)

  await prisma.followUp.create({
    data: {
      leadId: args.lead_id,
      status: 'SCHEDULED',
      attemptNumber: lead.attempts + 1,
      scheduledAt: dayAfterVisit,
      channel: MessageChannel.WHATSAPP,
      messageTemplate: 'post_visit_followup',
      notes: `Follow up after site visit on ${args.visit_date}`,
    },
  })

  return {
    success: true,
    visitDate: args.visit_date,
    visitTime: args.visit_time,
    whatsappConfirmationSent: whatsappSent,
    message: `Visit booked for ${args.visit_date} at ${args.visit_time}. WhatsApp confirmation ${whatsappSent ? 'sent' : 'pending'}.`,
  }
}

// ─── update_lead_status ──────────────────────

async function updateLeadStatus(args: {
  lead_id: string
  stage: string
  category?: string
  notes?: string
  property_type?: string
  location?: string
  budget?: string
}) {
  const lead = await prisma.lead.findUnique({ where: { id: args.lead_id } })
  if (!lead) return { success: false, error: 'Lead not found' }

  const existingMetadata = (lead.metadata ?? {}) as Record<string, unknown>

  await prisma.$transaction([
    prisma.lead.update({
      where: { id: args.lead_id },
      data: {
        stage: args.stage as never,
        ...(args.category ? { category: args.category as never } : {}),
        ...(args.notes ? { notes: args.notes } : {}),
        lastContactAt: new Date(),
        metadata: {
          ...existingMetadata,
          ...(args.property_type ? { propertyType: args.property_type } : {}),
          ...(args.location ? { location: args.location } : {}),
          ...(args.budget ? { budget: args.budget } : {}),
        },
      },
    }),
    prisma.stageTransition.create({
      data: {
        leadId: args.lead_id,
        fromStage: lead.stage,
        toStage: args.stage as never,
        reason: 'updated_via_vapi_call',
      },
    }),
  ])

  return { success: true, stage: args.stage }
}

// ─── End-of-Call Report ──────────────────────

async function handleEndOfCallReport(body: VapiEndOfCallBody) {
  const { call } = body
  if (!call?.id) return NextResponse.json({ received: true })

  const leadId = call.metadata?.leadId
  if (!leadId) {
    console.warn('[vapi-webhook] End-of-call report missing leadId in metadata')
    return NextResponse.json({ received: true })
  }

  console.log(`[vapi-webhook] End-of-call for lead ${leadId}, call ${call.id}`)

  try {
    const existingMetadata = await prisma.lead
      .findUnique({ where: { id: leadId }, select: { metadata: true } })
      .then(l => (l?.metadata ?? {}) as Record<string, unknown>)

    // Save call transcript and summary to lead metadata
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        metadata: {
          ...existingMetadata,
          lastCallId: call.id,
          lastCallTranscript: call.transcript ?? null,
          lastCallSummary: call.summary ?? null,
          lastCallRecordingUrl: call.recordingUrl ?? null,
          lastCallDurationSeconds: call.durationSeconds ?? null,
          lastCallEndedReason: call.endedReason ?? null,
          lastCallAt: new Date().toISOString(),
        },
      },
    })

    // Log as a message in the conversation
    if (call.summary || call.transcript) {
      await prisma.message.create({
        data: {
          leadId,
          channel: MessageChannel.PHONE,
          direction: MessageDirection.OUTBOUND,
          status: MessageStatus.DELIVERED,
          body: call.summary
            ? `📞 Call summary: ${call.summary}`
            : `📞 Call completed (${call.durationSeconds ?? 0}s)`,
          externalId: call.id,
        },
      })
    }

    console.log(`[vapi-webhook] Saved end-of-call report for lead ${leadId}`)
  } catch (err) {
    console.error('[vapi-webhook] Failed to save end-of-call report:', err)
  }

  return NextResponse.json({ received: true })
}

// ─── Types ───────────────────────────────────

interface VapiToolCallBody {
  type: 'tool-calls'
  toolCallList: Array<{
    id: string
    type: string
    function: {
      name: string
      arguments: Record<string, string>
    }
  }>
  call?: { id: string; metadata?: Record<string, string> }
}

interface VapiEndOfCallBody {
  type: 'end-of-call-report'
  call: {
    id: string
    status: string
    transcript?: string
    summary?: string
    recordingUrl?: string
    durationSeconds?: number
    endedReason?: string
    metadata?: Record<string, string>
  }
}

interface ToolResult {
  toolCallId: string
  result: string
}
