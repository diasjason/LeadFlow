import { NextResponse } from 'next/server'
import { LeadCategory, LeadSource } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getNextFollowUpDate } from '@/lib/workflow/engine'
import { parseRowsFromBuffer, prepareRowsForImport, validateRequiredMappings } from '@/lib/import/service'
import type { ColumnMapping } from '@/lib/import/types'

export const runtime = 'nodejs'

function toDbSource(source: string | null): LeadSource {
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

function toDbCategory(category: string | null): LeadCategory {
  switch (category) {
    case 'hot':
      return 'HOT'
    case 'cold':
      return 'COLD'
    default:
      return 'WARM'
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

  const created = await prisma.organization.create({
    data: { name: 'Default Organization' },
    select: { id: true },
  })

  return created.id
}

export async function POST(request: Request) {
  try {
    const dryRun = new URL(request.url).searchParams.get('dryRun') === 'true'
    const formData = await request.formData()
    const file = formData.get('file')
    const mappingsRaw = formData.get('mappings')
    const profileId = formData.get('profileId')
    const defaultSource = formData.get('defaultSource')
    const defaultCategory = formData.get('defaultCategory')
    const sendWhatsApp = formData.get('sendWhatsApp')
    const organizationIdInput = formData.get('organizationId')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 })
    }

    if (typeof mappingsRaw !== 'string') {
      return NextResponse.json({ error: 'mappings are required' }, { status: 400 })
    }

    let mappings: ColumnMapping[] = []
    try {
      const parsed = JSON.parse(mappingsRaw) as ColumnMapping[]
      mappings = Array.isArray(parsed) ? parsed : []
    } catch {
      return NextResponse.json({ error: 'invalid mappings payload' }, { status: 400 })
    }

    const required = validateRequiredMappings(mappings)
    if (!required.isValid) {
      return NextResponse.json(
        {
          error: 'Required mappings are missing',
          details: {
            hasName: required.hasName,
            hasPhone: required.hasPhone,
          },
        },
        { status: 400 }
      )
    }

    const bytes = await file.arrayBuffer()
    const parsedSheet = parseRowsFromBuffer(Buffer.from(bytes))

    const orgId = await getOrganizationId(
      typeof organizationIdInput === 'string' ? organizationIdInput : undefined
    )

    const prepared = prepareRowsForImport({
      rows: parsedSheet.rows,
      mappings,
      profileId: typeof profileId === 'string' ? profileId : 'client-test-data-v1',
      defaultSource: toDbSource(typeof defaultSource === 'string' ? defaultSource : null),
      defaultCategory: toDbCategory(typeof defaultCategory === 'string' ? defaultCategory : null),
    })

    const uniquePhones = [...new Set(prepared.leads.map((lead) => lead.phone))]
    const existingLeads = await prisma.lead.findMany({
      where: {
        organizationId: orgId,
        phone: { in: uniquePhones },
      },
      select: { phone: true },
    })

    const existingPhoneSet = new Set(existingLeads.map((lead) => lead.phone))
    const phoneSeenInBatch = new Set<string>()
    const acceptedLeads: typeof prepared.leads = []
    const skipped = [...prepared.skipped]

    prepared.leads.forEach((lead, index) => {
      if (existingPhoneSet.has(lead.phone)) {
        skipped.push({
          row: index + 1,
          reason: `Duplicate phone already exists: ${lead.phone}`,
        })
        return
      }

      if (phoneSeenInBatch.has(lead.phone)) {
        skipped.push({
          row: index + 1,
          reason: `Duplicate phone in file: ${lead.phone}`,
        })
        return
      }

      phoneSeenInBatch.add(lead.phone)
      acceptedLeads.push(lead)
    })

    const sendWelcome = typeof sendWhatsApp === 'string' && sendWhatsApp === 'true'

    if (dryRun) {
      return NextResponse.json({
        totalRows: parsedSheet.totalRows,
        imported: acceptedLeads.length,
        skipped: skipped.length,
      })
    }

    const mappingSnapshot = Object.fromEntries(
      mappings.map((mapping) => [mapping.excelColumn, mapping.leadFlowField])
    )

    const result = await prisma.$transaction(async (tx) => {
      const importBatch = await tx.importBatch.create({
        data: {
          fileName: file.name,
          columnMapping: mappingSnapshot,
          totalRows: parsedSheet.totalRows,
          imported: 0,
          skipped: 0,
          errors: 0,
          defaultSource: toDbSource(typeof defaultSource === 'string' ? defaultSource : null),
          defaultCategory: toDbCategory(typeof defaultCategory === 'string' ? defaultCategory : null),
          sendWelcome,
          organizationId: orgId,
        },
      })

      if (acceptedLeads.length > 0) {
        await tx.lead.createMany({
          data: acceptedLeads.map((lead) => ({
            name: lead.name,
            phone: lead.phone,
            email: lead.email,
            source: lead.source,
            category: lead.category,
            stage: 'NEW',
            attempts: 0,
            notes: lead.notes,
            metadata: {
              ...(lead.metadata ?? {}),
              whatsAppSent: sendWelcome,
            },
            nextFollowUpAt: getNextFollowUpDate(0),
            organizationId: orgId,
            importBatchId: importBatch.id,
          })),
        })
      }

      const skippedCount = skipped.length
      await tx.importBatch.update({
        where: { id: importBatch.id },
        data: {
          imported: acceptedLeads.length,
          skipped: skippedCount,
          errors: skippedCount,
          errorLog: skipped,
        },
      })

      return {
        importBatchId: importBatch.id,
        imported: acceptedLeads.length,
        skipped: skippedCount,
        totalRows: parsedSheet.totalRows,
      }
    })

    return NextResponse.json({
      success: true,
      ...result,
      whatsappQueued: sendWelcome ? result.imported : 0,
    })
  } catch (error) {
    console.error('Commit import error:', error)
    return NextResponse.json({ error: 'Failed to import file' }, { status: 500 })
  }
}
