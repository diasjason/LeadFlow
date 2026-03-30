import { MessageChannel, MessageDirection, MessageStatus } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { reactivateLead } from '@/lib/workflow/engine'

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

  const buttonText = (
    message.button?.text ?? message.interactive?.button_reply?.title ?? ''
  ).toLowerCase()

  if (
    buttonText.includes('schedule') ||
    buttonText.includes('visit') ||
    buttonText.includes('yes')
  ) {
    if (
      lead.stage !== 'INTERESTED' &&
      lead.stage !== 'VISIT_SCHEDULED' &&
      lead.stage !== 'CLOSED_WON'
    ) {
      await prisma.$transaction([
        prisma.lead.update({
          where: { id: lead.id },
          data: { stage: 'INTERESTED', category: 'HOT' },
        }),
        prisma.stageTransition.create({
          data: {
            leadId: lead.id,
            fromStage: lead.stage,
            toStage: 'INTERESTED',
            reason: 'auto_interested_from_whatsapp_reply',
          },
        }),
      ])
    }
  }

  if (buttonText.includes('not interested')) {
    await prisma.lead.update({
      where: { id: lead.id },
      data: { category: 'COLD' },
    })
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
