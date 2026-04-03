import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const ORG_SELECT = {
  id: true,
  name: true,
  whatsappPhoneId: true,
  whatsappToken: true,
  whatsappBusinessId: true,
  vapiApiKey: true,
  vapiPhoneNumberId: true,
  vapiAssistantId: true,
  vapiInboundNumber: true,
  googleAccessToken: true,
  googleRefreshToken: true,
} as const

async function getOrCreateOrganization() {
  const existing = await prisma.organization.findFirst({
    select: ORG_SELECT,
    orderBy: { createdAt: 'asc' },
  })

  if (existing) return existing

  return prisma.organization.create({
    data: { name: 'Default Organization' },
    select: ORG_SELECT,
  })
}

export async function GET() {
  try {
    const organization = await getOrCreateOrganization()
    // Mask tokens — return boolean so UI can show "connected" state
    return NextResponse.json({
      ...organization,
      whatsappToken: organization.whatsappToken ? '••••••••' : null,
      vapiApiKey: organization.vapiApiKey ? '••••••••' : null,
      googleConnected: !!organization.googleRefreshToken,
      googleAccessToken: undefined,
      googleRefreshToken: undefined,
    })
  } catch (error) {
    console.error('Failed to load organization settings:', error)
    return NextResponse.json(
      { error: 'Failed to load organization settings' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()

    const organization = await getOrCreateOrganization()

    const name = body.name ? String(body.name).trim() : ''
    if (!name) {
      return NextResponse.json({ error: 'Organization name is required' }, { status: 400 })
    }

    // Preserve existing secrets if masked value sent back
    const isMasked = (v: unknown) => typeof v === 'string' && v === '••••••••'

    const updated = await prisma.organization.update({
      where: { id: organization.id },
      data: {
        name,
        // WhatsApp
        whatsappPhoneId: body.whatsappPhoneId
          ? String(body.whatsappPhoneId).trim()
          : null,
        whatsappBusinessId: body.whatsappBusinessId
          ? String(body.whatsappBusinessId).trim()
          : null,
        ...(!isMasked(body.whatsappToken)
          ? { whatsappToken: body.whatsappToken ? String(body.whatsappToken).trim() : null }
          : organization.whatsappToken
          ? {}
          : { whatsappToken: null }),
        // Vapi
        vapiPhoneNumberId: body.vapiPhoneNumberId
          ? String(body.vapiPhoneNumberId).trim()
          : null,
        vapiAssistantId: body.vapiAssistantId
          ? String(body.vapiAssistantId).trim()
          : null,
        vapiInboundNumber: body.vapiInboundNumber
          ? String(body.vapiInboundNumber).trim()
          : null,
        ...(!isMasked(body.vapiApiKey)
          ? { vapiApiKey: body.vapiApiKey ? String(body.vapiApiKey).trim() : null }
          : organization.vapiApiKey
          ? {}
          : { vapiApiKey: null }),
      },
      select: ORG_SELECT,
    })

    return NextResponse.json({
      ...updated,
      whatsappToken: updated.whatsappToken ? '••••••••' : null,
      vapiApiKey: updated.vapiApiKey ? '••••••••' : null,
      googleConnected: !!updated.googleRefreshToken,
      googleAccessToken: undefined,
      googleRefreshToken: undefined,
    })
  } catch (error) {
    console.error('Failed to update organization settings:', error)
    return NextResponse.json(
      { error: 'Failed to update organization settings' },
      { status: 500 }
    )
  }
}
