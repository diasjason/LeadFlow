import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Records a broadcast campaign. Actual sending is handled by n8n.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const message = body.message ? String(body.message).trim() : ''
    const leadIds: string[] = Array.isArray(body.leadIds)
      ? body.leadIds.map((id: unknown) => String(id))
      : []

    if (!message) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 })
    }

    const organization = await prisma.organization.findFirst({
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    })

    if (!organization) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 })
    }

    const leads = await prisma.lead.findMany({
      where: {
        organizationId: organization.id,
        ...(leadIds.length > 0
          ? { id: { in: leadIds } }
          : { stage: 'CLOSED_LOST' }),
      },
      select: { id: true },
    })

    if (leads.length === 0) {
      return NextResponse.json({ error: 'No leads selected' }, { status: 404 })
    }

    const broadcast = await prisma.broadcast.create({
      data: {
        organizationId: organization.id,
        message,
        status: 'DRAFT',
        totalRecipients: leads.length,
        filterCriteria: leadIds.length > 0 ? { leadIds } : { stage: 'CLOSED_LOST' },
      },
    })

    return NextResponse.json({
      success: true,
      broadcastId: broadcast.id,
      total: leads.length,
    })
  } catch (error) {
    console.error('Broadcast error:', error)
    return NextResponse.json({ error: 'Failed to create broadcast' }, { status: 500 })
  }
}
