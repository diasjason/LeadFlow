import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const ORG_SELECT = {
  id: true,
  name: true,
  phone: true,
  email: true,
  // WhatsApp (Meta Cloud API)
  whatsappPhoneId: true,
  whatsappBusinessId: true,
  whatsappToken: true,
  // Vapi AI voice
  vapiApiKey: true,
  vapiPhoneNumberId: true,
  vapiAssistantId: true,
  vapiInboundNumber: true,
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

/** Replace a value with a mask sentinel if it's already saved */
function maskSecret(value: string | null): string | null {
  return value ? '••••••••' : null
}

/** Return true if the client sent back our masked placeholder */
function isMasked(v: unknown): boolean {
  return typeof v === 'string' && v === '••••••••'
}

export async function GET() {
  try {
    const org = await getOrCreateOrganization()
    return NextResponse.json({
      ...org,
      whatsappToken: maskSecret(org.whatsappToken),
      vapiApiKey: maskSecret(org.vapiApiKey),
    })
  } catch (error) {
    console.error('Failed to load organization settings:', error)
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const org = await getOrCreateOrganization()

    const name = body.name ? String(body.name).trim() : ''
    if (!name) {
      return NextResponse.json({ error: 'Organization name is required' }, { status: 400 })
    }

    const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)

    // For secret fields: if the masked placeholder came back, keep existing value
    const resolveSecret = (incoming: unknown, existing: string | null) =>
      isMasked(incoming) ? existing : str(incoming)

    const updated = await prisma.organization.update({
      where: { id: org.id },
      data: {
        name,
        phone: str(body.phone),
        email: str(body.email),
        // WhatsApp
        whatsappPhoneId: str(body.whatsappPhoneId),
        whatsappBusinessId: str(body.whatsappBusinessId),
        whatsappToken: resolveSecret(body.whatsappToken, org.whatsappToken),
        // Vapi
        vapiApiKey: resolveSecret(body.vapiApiKey, org.vapiApiKey),
        vapiPhoneNumberId: str(body.vapiPhoneNumberId),
        vapiAssistantId: str(body.vapiAssistantId),
        vapiInboundNumber: str(body.vapiInboundNumber),
      },
      select: ORG_SELECT,
    })

    return NextResponse.json({
      ...updated,
      whatsappToken: maskSecret(updated.whatsappToken),
      vapiApiKey: maskSecret(updated.vapiApiKey),
    })
  } catch (error) {
    console.error('Failed to update organization settings:', error)
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }
}
