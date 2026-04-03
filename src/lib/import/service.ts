import { LeadCategory, LeadSource } from '@prisma/client'
import * as XLSX from 'xlsx'
import { getImportProfile, normalize, scoreColumnMatch } from './profiles'
import type {
  ColumnMapping,
  ImportField,
  ParsedSheet,
  PreparedLead,
  PreviewResult,
  PreviewSummary,
} from './types'

const REQUIRED_FIELDS: ImportField[] = ['name', 'phone']

function normalizeCell(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value).trim()
}

function parseWorkbook(buffer: Buffer): ParsedSheet {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheetName = workbook.SheetNames[0] ?? 'Sheet1'
  const sheet = workbook.Sheets[sheetName]

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false,
  })

  const normalizedRows = rows.map((row) => {
    const result: Record<string, string> = {}
    for (const [key, value] of Object.entries(row)) {
      result[key] = normalizeCell(value)
    }
    return result
  })

  const initialColumns = new Set<string>()
  for (const row of normalizedRows) {
    for (const key of Object.keys(row)) {
      if (key.trim()) {
        initialColumns.add(key)
      }
    }
  }

  const columns = [...initialColumns].filter((column) => {
    if (column.toLowerCase().startsWith('__empty')) {
      return false
    }

    return normalizedRows.some((row) => normalizeCell(row[column]).length > 0)
  })

  const filteredRows = normalizedRows
    .map((row) => {
      const filtered: Record<string, string> = {}
      for (const column of columns) {
        filtered[column] = row[column] ?? ''
      }
      return filtered
    })
    .filter((row) => columns.some((column) => normalizeCell(row[column]).length > 0))

  return {
    sheetName,
    columns,
    rows: filteredRows,
    totalRows: filteredRows.length,
  }
}

function buildMappings(columns: string[], profileId?: string): { mappings: ColumnMapping[]; profile: { id: string; label: string } } {
  const profile = getImportProfile(profileId)

  const mappings = columns.map((column) => {
    const scored = (
      ['name', 'phone', 'email', 'source', 'category', 'notes', 'skip'] as ImportField[]
    ).map((field) => ({
      field,
      score: scoreColumnMatch(column, field, profile),
    }))

    scored.sort((a, b) => b.score - a.score)
    const best = scored[0]

    if (!best || best.score <= 0) {
      return {
        excelColumn: column,
        leadFlowField: 'skip' as ImportField,
        confidence: 0,
      }
    }

    return {
      excelColumn: column,
      leadFlowField: best.field,
      confidence: Number(best.score.toFixed(2)),
    }
  })

  return {
    mappings,
    profile: {
      id: profile.id,
      label: profile.label,
    },
  }
}

function normalizePhone(value: string): string | null {
  const digits = value.replace(/\D+/g, '')
  if (!digits) {
    return null
  }

  if (digits.length === 10) {
    return `+91${digits}`
  }

  if (digits.length === 12 && digits.startsWith('91')) {
    return `+${digits}`
  }

  if (digits.length >= 8 && value.trim().startsWith('+')) {
    return `+${digits}`
  }

  return null
}

function toLeadSource(value: string, profileId: string, defaultSource: LeadSource): LeadSource {
  const profile = getImportProfile(profileId)
  const normalized = normalize(value)

  if (!normalized) {
    return defaultSource
  }

  const mapped = profile.sourceValueMap?.[normalized]
  if (mapped) {
    return mapped
  }

  if (normalized.includes('facebook') || normalized.includes('meta')) {
    return 'FACEBOOK'
  }
  if (normalized.includes('instagram')) {
    return 'INSTAGRAM'
  }
  if (normalized.includes('refer')) {
    return 'REFERRAL'
  }

  return defaultSource
}

function toLeadCategory(value: string, defaultCategory: LeadCategory): LeadCategory {
  const normalized = normalize(value)

  if (normalized === 'hot') {
    return 'HOT'
  }
  if (normalized === 'cold') {
    return 'COLD'
  }
  if (normalized === 'warm') {
    return 'WARM'
  }

  return defaultCategory
}

function buildName(values: string[]): string {
  const cleaned = values.map((value) => value.trim()).filter(Boolean)
  return cleaned.join(' ').replace(/\s+/g, ' ').trim()
}

function buildNotes(values: string[]): string | null {
  const cleaned = values.map((value) => value.trim()).filter(Boolean)
  if (cleaned.length === 0) {
    return null
  }

  return cleaned.join(' | ')
}

function buildMappedValues(row: Record<string, string>, mappings: ColumnMapping[]) {
  const byField: Record<ImportField, string[]> = {
    name: [],
    phone: [],
    email: [],
    source: [],
    category: [],
    notes: [],
    skip: [],
  }

  for (const mapping of mappings) {
    const value = normalizeCell(row[mapping.excelColumn])
    if (!value) {
      continue
    }

    byField[mapping.leadFlowField].push(value)
  }

  return byField
}

export function validateRequiredMappings(mappings: ColumnMapping[]): {
  hasName: boolean
  hasPhone: boolean
  isValid: boolean
} {
  const mapped = new Set(mappings.map((mapping) => mapping.leadFlowField))
  const hasName = mapped.has('name')
  const hasPhone = mapped.has('phone')

  return {
    hasName,
    hasPhone,
    isValid: REQUIRED_FIELDS.every((field) => mapped.has(field)),
  }
}

export function prepareRowsForImport(params: {
  rows: Record<string, string>[]
  mappings: ColumnMapping[]
  profileId: string
  defaultSource: LeadSource
  defaultCategory: LeadCategory
}): { leads: PreparedLead[]; skipped: Array<{ row: number; reason: string }> } {
  const { rows, mappings, profileId, defaultSource, defaultCategory } = params
  const leads: PreparedLead[] = []
  const skipped: Array<{ row: number; reason: string }> = []

  rows.forEach((row, index) => {
    const mapped = buildMappedValues(row, mappings)

    const name = buildName(mapped.name)
    const phone = normalizePhone(mapped.phone[0] ?? '')

    if (!name) {
      skipped.push({ row: index + 1, reason: 'Missing name' })
      return
    }
    if (!phone) {
      skipped.push({ row: index + 1, reason: 'Invalid or missing phone' })
      return
    }

    const email = mapped.email[0]?.trim() || null
    const notes = buildNotes(mapped.notes)
    const source = toLeadSource(mapped.source[0] ?? '', profileId, defaultSource)
    const category = toLeadCategory(mapped.category[0] ?? '', defaultCategory)

    const unmapped: Record<string, string> = {}
    for (const [column, value] of Object.entries(row)) {
      const isMapped = mappings.some(
        (mapping) => mapping.excelColumn === column && mapping.leadFlowField !== 'skip'
      )

      if (!isMapped && value) {
        unmapped[column] = value
      }
    }

    leads.push({
      name,
      phone,
      email,
      notes,
      source,
      category,
      metadata: {
        import: {
          profileId,
          unmapped,
        },
      },
    })
  })

  return { leads, skipped }
}

export function buildImportPreview(params: {
  buffer: Buffer
  profileId?: string
  defaultSource?: LeadSource
  defaultCategory?: LeadCategory
}): PreviewResult {
  const parsed = parseWorkbook(params.buffer)
  const { mappings, profile } = buildMappings(parsed.columns, params.profileId)

  const { leads, skipped } = prepareRowsForImport({
    rows: parsed.rows,
    mappings,
    profileId: profile.id,
    defaultSource: params.defaultSource ?? 'EXCEL_IMPORT',
    defaultCategory: params.defaultCategory ?? 'WARM',
  })

  const summary: PreviewSummary = {
    totalRows: parsed.totalRows,
    validRows: leads.length,
    skippedRows: skipped.length,
  }

  return {
    sheetName: parsed.sheetName,
    columns: parsed.columns,
    rows: parsed.rows.slice(0, 5),
    mappings,
    summary,
    profile,
  }
}

export function parseRowsFromBuffer(buffer: Buffer): ParsedSheet {
  return parseWorkbook(buffer)
}
