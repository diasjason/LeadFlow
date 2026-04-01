import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { buildRealEstateAssistant } from '@/lib/vapi/vapi-assistant-templates'
import { getVapiProvider } from '@/lib/vapi/vapi-provider'

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const leadId = body?.leadId ? String(body.leadId) : ''

    if (!leadId) {
      return NextResponse.json({ error: 'leadId is required' }, { status: 400 })
    }

    const lead = await prisma.lead.findFirst({
      where: {
        id: leadId,
      },
      include: {
        organization: true,
      },
    })

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    const metadata = (lead.metadata ?? {}) as Record<string, unknown>

    const serverBaseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ??
      new URL(request.url).origin

    const assistantConfig = buildRealEstateAssistant({
      leadName: lead.name,
      leadId: lead.id,
      orgName: lead.organization.name,
      propertyType:
        typeof metadata.propertyType === 'string'
          ? metadata.propertyType
          : undefined,
      location:
        typeof metadata.location === 'string' ? metadata.location : undefined,
      serverBaseUrl,
    })

    const provider = getVapiProvider()
    const callResult = await provider.makeCall({
      toPhone: lead.phone,
      assistantConfig,
      metadata: {
        leadId: lead.id,
        organizationId: lead.organizationId,
      },
      serverBaseUrl,
    })

    if (!callResult.success) {
      return NextResponse.json(
        { error: callResult.error ?? 'Failed to start call' },
        { status: 502 }
      )
    }

    return NextResponse.json({
      success: true,
      callId: callResult.callId,
      leadId: lead.id,
    })
  } catch (error) {
    console.error('[vapi-call] Failed to start call:', error)
    return NextResponse.json({ error: 'Failed to start call' }, { status: 500 })
  }
}
