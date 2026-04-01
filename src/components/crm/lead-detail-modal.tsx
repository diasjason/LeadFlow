'use client'

import { useState } from 'react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Lead, Category, Source, Stage, DocumentChecklist } from '@/lib/types'
import { STAGES, DOCUMENT_LABELS } from '@/lib/types'
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
  const [isCalling, setIsCalling] = useState(false)

  if (!lead) return null

  const currentStageIndex = STAGES.findIndex((s) => s.id === lead.stage)
  const progress = lead.stage === 'lost' || lead.stage === 'closed-won' 
    ? 100 
    : ((currentStageIndex + 1) / STAGES.length) * 100

  const getAttemptsColor = (attempts: number): string => {
    if (attempts <= 2) return 'text-success'
    if (attempts <= 4) return 'text-warm'
    return 'text-hot'
  }

  const handleMoveToStage = async () => {
    if (selectedStage && selectedStage !== lead.stage) {
      try {
        await onUpdateLead(lead.id, { stage: selectedStage })
        toast.success(`Lead moved to ${STAGES.find(s => s.id === selectedStage)?.label}`)
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
        documents: {
          ...lead.documents,
          [docKey]: !lead.documents[docKey],
        },
      })
    } catch {
      toast.error('Failed to update lead')
    }
  }

  const handleVapiCall = async () => {
    setIsCalling(true)
    try {
      const response = await fetch('/api/vapi/call', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ leadId: lead.id }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error ?? 'Failed to start Vapi call')
      }

      const payload = (await response.json()) as { callId?: string }
      toast.success(
        payload.callId
          ? `Vapi call started (${payload.callId})`
          : 'Vapi call started'
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Vapi call failed')
    } finally {
      setIsCalling(false)
    }
  }

  const collectedDocs = Object.values(lead.documents).filter(Boolean).length
  const totalDocs = Object.keys(lead.documents).length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-xl flex items-center gap-2">
                {lead.name}
                {lead.whatsAppSent && (
                  <MessageCircle className="h-4 w-4 text-success" />
                )}
              </DialogTitle>
              <div className="flex items-center gap-2 mt-2">
                <Badge
                  variant="outline"
                  className={cn('text-xs', categoryStyles[lead.category])}
                >
                  {categoryLabels[lead.category]}
                </Badge>
                <Badge
                  variant="outline"
                  className={cn('text-xs', sourceStyles[lead.source])}
                >
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
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Contact Info */}
          <div className="p-4 rounded-lg bg-secondary/50 border border-border">
            <h4 className="text-sm font-medium text-muted-foreground mb-3">
              Contact Information
            </h4>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{lead.phone}</span>
              </div>
              {lead.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{lead.email}</span>
                </div>
              )}
            </div>
          </div>

          {/* Activity */}
          <div className="p-4 rounded-lg bg-secondary/50 border border-border">
            <h4 className="text-sm font-medium text-muted-foreground mb-3">
              Activity
            </h4>
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
          {lead.notes && (
            <div className="p-4 rounded-lg bg-secondary/50 border border-border">
              <h4 className="text-sm font-medium text-muted-foreground mb-2">
                Notes
              </h4>
              <p className="text-sm">{lead.notes}</p>
            </div>
          )}

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
              {(Object.keys(lead.documents) as Array<keyof DocumentChecklist>).map(
                (docKey) => (
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
                    {lead.documents[docKey] && (
                      <CheckCircle className="h-3 w-3 mr-1" />
                    )}
                    {DOCUMENT_LABELS[docKey]}
                  </Button>
                )
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            {lead.stage !== 'lost' && lead.stage !== 'closed-won' && (
              <>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleVapiCall}
                    disabled={isCalling}
                    className="gap-1"
                  >
                    <Phone className="h-4 w-4" />
                    {isCalling ? 'Calling...' : 'Call with Vapi'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleFollowUp}
                    className="gap-1"
                  >
                    <Phone className="h-4 w-4" />
                    Follow-Up
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleScheduleVisit}
                    className="gap-1"
                  >
                    <MapPin className="h-4 w-4" />
                    Schedule Visit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleVisitDone}
                    className="gap-1"
                  >
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
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleLost}
                    className="gap-1"
                  >
                    <XCircle className="h-4 w-4" />
                    Mark Lost
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <Select value={selectedStage} onValueChange={(v) => setSelectedStage(v as Stage)}>
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
              <Button
                variant="outline"
                size="sm"
                onClick={handleReactivate}
                className="gap-1"
              >
                <RotateCcw className="h-4 w-4" />
                Re-Activate Lead
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
