// src/app/api/vapi/webhook/route.ts
// ─────────────────────────────────────────────
// VAPI WEBHOOK HANDLER
//
// Handles events from Vapi during and after calls:
//
// 1. TOOL CALLS (mid-call):
//    - get_lead_info       → lead data + WhatsApp history
//    - book_appointment    → DB record + Google Calendar + WhatsApp confirmation
//    - update_lead_status  → save call outcome
//    - check_availability  → available visit slots
//
// 2. STATUS UPDATES:
//    - Inbound call detected → update lead metadata
//
// 3. END-OF-CALL REPORT:
//    - Saves transcript, summary, recording, cost to Call model
// ─────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMessageProvider } from '@/lib/messaging/provider'
import { createCalendarEvent } from '@/lib/calendar/google'
import { MessageChannel, MessageDirection, MessageStatus } from '@prisma/client'

// ─── Webhook Entry Point ──────────────────────

export async function POST(request: NextRequest) {
  try {
    const secret = request.headers.get('x-vapi-secret')
    if (
      process.env.VAPI_WEBHOOK_SECRET &&
      secret !== process.env.VAPI_WEBHOOK_SECRET
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { type } = body

    if (type === 'tool-calls') {
      return handleToolCall(body)
    }

    if (type === 'end-of-call-report') {
      return handleEndOfCallReport(body)
    }

    if (type === 'status-update') {
      return handleStatusUpdate(body)
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
          const result = await bookAppointment(args as never, body.call)
          results.push({ toolCallId: id, result: JSON.stringify(result) })
          break
        }
        case 'update_lead_status': {
          const result = await updateLeadStatus(args as never)
          results.push({ toolCallId: id, result: JSON.stringify(result) })
          break
        }
        case 'check_availability': {
          const result = handleCheckAvailability(args.date)
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

  if (!lead) return { error: 'Lead not found' }

  const metadata = (lead.metadata ?? {}) as Record<string, unknown>

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

async function bookAppointment(
  args: {
    lead_id: string
    visit_date: string
    visit_time: string
    property_type?: string
    location?: string
    notes?: string
  },
  callData?: { metadata?: Record<string, string> }
) {
  const lead = await prisma.lead.findUnique({
    where: { id: args.lead_id },
    include: { organization: true, assignedTo: true },
  })

  if (!lead) return { success: false, error: 'Lead not found' }

  const visitDateTime = new Date(`${args.visit_date}T${args.visit_time}:00`)
  if (isNaN(visitDateTime.getTime())) {
    return { success: false, error: 'Invalid date/time format' }
  }

  const existingMetadata = (lead.metadata ?? {}) as Record<string, unknown>

  // 1. Update lead in DB
  await prisma.$transaction([
    prisma.lead.update({
      where: { id: args.lead_id },
      data: {
        stage: 'VISIT_SCHEDULED',
        category: 'HOT',
        visitDate: visitDateTime,
        metadata: {
          ...existingMetadata,
          propertyType: args.property_type ?? (existingMetadata.propertyType as string | null) ?? null,
          location: args.location ?? (existingMetadata.location as string | null) ?? null,
          visitNotes: args.notes ?? null,
          callNowSentAt: null,
        } as never,
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

  // 2. Google Calendar event for the agent
  let calendarEventId: string | null = null
  try {
    const agentEmail = lead.assignedTo?.email ?? lead.organization?.email ?? null
    if (agentEmail && lead.organizationId) {
      const endTime = new Date(visitDateTime)
      endTime.setHours(endTime.getHours() + 1)

      calendarEventId = await createCalendarEvent({
        summary: `Site Visit: ${lead.name} — ${args.property_type ?? 'Property'}`,
        description: [
          `Lead: ${lead.name}`,
          `Phone: ${lead.phone}`,
          `Interest: ${args.property_type ?? 'Not specified'}`,
          `Location: ${args.location ?? 'Not specified'}`,
          `Budget: ${(existingMetadata.budget as string) ?? 'Not specified'}`,
          `Notes: ${args.notes ?? 'Booked via AI call'}`,
          '',
          'This visit was booked automatically during an AI qualification call.',
        ].join('\n'),
        startTime: visitDateTime.toISOString(),
        endTime: endTime.toISOString(),
        attendeeEmail: agentEmail,
        organizationId: lead.organizationId,
        location: args.location,
      })
    }
  } catch (calErr) {
    console.error('[vapi-webhook] Calendar event failed:', calErr)
  }

  // 3. WhatsApp confirmation to customer
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

  // 4. Schedule post-visit follow-up
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
    calendarEventCreated: !!calendarEventId,
    whatsappConfirmationSent: whatsappSent,
    message: `Visit booked for ${args.visit_date} at ${args.visit_time}.`,
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

// ─── check_availability ──────────────────────

function handleCheckAvailability(date?: string) {
  const targetDate = date ? new Date(date) : new Date()
  const dayName = targetDate.toLocaleDateString('en-IN', { weekday: 'long' })
  const dateStr = targetDate.toISOString().split('T')[0]

  // Standard business hours (Mon–Sat, 10am–6pm IST)
  // For production: integrate with Google Calendar free/busy API
  const isSunday = targetDate.getDay() === 0
  const availableSlots = isSunday
    ? []
    : ['10:00 AM', '11:00 AM', '12:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM']

  return {
    date: dateStr,
    day: dayName,
    availableSlots,
    note: isSunday
      ? 'No visits on Sundays. Please choose Monday to Saturday.'
      : 'Site visits available Monday to Saturday, 10am to 6pm IST.',
  }
}

// ─── Status Update Handler ───────────────────
// Called when an INBOUND call is received (lead called the Vapi number)

async function handleStatusUpdate(body: VapiStatusUpdateBody) {
  const { call, status } = body
  if (!call?.id) return NextResponse.json({ received: true })

  // Only care about inbound calls starting
  if (call.type !== 'inboundPhoneCall' || status !== 'ringing') {
    return NextResponse.json({ received: true })
  }

  const callerPhone = call.customer?.number
  if (!callerPhone) return NextResponse.json({ received: true })

  console.log(`[vapi-webhook] Inbound call from ${callerPhone}, call ${call.id}`)

  try {
    const cleaned = callerPhone.replace(/\D/g, '').slice(-10)
    const lead = await prisma.lead.findFirst({
      where: { phone: { contains: cleaned } },
      select: { id: true, metadata: true },
    })

    if (lead) {
      const existingMetadata = (lead.metadata ?? {}) as Record<string, unknown>
      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          metadata: {
            ...existingMetadata,
            lastInboundCallAt: new Date().toISOString(),
            lastInboundCallId: call.id,
          },
        },
      })

      // Log inbound call in message history
      await prisma.message.create({
        data: {
          leadId: lead.id,
          channel: MessageChannel.PHONE,
          direction: MessageDirection.INBOUND,
          status: MessageStatus.DELIVERED,
          body: `📞 Lead called inbound Vapi number (call ID: ${call.id})`,
          externalId: call.id,
        },
      })
    }
  } catch (err) {
    console.error('[vapi-webhook] Failed to handle inbound status:', err)
  }

  return NextResponse.json({ received: true })
}

// ─── End-of-Call Report ──────────────────────

async function handleEndOfCallReport(body: VapiEndOfCallBody) {
  const { call } = body
  if (!call?.id) return NextResponse.json({ received: true })

  const leadId = call.metadata?.leadId
  if (!leadId) {
    // Try looking up by phone number for inbound calls
    if (call.customer?.number) {
      await handleEndOfCallByPhone(call)
    }
    return NextResponse.json({ received: true })
  }

  console.log(`[vapi-webhook] End-of-call for lead ${leadId}, call ${call.id}`)

  try {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { organizationId: true },
    })
    if (!lead) return NextResponse.json({ received: true })

    // Save to Call model
    await prisma.call.create({
      data: {
        vapiCallId: call.id,
        status: 'ended',
        direction: call.type === 'inboundPhoneCall' ? 'inbound' : 'outbound',
        endedReason: call.endedReason ?? null,
        duration: call.durationSeconds ?? 0,
        cost: call.cost ?? 0,
        transcript: call.transcript ?? null,
        summary: call.summary ?? null,
        successEvaluation: call.analysis?.successEvaluation ?? null,
        structuredData: (call.analysis?.structuredData ?? undefined) as never,
        recordingUrl: call.recordingUrl ?? null,
        leadId,
        organizationId: lead.organizationId,
        endedAt: new Date(),
      },
    })

    // Also log as a message in the timeline
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

    console.log(`[vapi-webhook] Saved end-of-call report for lead ${leadId}`)
  } catch (err) {
    console.error('[vapi-webhook] Failed to save end-of-call report:', err)
  }

  return NextResponse.json({ received: true })
}

async function handleEndOfCallByPhone(call: VapiEndOfCallBody['call']) {
  try {
    const cleaned = (call.customer?.number ?? '').replace(/\D/g, '').slice(-10)
    if (!cleaned) return

    const lead = await prisma.lead.findFirst({
      where: { phone: { contains: cleaned } },
      select: { id: true, organizationId: true },
    })
    if (!lead) return

    await prisma.call.create({
      data: {
        vapiCallId: call.id,
        status: 'ended',
        direction: 'inbound',
        endedReason: call.endedReason ?? null,
        duration: call.durationSeconds ?? 0,
        cost: call.cost ?? 0,
        transcript: call.transcript ?? null,
        summary: call.summary ?? null,
        recordingUrl: call.recordingUrl ?? null,
        leadId: lead.id,
        organizationId: lead.organizationId,
        endedAt: new Date(),
      },
    })
  } catch (err) {
    console.error('[vapi-webhook] handleEndOfCallByPhone failed:', err)
  }
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
  call?: {
    id: string
    type?: string
    metadata?: Record<string, string>
  }
}

interface VapiStatusUpdateBody {
  type: 'status-update'
  status: string
  call: {
    id: string
    type?: string
    customer?: { number: string }
    metadata?: Record<string, string>
  }
}

interface VapiEndOfCallBody {
  type: 'end-of-call-report'
  call: {
    id: string
    type?: string
    status: string
    transcript?: string
    summary?: string
    recordingUrl?: string
    durationSeconds?: number
    endedReason?: string
    cost?: number
    customer?: { number: string }
    metadata?: Record<string, string>
    analysis?: {
      summary?: string
      successEvaluation?: string
      structuredData?: Record<string, unknown>
    }
  }
}

interface ToolResult {
  toolCallId: string
  result: string
}
