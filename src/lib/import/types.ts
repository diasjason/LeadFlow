import type { LeadCategory, LeadSource } from '@prisma/client'

export type ImportField =
  | 'name'
  | 'phone'
  | 'email'
  | 'source'
  | 'category'
  | 'notes'
  | 'skip'

export interface ColumnMapping {
  excelColumn: string
  leadFlowField: ImportField
  confidence?: number
}

export interface ParsedSheet {
  sheetName: string
  columns: string[]
  rows: Record<string, string>[]
  totalRows: number
}

export interface PreviewSummary {
  totalRows: number
  validRows: number
  skippedRows: number
}

export interface ImportProfile {
  id: string
  label: string
  aliases: Partial<Record<ImportField, string[]>>
  sourceValueMap?: Record<string, LeadSource>
}

export interface PreviewResult {
  sheetName: string
  columns: string[]
  rows: Record<string, string>[]
  mappings: ColumnMapping[]
  summary: PreviewSummary
  profile: {
    id: string
    label: string
  }
}

export interface PreparedLead {
  name: string
  phone: string
  email: string | null
  notes: string | null
  source: LeadSource
  category: LeadCategory
  metadata: Record<string, unknown>
}
