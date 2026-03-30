import { BroadcastStatus, MessageChannel, MessageDirection } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { getMessageProvider } from '@/lib/messaging/provider'
import { WHATSAPP_TEMPLATES } from '@/lib/messaging/templates'
import { prisma } from '@/lib/prisma'

async function getOrganizationId(preferredOrganizationId?: string) {
  if (preferredOrganizationId) {
    const found = await prisma.organization.findUnique({
      where: { id: preferredOrganizationId },
      select: { id: true },
    })

    if (found) return found.id
  }

  const existing = await prisma.organization.findFirst({
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  })

  if (!existing) {
    throw new Error('No organization found')
  }

  return existing.id
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const organizationId = await getOrganizationId(
      body.organizationId ? String(body.organizationId) : undefined
    )

    const message = body.message ? String(body.message).trim() : ''
    const leadIds = Array.isArray(body.leadIds)
      ? body.leadIds.map((id: unknown) => String(id))
      : []

    if (!message) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 })
    }

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
    })

    if (!organization?.whatsappPhoneId || !organization.whatsappToken) {
      return NextResponse.json(
        { error: 'WhatsApp is not configured for this organization' },
        { status: 400 }
      )
    }

    const leads = await prisma.lead.findMany({
      where: {
        organizationId,
        ...(leadIds.length > 0
          ? { id: { in: leadIds } }
          : { stage: 'CLOSED_LOST' }),
      },
      select: {
        id: true,
        name: true,
        phone: true,
      },
    })

    if (leads.length === 0) {
      return NextResponse.json({ error: 'No leads selected' }, { status: 404 })
    }

    const broadcast = await prisma.broadcast.create({
      data: {
        organizationId,
        message,
        channel: MessageChannel.WHATSAPP,
        status: BroadcastStatus.SENDING,
        totalRecipients: leads.length,
        filterCriteria: leadIds.length > 0 ? { leadIds } : { stage: 'CLOSED_LOST' },
      },
    })

    const provider = getMessageProvider(organization)
    const result = await provider.sendBroadcast({
      recipients: leads.map((lead) => ({
        to: lead.phone,
        name: lead.name,
        leadId: lead.id,
      })),
      body: message,
      templateId: WHATSAPP_TEMPLATES.REMARKETING.name,
      templateParams: {
        '2': message,
      },
    })

    await prisma.message.createMany({
      data: result.results.map((item) => ({
        leadId: item.leadId,
        channel: MessageChannel.WHATSAPP,
        direction: MessageDirection.OUTBOUND,
        status: item.success ? 'SENT' : 'FAILED',
        body: `Broadcast: ${message.slice(0, 120)}`,
        templateId: WHATSAPP_TEMPLATES.REMARKETING.name,
        externalId: item.externalId ?? null,
      })),
    })

    await prisma.broadcast.update({
      where: { id: broadcast.id },
      data: {
        status: BroadcastStatus.COMPLETED,
        sent: result.sent,
        failed: result.failed,
        completedAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      broadcastId: broadcast.id,
      total: result.total,
      sent: result.sent,
      failed: result.failed,
    })
  } catch (error) {
    console.error('Broadcast error:', error)
    return NextResponse.json({ error: 'Broadcast failed' }, { status: 500 })
  }
}
