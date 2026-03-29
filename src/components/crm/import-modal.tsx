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

interface ImportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImportComplete: (count: number) => void
}

type Step = 1 | 2 | 3

type LeadFlowField = 'name' | 'phone' | 'email' | 'source' | 'category' | 'notes' | 'skip'

interface ColumnMapping {
  excelColumn: string
  leadFlowField: LeadFlowField
}

// Mock data for demonstration
const MOCK_EXCEL_COLUMNS = ['Full Name', 'Mobile Number', 'Email Address', 'City', 'Remarks']
const MOCK_EXCEL_DATA = [
  ['Rahul Verma', '+91 99887 76655', 'rahul@email.com', 'Mumbai', 'Interested in 2BHK'],
  ['Anita Desai', '+91 88776 65544', 'anita.d@gmail.com', 'Pune', 'Budget: 80L'],
  ['Kiran Rao', '+91 77665 54433', '', 'Bangalore', 'Looking for investment'],
  ['Suresh Menon', '+91 66554 43322', 'suresh.m@company.com', 'Chennai', ''],
  ['Pooja Shah', '+91 55443 32211', 'pooja.shah@outlook.com', 'Hyderabad', 'Referred by Amit'],
]

const FIELD_OPTIONS: { value: LeadFlowField; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'phone', label: 'Phone' },
  { value: 'email', label: 'Email' },
  { value: 'source', label: 'Source' },
  { value: 'category', label: 'Category' },
  { value: 'notes', label: 'Notes' },
  { value: 'skip', label: 'Skip' },
]

const autoMapColumn = (columnName: string): LeadFlowField => {
  const lower = columnName.toLowerCase()
  if (lower.includes('name') || lower.includes('full')) return 'name'
  if (lower.includes('phone') || lower.includes('mobile') || lower.includes('contact')) return 'phone'
  if (lower.includes('email') || lower.includes('mail')) return 'email'
  if (lower.includes('note') || lower.includes('remark') || lower.includes('comment')) return 'notes'
  return 'skip'
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

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && isValidFile(file)) {
      processFile(file)
    } else {
      toast.error('Please upload a valid Excel or CSV file')
    }
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && isValidFile(file)) {
      processFile(file)
    } else {
      toast.error('Please upload a valid Excel or CSV file')
    }
  }

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

  const processFile = (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size exceeds 5MB limit')
      return
    }
    setSelectedFile(file)
    // Initialize column mappings with auto-detection
    const mappings = MOCK_EXCEL_COLUMNS.map((col) => ({
      excelColumn: col,
      leadFlowField: autoMapColumn(col),
    }))
    setColumnMappings(mappings)
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const updateMapping = (index: number, field: LeadFlowField) => {
    const newMappings = [...columnMappings]
    newMappings[index] = { ...newMappings[index], leadFlowField: field }
    setColumnMappings(newMappings)
  }

  const requiredFieldsMapped = useMemo(() => {
    const hasName = columnMappings.some((m) => m.leadFlowField === 'name')
    const hasPhone = columnMappings.some((m) => m.leadFlowField === 'phone')
    return { hasName, hasPhone, isValid: hasName && hasPhone }
  }, [columnMappings])

  const validLeadsCount = useMemo(() => {
    // In real implementation, this would check actual data
    return MOCK_EXCEL_DATA.length
  }, [])

  const skippedCount = 0 // Mock value

  const handleImport = async () => {
    setIsImporting(true)
    setImportProgress(0)

    // Simulate import progress
    for (let i = 0; i <= 100; i += 10) {
      await new Promise((resolve) => setTimeout(resolve, 150))
      setImportProgress(i)
    }

    setIsImporting(false)
    toast.success(
      `Successfully imported ${validLeadsCount} leads. ${
        sendWhatsApp ? `${validLeadsCount} WhatsApp messages queued.` : ''
      }`
    )
    onImportComplete(validLeadsCount)
    handleClose()
  }

  const handleClose = () => {
    if (!isImporting) {
      setStep(1)
      setSelectedFile(null)
      setColumnMappings([])
      setDefaultSource('excel')
      setDefaultCategory('warm')
      setSendWhatsApp(true)
      setImportProgress(0)
      onOpenChange(false)
    }
  }

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-6">
      {[1, 2, 3].map((s) => (
        <div key={s} className="flex items-center">
          <div
            className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
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
                'w-12 h-0.5 mx-1',
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
      <DialogContent className="sm:max-w-[700px] bg-card border-border max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Import Leads from Excel
          </DialogTitle>
        </DialogHeader>

        {renderStepIndicator()}

        <div className="flex-1 overflow-auto">
          {/* Step 1: Upload */}
          {step === 1 && (
            <div className="space-y-4">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                  'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
                  isDragging
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50',
                  selectedFile && 'border-success bg-success/5'
                )}
              >
                {selectedFile ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-lg bg-success/20 flex items-center justify-center">
                      <FileSpreadsheet className="h-6 w-6 text-success" />
                    </div>
                    <p className="font-medium text-foreground">
                      {selectedFile.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(selectedFile.size)}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedFile(null)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center">
                      <Upload className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="font-medium text-foreground">
                      Drag and drop your file here
                    </p>
                    <p className="text-sm text-muted-foreground">
                      or{' '}
                      <label className="text-primary cursor-pointer hover:underline">
                        click to browse
                        <input
                          type="file"
                          className="hidden"
                          accept=".xlsx,.xls,.csv"
                          onChange={handleFileSelect}
                        />
                      </label>
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Supports .xlsx, .xls, .csv (Max 5MB)
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Column Mapping */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium mb-2">Preview (First 5 rows)</h4>
                <ScrollArea className="h-[140px] rounded-lg border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-secondary/50">
                        {MOCK_EXCEL_COLUMNS.map((col, i) => (
                          <TableHead key={i} className="text-xs whitespace-nowrap">
                            {col}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {MOCK_EXCEL_DATA.map((row, i) => (
                        <TableRow key={i}>
                          {row.map((cell, j) => (
                            <TableCell
                              key={j}
                              className="text-xs py-2 whitespace-nowrap"
                            >
                              {cell || '-'}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>

              <div>
                <h4 className="text-sm font-medium mb-2">Map Columns</h4>
                <div className="space-y-2">
                  {columnMappings.map((mapping, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 p-2 rounded-lg bg-secondary/30"
                    >
                      <div className="flex-1 text-sm truncate">
                        {mapping.excelColumn}
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      <Select
                        value={mapping.leadFlowField}
                        onValueChange={(v) => updateMapping(index, v as LeadFlowField)}
                      >
                        <SelectTrigger className="w-[140px] bg-secondary border-border">
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
                        <Check className="h-4 w-4 text-success shrink-0" />
                      )}
                    </div>
                  ))}
                </div>

                {!requiredFieldsMapped.isValid && (
                  <div className="flex items-center gap-2 mt-3 p-2 rounded-lg bg-warm/10 border border-warm/30">
                    <AlertCircle className="h-4 w-4 text-warm shrink-0" />
                    <p className="text-sm text-warm">
                      Please map required fields:{' '}
                      {!requiredFieldsMapped.hasName && 'Name'}
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

          {/* Step 3: Review & Import */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-secondary/50 border border-border">
                <h4 className="text-sm font-medium mb-2">Import Summary</h4>
                <div className="flex gap-4">
                  <div>
                    <p className="text-2xl font-bold text-success">
                      {validLeadsCount}
                    </p>
                    <p className="text-xs text-muted-foreground">Ready to import</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-muted-foreground">
                      {skippedCount}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Skipped (missing required)
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium mb-2">Preview</h4>
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
                      {MOCK_EXCEL_DATA.map((row, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs py-2">{row[0]}</TableCell>
                          <TableCell className="text-xs py-2">{row[1]}</TableCell>
                          <TableCell className="text-xs py-2">
                            {row[2] || '-'}
                          </TableCell>
                          <TableCell className="text-xs py-2">
                            {row[4] || '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>

              <div className="space-y-3 p-4 rounded-lg bg-secondary/50 border border-border">
                <h4 className="text-sm font-medium">Import Options</h4>

                <div className="flex items-center justify-between">
                  <label className="text-sm">Default Source</label>
                  <Select
                    value={defaultSource}
                    onValueChange={(v) => setDefaultSource(v as Source)}
                  >
                    <SelectTrigger className="w-[140px] bg-secondary border-border">
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
                    <SelectTrigger className="w-[140px] bg-secondary border-border">
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
                  <label className="text-sm">
                    Send WhatsApp welcome message to all
                  </label>
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
              disabled={isImporting}
              className="mr-auto"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
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
                (step === 1 && !selectedFile) ||
                (step === 2 && !requiredFieldsMapped.isValid)
              }
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Next
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={handleImport}
              disabled={isImporting}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isImporting ? 'Importing...' : `Import ${validLeadsCount} Leads`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
