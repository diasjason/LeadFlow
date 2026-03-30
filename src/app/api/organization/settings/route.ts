import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

async function getOrCreateOrganization() {
  const existing = await prisma.organization.findFirst({
    select: {
      id: true,
      name: true,
      whatsappPhoneId: true,
      whatsappToken: true,
      whatsappBusinessId: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  if (existing) {
    return existing
  }

  return prisma.organization.create({
    data: {
      name: 'Default Organization',
    },
    select: {
      id: true,
      name: true,
      whatsappPhoneId: true,
      whatsappToken: true,
      whatsappBusinessId: true,
    },
  })
}

export async function GET() {
  try {
    const organization = await getOrCreateOrganization()
    return NextResponse.json(organization)
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
      return NextResponse.json(
        { error: 'Organization name is required' },
        { status: 400 }
      )
    }

    const updated = await prisma.organization.update({
      where: { id: organization.id },
      data: {
        name,
        whatsappPhoneId: body.whatsappPhoneId
          ? String(body.whatsappPhoneId).trim()
          : null,
        whatsappToken: body.whatsappToken
          ? String(body.whatsappToken).trim()
          : null,
        whatsappBusinessId: body.whatsappBusinessId
          ? String(body.whatsappBusinessId).trim()
          : null,
      },
      select: {
        id: true,
        name: true,
        whatsappPhoneId: true,
        whatsappToken: true,
        whatsappBusinessId: true,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Failed to update organization settings:', error)
    return NextResponse.json(
      { error: 'Failed to update organization settings' },
      { status: 500 }
    )
  }
}
