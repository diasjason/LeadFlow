import { LeadCategory, LeadSource, LeadStage, type Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const defaultDocuments = {
  aadhaar: false,
  pan: false,
  salarySlip: false,
  bankStatement: false,
  itReturns: false,
  agreement: false,
  photo: false,
  addressProof: false,
}

type UiSource = 'facebook' | 'instagram' | 'referral' | 'excel'
type UiCategory = 'hot' | 'warm' | 'cold'
type UiStage =
  | 'new'
  | 'contacted'
  | 'follow-up'
  | 'interested'
  | 'visit-scheduled'
  | 'visit-done'
  | 'docs-collected'
  | 'closed-won'
  | 'lost'

function toUiSource(source: LeadSource): UiSource {
  switch (source) {
    case 'FACEBOOK':
      return 'facebook'
    case 'INSTAGRAM':
      return 'instagram'
    case 'REFERRAL':
      return 'referral'
    default:
      return 'excel'
  }
}

function toDbSource(source: UiSource | undefined): LeadSource {
  switch (source) {
    case 'facebook':
      return 'FACEBOOK'
    case 'instagram':
      return 'INSTAGRAM'
    case 'referral':
      return 'REFERRAL'
    default:
      return 'EXCEL_IMPORT'
  }
}

function toUiCategory(category: LeadCategory): UiCategory {
  return category.toLowerCase() as UiCategory
}

function toDbCategory(category: UiCategory | undefined): LeadCategory {
  switch (category) {
    case 'hot':
      return 'HOT'
    case 'cold':
      return 'COLD'
    default:
      return 'WARM'
  }
}

function toUiStage(stage: LeadStage): UiStage {
  switch (stage) {
    case 'NEW':
      return 'new'
    case 'CONTACTED':
      return 'contacted'
    case 'FOLLOW_UP':
      return 'follow-up'
    case 'INTERESTED':
      return 'interested'
    case 'VISIT_SCHEDULED':
      return 'visit-scheduled'
    case 'VISIT_DONE':
      return 'visit-done'
    case 'DOCS_COLLECTED':
      return 'docs-collected'
    case 'CLOSED_WON':
      return 'closed-won'
    default:
      return 'lost'
  }
}

function toDbStage(stage: UiStage | undefined): LeadStage {
  switch (stage) {
    case 'new':
      return 'NEW'
    case 'contacted':
      return 'CONTACTED'
    case 'follow-up':
      return 'FOLLOW_UP'
    case 'interested':
      return 'INTERESTED'
    case 'visit-scheduled':
      return 'VISIT_SCHEDULED'
    case 'visit-done':
      return 'VISIT_DONE'
    case 'docs-collected':
      return 'DOCS_COLLECTED'
    case 'closed-won':
      return 'CLOSED_WON'
    default:
      return 'CLOSED_LOST'
  }
}

function toUiLead(lead: {
  id: string
  name: string
  phone: string
  email: string | null
  source: LeadSource
  category: LeadCategory
  stage: LeadStage
  attempts: number
  lastContactAt: Date | null
  nextFollowUpAt: Date | null
  notes: string | null
  metadata: Prisma.JsonValue | null
  createdAt: Date
}) {
  const metadata = (lead.metadata ?? {}) as Record<string, unknown>
  const documents =
    typeof metadata.documents === 'object' && metadata.documents
      ? { ...defaultDocuments, ...(metadata.documents as Record<string, boolean>) }
      : defaultDocuments

  return {
    id: lead.id,
    name: lead.name,
    phone: lead.phone,
    email: lead.email ?? undefined,
    source: toUiSource(lead.source),
    category: toUiCategory(lead.category),
    stage: toUiStage(lead.stage),
    attempts: lead.attempts,
    lastContact: lead.lastContactAt,
    nextFollowUp: lead.nextFollowUpAt,
    notes: lead.notes ?? undefined,
    whatsAppSent: Boolean(metadata.whatsAppSent ?? false),
    createdAt: lead.createdAt,
    documents,
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const body = await request.json()

    const existing = await prisma.lead.findUnique({ where: { id } })

    if (!existing) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    const existingMetadata = (existing.metadata ?? {}) as Record<string, unknown>

    const metadata = {
      ...existingMetadata,
      ...(body.whatsAppSent !== undefined
        ? { whatsAppSent: Boolean(body.whatsAppSent) }
        : {}),
      ...(body.documents ? { documents: body.documents } : {}),
    }

    const data: Prisma.LeadUpdateInput = {
      ...(body.name !== undefined ? { name: String(body.name) } : {}),
      ...(body.phone !== undefined ? { phone: String(body.phone) } : {}),
      ...(body.email !== undefined ? { email: body.email ? String(body.email) : null } : {}),
      ...(body.source !== undefined
        ? { source: toDbSource(body.source as UiSource) }
        : {}),
      ...(body.category !== undefined
        ? { category: toDbCategory(body.category as UiCategory) }
        : {}),
      ...(body.stage !== undefined ? { stage: toDbStage(body.stage as UiStage) } : {}),
      ...(body.attempts !== undefined ? { attempts: Number(body.attempts) } : {}),
      ...(body.lastContact !== undefined
        ? { lastContactAt: body.lastContact ? new Date(body.lastContact) : null }
        : {}),
      ...(body.nextFollowUp !== undefined
        ? { nextFollowUpAt: body.nextFollowUp ? new Date(body.nextFollowUp) : null }
        : {}),
      ...(body.notes !== undefined ? { notes: body.notes ? String(body.notes) : null } : {}),
      metadata,
      ...(body.stage === 'closed-won' || body.stage === 'lost'
        ? { closedAt: new Date() }
        : {}),
    }

    const updated = await prisma.lead.update({
      where: { id },
      data,
    })

    return NextResponse.json(toUiLead(updated))
  } catch (error) {
    console.error('Failed to update lead:', error)
    return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params

    await prisma.lead.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete lead:', error)
    return NextResponse.json({ error: 'Failed to delete lead' }, { status: 500 })
  }
}
