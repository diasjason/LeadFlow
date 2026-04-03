'use client'

import { useState, useCallback, useMemo } from 'react'
import {
  Upload,
  FileSpreadsheet,
  Check,
  AlertCircle,
  X,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { SOURCES, CATEGORIES, type Source, type Category } from '@/lib/types'
import { toast } from 'sonner'
import type { ColumnMapping, ImportField } from '@/lib/import/types'

interface ImportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImportComplete: (count: number) => void
}

type Step = 1 | 2 | 3

interface PreviewResponse {
  sheetName: string
  columns: string[]
  rows: Record<string, string>[]
  mappings: ColumnMapping[]
  summary: {
    totalRows: number
    validRows: number
    skippedRows: number
  }
  profile: {
    id: string
    label: string
  }
}

const FIELD_OPTIONS: { value: ImportField; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'phone', label: 'Phone' },
  { value: 'email', label: 'Email' },
  { value: 'source', label: 'Source' },
  { value: 'category', label: 'Category' },
  { value: 'notes', label: 'Notes' },
  { value: 'skip', label: 'Skip' },
]

function getMappedPreviewRow(row: Record<string, string>, mappings: ColumnMapping[]) {
  const valuesByField: Record<ImportField, string[]> = {
    name: [],
    phone: [],
    email: [],
    source: [],
    category: [],
    notes: [],
    skip: [],
  }

  mappings.forEach((mapping) => {
    const value = row[mapping.excelColumn]?.trim()
    if (!value) {
      return
    }

    valuesByField[mapping.leadFlowField].push(value)
  })

  return {
    name: valuesByField.name.join(' ').trim() || '-',
    phone: valuesByField.phone[0] ?? '-',
    email: valuesByField.email[0] ?? '-',
    notes: valuesByField.notes.join(' | ') || '-',
  }
}

export function ImportModal({
  open,
  onOpenChange,
  onImportComplete,
}: ImportModalProps) {
  const [step, setStep] = useState<Step>(1)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([])
  const [defaultSource, setDefaultSource] = useState<Source>('excel')
  const [defaultCategory, setDefaultCategory] = useState<Category>('warm')
  const [sendWhatsApp, setSendWhatsApp] = useState(true)
  const [isImporting, setIsImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [previewRows, setPreviewRows] = useState<Record<string, string>[]>([])
  const [previewColumns, setPreviewColumns] = useState<string[]>([])
  const [profileId, setProfileId] = useState('client-test-data-v1')
  const [profileLabel, setProfileLabel] = useState('Client 1 - Test Data')
  const [totalRows, setTotalRows] = useState(0)
  const [validRowsCount, setValidRowsCount] = useState(0)
  const [skippedCount, setSkippedCount] = useState(0)

  const resetState = () => {
    setStep(1)
    setSelectedFile(null)
    setColumnMappings([])
    setDefaultSource('excel')
    setDefaultCategory('warm')
    setSendWhatsApp(true)
    setImportProgress(0)
    setIsPreviewLoading(false)
    setPreviewRows([])
    setPreviewColumns([])
    setProfileId('client-test-data-v1')
    setProfileLabel('Client 1 - Test Data')
    setTotalRows(0)
    setValidRowsCount(0)
    setSkippedCount(0)
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const isValidFile = (file: File): boolean => {
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
    ]
    const validExtensions = ['.xlsx', '.xls', '.csv']

    return (
      validTypes.includes(file.type) ||
      validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext))
    )
  }

  const runPreview = async (file: File) => {
    setIsPreviewLoading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('defaultSource', defaultSource)
      formData.append('defaultCategory', defaultCategory)
      formData.append('profileId', profileId)

      const response = await fetch('/api/imports/preview', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Failed to preview import file')
      }

      const preview = (await response.json()) as PreviewResponse
      setColumnMappings(preview.mappings)
      setPreviewRows(preview.rows)
      setPreviewColumns(preview.columns)
      setProfileId(preview.profile.id)
      setProfileLabel(preview.profile.label)
      setTotalRows(preview.summary.totalRows)
      setValidRowsCount(preview.summary.validRows)
      setSkippedCount(preview.summary.skippedRows)
    } catch (error) {
      console.error(error)
      toast.error('Could not parse this file. Please check the format and retry.')
      setSelectedFile(null)
      setColumnMappings([])
      setPreviewRows([])
      setPreviewColumns([])
      setTotalRows(0)
      setValidRowsCount(0)
      setSkippedCount(0)
    } finally {
      setIsPreviewLoading(false)
    }
  }

  const processFile = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size exceeds 5MB limit')
      return
    }

    setSelectedFile(file)
    await runPreview(file)
  }

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]

      if (file && isValidFile(file)) {
        await processFile(file)
      } else {
        toast.error('Please upload a valid Excel or CSV file')
      }
    },
    [defaultCategory, defaultSource, profileId]
  )

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && isValidFile(file)) {
      await processFile(file)
    } else {
      toast.error('Please upload a valid Excel or CSV file')
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const updateMapping = async (index: number, field: ImportField) => {
    const newMappings = [...columnMappings]
    newMappings[index] = { ...newMappings[index], leadFlowField: field }
    setColumnMappings(newMappings)

    if (!selectedFile) {
      return
    }

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('mappings', JSON.stringify(newMappings))
      formData.append('profileId', profileId)
      formData.append('defaultSource', defaultSource)
      formData.append('defaultCategory', defaultCategory)

      const response = await fetch('/api/imports/commit?dryRun=true', {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        const body = (await response.json()) as { totalRows: number; imported: number; skipped: number }
        setTotalRows(body.totalRows)
        setValidRowsCount(body.imported)
        setSkippedCount(body.skipped)
      }
    } catch {
      // summary refresh is optional while editing mappings
    }
  }

  const requiredFieldsMapped = useMemo(() => {
    const hasName = columnMappings.some((m) => m.leadFlowField === 'name')
    const hasPhone = columnMappings.some((m) => m.leadFlowField === 'phone')

    return { hasName, hasPhone, isValid: hasName && hasPhone }
  }, [columnMappings])

  const mappedPreviewRows = useMemo(
    () => previewRows.map((row) => getMappedPreviewRow(row, columnMappings)),
    [previewRows, columnMappings]
  )

  const handleImport = async () => {
    if (!selectedFile) {
      return
    }

    try {
      setIsImporting(true)
      setImportProgress(15)

      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('mappings', JSON.stringify(columnMappings))
      formData.append('profileId', profileId)
      formData.append('defaultSource', defaultSource)
      formData.append('defaultCategory', defaultCategory)
      formData.append('sendWhatsApp', String(sendWhatsApp))

      const response = await fetch('/api/imports/commit', {
        method: 'POST',
        body: formData,
      })

      setImportProgress(80)

      if (!response.ok) {
        throw new Error('Failed to import leads')
      }

      const result = (await response.json()) as {
        imported: number
        skipped: number
        whatsappQueued: number
      }

      setImportProgress(100)
      toast.success(
        `Imported ${result.imported} leads. Skipped ${result.skipped}. ${
          sendWhatsApp ? `${result.whatsappQueued} WhatsApp messages queued.` : ''
        }`
      )
      onImportComplete(result.imported)
      handleClose()
    } catch (error) {
      console.error(error)
      toast.error('Import failed. Please verify mapping and try again.')
    } finally {
      setIsImporting(false)
      setImportProgress(0)
    }
  }

  const handleClose = () => {
    if (!isImporting) {
      resetState()
      onOpenChange(false)
    }
  }

  const renderStepIndicator = () => (
    <div className="mb-6 flex items-center justify-center gap-2">
      {[1, 2, 3].map((s) => (
        <div key={s} className="flex items-center">
          <div
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors',
              step >= s
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            )}
          >
            {step > s ? <Check className="h-4 w-4" /> : s}
          </div>
          {s < 3 && (
            <div
              className={cn(
                'mx-1 h-0.5 w-12',
                step > s ? 'bg-primary' : 'bg-muted'
              )}
            />
          )}
        </div>
      ))}
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden border-border bg-card sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Import Leads from Excel
          </DialogTitle>
        </DialogHeader>

        {renderStepIndicator()}

        <div className="flex-1 overflow-auto">
          {step === 1 && (
            <div className="space-y-4">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                  'rounded-lg border-2 border-dashed p-8 text-center transition-colors',
                  isDragging
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50',
                  selectedFile && 'border-success bg-success/5'
                )}
              >
                {selectedFile ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-success/20">
                      <FileSpreadsheet className="h-6 w-6 text-success" />
                    </div>
                    <p className="font-medium text-foreground">{selectedFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(selectedFile.size)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Auto profile: {profileLabel}
                    </p>
                    {isPreviewLoading && (
                      <p className="text-xs text-muted-foreground">Parsing file...</p>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedFile(null)
                        setColumnMappings([])
                        setPreviewRows([])
                        setPreviewColumns([])
                        setTotalRows(0)
                        setValidRowsCount(0)
                        setSkippedCount(0)
                      }}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="mr-1 h-4 w-4" />
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary">
                      <Upload className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="font-medium text-foreground">Drag and drop your file here</p>
                    <p className="text-sm text-muted-foreground">
                      or{' '}
                      <label className="cursor-pointer text-primary hover:underline">
                        click to browse
                        <input
                          type="file"
                          className="hidden"
                          accept=".xlsx,.xls,.csv"
                          onChange={handleFileSelect}
                        />
                      </label>
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Supports .xlsx, .xls, .csv (Max 5MB)
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h4 className="mb-2 text-sm font-medium">Preview (First 5 rows)</h4>
                <ScrollArea className="h-[140px] rounded-lg border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-secondary/50">
                        {previewColumns.map((col) => (
                          <TableHead key={col} className="whitespace-nowrap text-xs">
                            {col}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewRows.map((row, rowIndex) => (
                        <TableRow key={rowIndex}>
                          {previewColumns.map((column) => (
                            <TableCell
                              key={`${rowIndex}-${column}`}
                              className="whitespace-nowrap py-2 text-xs"
                            >
                              {row[column] || '-'}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>

              <div>
                <h4 className="mb-2 text-sm font-medium">Map Columns</h4>
                <div className="space-y-2">
                  {columnMappings.map((mapping, index) => (
                    <div
                      key={mapping.excelColumn}
                      className="flex items-center gap-3 rounded-lg bg-secondary/30 p-2"
                    >
                      <div className="flex-1 truncate text-sm">{mapping.excelColumn}</div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <Select
                        value={mapping.leadFlowField}
                        onValueChange={(v) => void updateMapping(index, v as ImportField)}
                      >
                        <SelectTrigger className="w-[160px] border-border bg-secondary">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FIELD_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {mapping.leadFlowField !== 'skip' && (
                        <Check className="h-4 w-4 shrink-0 text-success" />
                      )}
                    </div>
                  ))}
                </div>

                {!requiredFieldsMapped.isValid && (
                  <div className="mt-3 flex items-center gap-2 rounded-lg border border-warm/30 bg-warm/10 p-2">
                    <AlertCircle className="h-4 w-4 shrink-0 text-warm" />
                    <p className="text-sm text-warm">
                      Please map required fields: {!requiredFieldsMapped.hasName && 'Name'}
                      {!requiredFieldsMapped.hasName &&
                        !requiredFieldsMapped.hasPhone &&
                        ', '}
                      {!requiredFieldsMapped.hasPhone && 'Phone'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-secondary/50 p-4">
                <h4 className="mb-2 text-sm font-medium">Import Summary</h4>
                <div className="flex gap-6">
                  <div>
                    <p className="text-2xl font-bold text-foreground">{totalRows}</p>
                    <p className="text-xs text-muted-foreground">Total rows</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-success">{validRowsCount}</p>
                    <p className="text-xs text-muted-foreground">Ready to import</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-muted-foreground">{skippedCount}</p>
                    <p className="text-xs text-muted-foreground">Skipped</p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="mb-2 text-sm font-medium">Mapped Preview</h4>
                <ScrollArea className="h-[120px] rounded-lg border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-secondary/50">
                        <TableHead className="text-xs">Name</TableHead>
                        <TableHead className="text-xs">Phone</TableHead>
                        <TableHead className="text-xs">Email</TableHead>
                        <TableHead className="text-xs">Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mappedPreviewRows.map((row, i) => (
                        <TableRow key={i}>
                          <TableCell className="py-2 text-xs">{row.name}</TableCell>
                          <TableCell className="py-2 text-xs">{row.phone}</TableCell>
                          <TableCell className="py-2 text-xs">{row.email}</TableCell>
                          <TableCell className="py-2 text-xs">{row.notes}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>

              <div className="space-y-3 rounded-lg border border-border bg-secondary/50 p-4">
                <h4 className="text-sm font-medium">Import Options</h4>

                <div className="flex items-center justify-between">
                  <label className="text-sm">Default Source</label>
                  <Select value={defaultSource} onValueChange={(v) => setDefaultSource(v as Source)}>
                    <SelectTrigger className="w-[140px] border-border bg-secondary">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SOURCES.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-sm">Default Category</label>
                  <Select
                    value={defaultCategory}
                    onValueChange={(v) => setDefaultCategory(v as Category)}
                  >
                    <SelectTrigger className="w-[140px] border-border bg-secondary">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-sm">Send WhatsApp welcome message to all</label>
                  <Switch checked={sendWhatsApp} onCheckedChange={setSendWhatsApp} />
                </div>
              </div>

              {isImporting && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Importing leads...</span>
                    <span>{importProgress}%</span>
                  </div>
                  <Progress value={importProgress} className="h-2" />
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="mt-4">
          {step > 1 && (
            <Button
              variant="outline"
              onClick={() => setStep((step - 1) as Step)}
              disabled={isImporting || isPreviewLoading}
              className="mr-auto"
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back
            </Button>
          )}
          <Button variant="outline" onClick={handleClose} disabled={isImporting}>
            Cancel
          </Button>
          {step < 3 ? (
            <Button
              onClick={() => setStep((step + 1) as Step)}
              disabled={
                isPreviewLoading ||
                (step === 1 && !selectedFile) ||
                (step === 2 && !requiredFieldsMapped.isValid)
              }
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Next
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleImport}
              disabled={isImporting || validRowsCount === 0}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isImporting ? 'Importing...' : `Import ${validRowsCount} Leads`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
