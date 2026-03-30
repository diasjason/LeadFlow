import {
  LeadCategory,
  LeadSource,
  LeadStage,
  MessageChannel,
  MessageDirection,
  type Lead,
} from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { getMessageProvider } from '@/lib/messaging/provider'
import { WHATSAPP_TEMPLATES } from '@/lib/messaging/templates'
import { prisma } from '@/lib/prisma'
import { getNextFollowUpDate } from '@/lib/workflow/engine'

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

function toUiLead(lead: Lead) {
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

async function getOrganizationId(preferredOrganizationId?: string) {
  if (preferredOrganizationId) {
    const found = await prisma.organization.findUnique({
      where: { id: preferredOrganizationId },
      select: { id: true },
    })

    if (found) {
      return found.id
    }
  }

  const existing = await prisma.organization.findFirst({
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  })
  if (existing) {
    return existing.id
  }

  const organization = await prisma.organization.create({
    data: {
      name: 'Default Organization',
    },
    select: { id: true },
  })

  return organization.id
}

export async function GET(request: NextRequest) {
  try {
    const organizationId = request.nextUrl.searchParams.get('organizationId')

    const leads = await prisma.lead.findMany({
      where: organizationId ? { organizationId } : undefined,
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(leads.map(toUiLead))
  } catch (error) {
    console.error('Failed to load leads:', error)
    return NextResponse.json({ error: 'Failed to load leads' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    if (!body.name || !body.phone) {
      return NextResponse.json(
        { error: 'name and phone are required' },
        { status: 400 }
      )
    }

    const organizationId = await getOrganizationId(
      body.organizationId ? String(body.organizationId) : undefined
    )

    const duplicateLead = await prisma.lead.findFirst({
      where: {
        organizationId,
        phone: String(body.phone),
      },
      select: { id: true },
    })

    if (duplicateLead) {
      return NextResponse.json(
        { error: 'Lead with this phone already exists in this organization' },
        { status: 409 }
      )
    }

    const created = await prisma.lead.create({
      data: {
        name: String(body.name),
        phone: String(body.phone),
        email: body.email ? String(body.email) : null,
        source: toDbSource(body.source as UiSource | undefined),
        category: toDbCategory(body.category as UiCategory | undefined),
        stage: 'NEW',
        attempts: Number(body.attempts ?? 0),
        notes: body.notes ? String(body.notes) : null,
        lastContactAt: body.lastContact ? new Date(body.lastContact) : null,
        nextFollowUpAt: getNextFollowUpDate(0),
        metadata: {
          whatsAppSent: false,
          documents: body.documents ?? defaultDocuments,
        },
        organizationId,
      },
    })

    let leadForResponse = created

    try {
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
      })

      if (organization?.whatsappPhoneId && organization?.whatsappToken) {
        const provider = getMessageProvider(organization)
        const firstName = String(body.name).trim().split(' ')[0] ?? 'there'

        const welcomeResult = await provider.sendMessage({
          to: String(body.phone),
          body: '',
          templateId: WHATSAPP_TEMPLATES.WELCOME.name,
          templateParams: {
            '1': firstName,
            '2': organization.name,
          },
        })

        await prisma.message.create({
          data: {
            leadId: created.id,
            channel: MessageChannel.WHATSAPP,
            direction: MessageDirection.OUTBOUND,
            status: welcomeResult.success ? 'SENT' : 'FAILED',
            body: `Welcome template ${WHATSAPP_TEMPLATES.WELCOME.name}`,
            templateId: WHATSAPP_TEMPLATES.WELCOME.name,
            externalId: welcomeResult.externalId ?? null,
          },
        })

        if (welcomeResult.success) {
          const createdMetadata = (created.metadata ?? {}) as Record<string, unknown>
          leadForResponse = await prisma.lead.update({
            where: { id: created.id },
            data: {
              stage: 'CONTACTED',
              attempts: 1,
              lastContactAt: new Date(),
              nextFollowUpAt: getNextFollowUpDate(1),
              metadata: {
                ...createdMetadata,
                whatsAppSent: true,
                documents:
                  typeof createdMetadata.documents === 'object' &&
                  createdMetadata.documents
                    ? createdMetadata.documents
                    : defaultDocuments,
              },
            },
          })

          await prisma.stageTransition.create({
            data: {
              leadId: created.id,
              fromStage: 'NEW',
              toStage: 'CONTACTED',
              reason: 'auto_welcome_whatsapp',
            },
          })
        }
      }
    } catch (welcomeError) {
      console.error('Failed to send Meta welcome message:', welcomeError)
    }

    return NextResponse.json(toUiLead(leadForResponse), { status: 201 })
  } catch (error) {
    console.error('Failed to create lead:', error)
    return NextResponse.json({ error: 'Failed to create lead' }, { status: 500 })
  }
}
