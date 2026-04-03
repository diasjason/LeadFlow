'use client'

import { useEffect, useState } from 'react'
import {
  Phone,
  Mail,
  MessageCircle,
  Calendar,
  MapPin,
  CheckCircle,
  XCircle,
  RotateCcw,
  FileText,
  Pencil,
  X,
  Plus,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Lead, Category, Source, Stage, DocumentChecklist } from '@/lib/types'
import { STAGES, SOURCES, CATEGORIES, DOCUMENT_LABELS } from '@/lib/types'
import { cn, formatDate } from '@/lib/utils'
import { toast } from 'sonner'

interface LeadDetailModalProps {
  lead: Lead | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdateLead: (id: string, updates: Partial<Lead>) => Promise<void>
}

const categoryStyles: Record<Category, string> = {
  hot: 'bg-hot/20 text-hot border-hot/30',
  warm: 'bg-warm/20 text-warm border-warm/30',
  cold: 'bg-cold/20 text-cold border-cold/30',
}

const sourceStyles: Record<Source, string> = {
  facebook: 'bg-facebook/20 text-facebook border-facebook/30',
  instagram: 'bg-instagram/20 text-instagram border-instagram/30',
  referral: 'bg-referral/20 text-referral border-referral/30',
  excel: 'bg-excel/20 text-excel border-excel/30',
}

const sourceLabels: Record<Source, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  referral: 'Referral',
  excel: 'Excel Import',
}

const categoryLabels: Record<Category, string> = {
  hot: 'Hot',
  warm: 'Warm',
  cold: 'Cold',
}

export function LeadDetailModal({
  lead,
  open,
  onOpenChange,
  onUpdateLead,
}: LeadDetailModalProps) {
  const [selectedStage, setSelectedStage] = useState<Stage | ''>('')
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Edit form state
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editAdditionalPhones, setEditAdditionalPhones] = useState<string[]>([])
  const [editEmail, setEditEmail] = useState('')
  const [editSource, setEditSource] = useState<Source>('excel')
  const [editCategory, setEditCategory] = useState<Category>('warm')
  const [editNotes, setEditNotes] = useState('')

  // Reset edit state whenever lead changes or edit mode opens
  useEffect(() => {
    if (!lead) return
    setEditName(lead.name)
    setEditPhone(lead.phone)
    setEditAdditionalPhones(lead.additionalPhones ?? [])
    setEditEmail(lead.email ?? '')
    setEditSource(lead.source)
    setEditCategory(lead.category)
    setEditNotes(lead.notes ?? '')
  }, [lead, isEditing])

  // Exit edit mode when modal closes
  useEffect(() => {
    if (!open) setIsEditing(false)
  }, [open])

  if (!lead) return null

  const currentStageIndex = STAGES.findIndex((s) => s.id === lead.stage)
  const progress =
    lead.stage === 'lost' || lead.stage === 'closed-won'
      ? 100
      : ((currentStageIndex + 1) / STAGES.length) * 100

  const getAttemptsColor = (attempts: number): string => {
    if (attempts <= 2) return 'text-success'
    if (attempts <= 4) return 'text-warm'
    return 'text-hot'
  }

  // ── Edit mode handlers ──────────────────────

  const handleSaveEdit = async () => {
    if (!editName.trim()) {
      toast.error('Name is required')
      return
    }
    if (!editPhone.trim()) {
      toast.error('Primary phone is required')
      return
    }
    setIsSaving(true)
    try {
      await onUpdateLead(lead.id, {
        name: editName.trim(),
        phone: editPhone.trim(),
        additionalPhones: editAdditionalPhones.filter((p) => p.trim()),
        email: editEmail.trim() || undefined,
        source: editSource,
        category: editCategory,
        notes: editNotes.trim() || undefined,
      })
      toast.success('Lead updated')
      setIsEditing(false)
    } catch {
      toast.error('Failed to save changes')
    } finally {
      setIsSaving(false)
    }
  }

  const addPhone = () => setEditAdditionalPhones((prev) => [...prev, ''])

  const updatePhone = (index: number, value: string) =>
    setEditAdditionalPhones((prev) => prev.map((p, i) => (i === index ? value : p)))

  const removePhone = (index: number) =>
    setEditAdditionalPhones((prev) => prev.filter((_, i) => i !== index))

  // ── View mode handlers ──────────────────────

  const handleMoveToStage = async () => {
    if (selectedStage && selectedStage !== lead.stage) {
      try {
        await onUpdateLead(lead.id, { stage: selectedStage })
        toast.success(`Lead moved to ${STAGES.find((s) => s.id === selectedStage)?.label}`)
        setSelectedStage('')
      } catch {
        toast.error('Failed to update lead')
      }
    }
  }

  const handleFollowUp = async () => {
    const nextFollowUp = new Date()
    nextFollowUp.setDate(nextFollowUp.getDate() + 1)
    try {
      await onUpdateLead(lead.id, {
        attempts: lead.attempts + 1,
        lastContact: new Date(),
        nextFollowUp,
      })
      toast.success('Follow-up logged')
    } catch {
      toast.error('Failed to update lead')
    }
  }

  const handleScheduleVisit = async () => {
    try {
      await onUpdateLead(lead.id, { stage: 'visit-scheduled' })
      toast.success('Visit scheduled')
    } catch {
      toast.error('Failed to update lead')
    }
  }

  const handleVisitDone = async () => {
    try {
      await onUpdateLead(lead.id, { stage: 'visit-done' })
      toast.success('Visit marked as done')
    } catch {
      toast.error('Failed to update lead')
    }
  }

  const handleClosedWon = async () => {
    try {
      await onUpdateLead(lead.id, { stage: 'closed-won' })
      toast.success('Lead marked as Closed Won!')
    } catch {
      toast.error('Failed to update lead')
    }
  }

  const handleLost = async () => {
    try {
      await onUpdateLead(lead.id, { stage: 'lost' })
      toast.success('Lead marked as Lost')
    } catch {
      toast.error('Failed to update lead')
    }
  }

  const handleReactivate = async () => {
    try {
      await onUpdateLead(lead.id, { stage: 'new' })
      toast.success('Lead reactivated')
    } catch {
      toast.error('Failed to update lead')
    }
  }

  const toggleDocument = async (docKey: keyof DocumentChecklist) => {
    try {
      await onUpdateLead(lead.id, {
        documents: { ...lead.documents, [docKey]: !lead.documents[docKey] },
      })
    } catch {
      toast.error('Failed to update lead')
    }
  }

  const collectedDocs = Object.values(lead.documents).filter(Boolean).length
  const totalDocs = Object.keys(lead.documents).length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between pr-6">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-xl flex items-center gap-2">
                {lead.name}
                {lead.whatsAppSent && (
                  <MessageCircle className="h-4 w-4 text-success shrink-0" />
                )}
              </DialogTitle>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge variant="outline" className={cn('text-xs', categoryStyles[lead.category])}>
                  {categoryLabels[lead.category]}
                </Badge>
                <Badge variant="outline" className={cn('text-xs', sourceStyles[lead.source])}>
                  {sourceLabels[lead.source]}
                </Badge>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-xs',
                    lead.stage === 'lost' && 'bg-muted text-muted-foreground',
                    lead.stage === 'closed-won' && 'bg-success/20 text-success'
                  )}
                >
                  {lead.stage === 'closed-won'
                    ? 'Closed Won'
                    : lead.stage === 'lost'
                    ? 'Lost'
                    : STAGES.find((s) => s.id === lead.stage)?.label}
                </Badge>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing((v) => !v)}
              className={cn('gap-1.5 shrink-0', isEditing && 'text-primary')}
            >
              <Pencil className="h-3.5 w-3.5" />
              {isEditing ? 'Editing' : 'Edit'}
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-4">

          {isEditing ? (
            /* ── EDIT MODE ──────────────────────── */
            <div className="space-y-4">

              {/* Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Full Name</label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Full name"
                  className="bg-secondary border-border"
                />
              </div>

              {/* Primary phone */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Primary Phone</label>
                <Input
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="bg-secondary border-border"
                />
              </div>

              {/* Additional phones */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-muted-foreground">
                    Additional Numbers
                  </label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={addPhone}
                    className="h-6 px-2 text-xs gap-1"
                  >
                    <Plus className="h-3 w-3" />
                    Add
                  </Button>
                </div>
                {editAdditionalPhones.length === 0 && (
                  <p className="text-xs text-muted-foreground">No additional numbers</p>
                )}
                {editAdditionalPhones.map((p, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      value={p}
                      onChange={(e) => updatePhone(i, e.target.value)}
                      placeholder="+91 98765 43210"
                      className="bg-secondary border-border"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removePhone(i)}
                      className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Email</label>
                <Input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="bg-secondary border-border"
                />
              </div>

              {/* Source & Category */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Source</label>
                  <Select value={editSource} onValueChange={(v) => setEditSource(v as Source)}>
                    <SelectTrigger className="bg-secondary border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SOURCES.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Category</label>
                  <Select value={editCategory} onValueChange={(v) => setEditCategory(v as Category)}>
                    <SelectTrigger className="bg-secondary border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Notes</label>
                <Textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Add notes about this lead..."
                  className="bg-secondary border-border min-h-[100px] resize-none"
                />
              </div>

              {/* Save / Cancel */}
              <div className="flex gap-2 pt-1">
                <Button onClick={handleSaveEdit} disabled={isSaving} className="flex-1">
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsEditing(false)}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
              </div>
            </div>

          ) : (
            /* ── VIEW MODE ──────────────────────── */
            <>
              {/* Contact Info */}
              <div className="p-4 rounded-lg bg-secondary/50 border border-border">
                <h4 className="text-sm font-medium text-muted-foreground mb-3">
                  Contact Information
                </h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span>{lead.phone}</span>
                    <Badge variant="outline" className="text-xs py-0 h-4">primary</Badge>
                  </div>
                  {(lead.additionalPhones ?? []).map((p, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span>{p}</span>
                    </div>
                  ))}
                  {lead.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span>{lead.email}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Activity */}
              <div className="p-4 rounded-lg bg-secondary/50 border border-border">
                <h4 className="text-sm font-medium text-muted-foreground mb-3">Activity</h4>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Follow-ups</p>
                    <p className={cn('font-semibold', getAttemptsColor(lead.attempts))}>
                      {lead.attempts}/6
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Last Contact</p>
                    <p className="font-medium">{formatDate(lead.lastContact, true)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Next Follow-up</p>
                    <p className="font-medium">{formatDate(lead.nextFollowUp, true)}</p>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="p-4 rounded-lg bg-secondary/50 border border-border">
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Notes</h4>
                {lead.notes ? (
                  <p className="text-sm whitespace-pre-wrap">{lead.notes}</p>
                ) : (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    + Add notes...
                  </button>
                )}
              </div>

              {/* Pipeline Progress */}
              <div className="p-4 rounded-lg bg-secondary/50 border border-border">
                <h4 className="text-sm font-medium text-muted-foreground mb-3">
                  Pipeline Progress
                </h4>
                <Progress value={progress} className="h-2 mb-3" />
                <div className="flex flex-wrap gap-1">
                  {STAGES.map((stage, index) => (
                    <Badge
                      key={stage.id}
                      variant="outline"
                      className={cn(
                        'text-xs',
                        index <= currentStageIndex
                          ? 'bg-primary/20 text-primary border-primary/30'
                          : 'bg-muted text-muted-foreground border-border'
                      )}
                    >
                      {stage.label}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Document Checklist */}
              <div className="p-4 rounded-lg bg-secondary/50 border border-border">
                <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Documents ({collectedDocs}/{totalDocs})
                </h4>
                <div className="grid grid-cols-4 gap-2">
                  {(Object.keys(lead.documents) as Array<keyof DocumentChecklist>).map((docKey) => (
                    <Button
                      key={docKey}
                      variant="outline"
                      size="sm"
                      onClick={() => toggleDocument(docKey)}
                      className={cn(
                        'text-xs justify-start h-8',
                        lead.documents[docKey]
                          ? 'bg-success/20 text-success border-success/30 hover:bg-success/30'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      )}
                    >
                      {lead.documents[docKey] && <CheckCircle className="h-3 w-3 mr-1" />}
                      {DOCUMENT_LABELS[docKey]}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-3">
                {lead.stage !== 'lost' && lead.stage !== 'closed-won' && (
                  <>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={handleFollowUp} className="gap-1">
                        <Phone className="h-4 w-4" />
                        Follow-Up
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleScheduleVisit} className="gap-1">
                        <MapPin className="h-4 w-4" />
                        Schedule Visit
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleVisitDone} className="gap-1">
                        <Calendar className="h-4 w-4" />
                        Mark Visit Done
                      </Button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={handleClosedWon}
                        className="gap-1 bg-success text-white hover:bg-success/90"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Mark Closed Won
                      </Button>
                      <Button variant="destructive" size="sm" onClick={handleLost} className="gap-1">
                        <XCircle className="h-4 w-4" />
                        Mark Lost
                      </Button>
                    </div>

                    <div className="flex items-center gap-2">
                      <Select
                        value={selectedStage}
                        onValueChange={(v) => setSelectedStage(v as Stage)}
                      >
                        <SelectTrigger className="w-[180px] bg-secondary border-border">
                          <SelectValue placeholder="Move to stage..." />
                        </SelectTrigger>
                        <SelectContent>
                          {STAGES.filter((s) => s.id !== lead.stage).map((stage) => (
                            <SelectItem key={stage.id} value={stage.id}>
                              {stage.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleMoveToStage}
                        disabled={!selectedStage}
                      >
                        Move
                      </Button>
                    </div>
                  </>
                )}

                {lead.stage === 'lost' && (
                  <Button variant="outline" size="sm" onClick={handleReactivate} className="gap-1">
                    <RotateCcw className="h-4 w-4" />
                    Re-Activate Lead
                  </Button>
                )}
              </div>
            </>
          )}

        </div>
      </DialogContent>
    </Dialog>
  )
}
