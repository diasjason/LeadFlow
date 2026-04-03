import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const ORG_SELECT = {
  id: true,
  name: true,
  phone: true,
  email: true,
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
      return NextResponse.json({ error: 'Organization name is required' }, { status: 400 })
    }

    const updated = await prisma.organization.update({
      where: { id: organization.id },
      data: {
        name,
        phone: body.phone ? String(body.phone).trim() : null,
        email: body.email ? String(body.email).trim() : null,
      },
      select: ORG_SELECT,
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
