'use client'

import { useState, useMemo } from 'react'
import { Radio, Check, AlertTriangle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { Lead } from '@/lib/types'
import { toast } from 'sonner'

interface BroadcastModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  leads: Lead[]
}

const DEFAULT_MESSAGE = `Exclusive offer! Limited premium units available at special launch prices. Reply YES to know more.`

export function BroadcastModal({
  open,
  onOpenChange,
  leads,
}: BroadcastModalProps) {
  const lostLeads = useMemo(
    () => leads.filter((lead) => lead.stage === 'lost'),
    [leads]
  )

  const [message, setMessage] = useState(DEFAULT_MESSAGE)
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(
    new Set(lostLeads.map((l) => l.id))
  )
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [isSent, setIsSent] = useState(false)

  const maxChars = 1000
  const charCount = message.length

  const handleSelectAll = () => {
    setSelectedLeads(new Set(lostLeads.map((l) => l.id)))
  }

  const handleDeselectAll = () => {
    setSelectedLeads(new Set())
  }

  const toggleLead = (leadId: string) => {
    const newSelected = new Set(selectedLeads)
    if (newSelected.has(leadId)) {
      newSelected.delete(leadId)
    } else {
      newSelected.add(leadId)
    }
    setSelectedLeads(newSelected)
  }

  const handleSendClick = () => {
    if (selectedLeads.size === 0) {
      toast.error('Please select at least one lead')
      return
    }
    setShowConfirmation(true)
  }

  const handleConfirmSend = async () => {
    setIsSending(true)

    try {
      const response = await fetch('/api/broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message.trim(),
          leadIds: Array.from(selectedLeads),
        }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error ?? 'Failed to queue broadcast')
      }

      setIsSent(true)
      toast.success(`Broadcast queued to ${selectedLeads.size} leads`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Broadcast failed')
      setShowConfirmation(false)
      return
    } finally {
      setIsSending(false)
    }

    // Reset and close after a short delay
    setTimeout(() => {
      setIsSent(false)
      setShowConfirmation(false)
      setMessage(DEFAULT_MESSAGE)
      setSelectedLeads(new Set(lostLeads.map((l) => l.id)))
      onOpenChange(false)
    }, 1500)
  }

  const handleClose = () => {
    if (!isSending) {
      setShowConfirmation(false)
      setIsSent(false)
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[560px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Radio className="h-5 w-5 text-primary" />
            Re-Marketing Broadcast
          </DialogTitle>
          <DialogDescription>
            Queue a broadcast campaign for {lostLeads.length} lost leads
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Message Input */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Broadcast Message</label>
              <span
                className={`text-xs ${
                  charCount > maxChars ? 'text-hot' : 'text-muted-foreground'
                }`}
              >
                {charCount}/{maxChars}
              </span>
            </div>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Enter your broadcast message..."
              className="bg-secondary border-border min-h-[100px]"
              maxLength={maxChars}
            />
          </div>

          {/* Lead Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">
                Select Leads ({selectedLeads.size} selected)
              </label>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAll}
                  className="text-xs h-7"
                >
                  Select All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDeselectAll}
                  className="text-xs h-7"
                >
                  Deselect All
                </Button>
              </div>
            </div>

            <ScrollArea className="h-[200px] rounded-lg border border-border bg-secondary/50 p-2">
              {lostLeads.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No lost leads available
                </p>
              ) : (
                <div className="space-y-1">
                  {lostLeads.map((lead) => (
                    <div
                      key={lead.id}
                      onClick={() => toggleLead(lead.id)}
                      className="flex items-center gap-3 p-2 rounded-md hover:bg-secondary cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedLeads.has(lead.id)}
                        onCheckedChange={() => toggleLead(lead.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {lead.name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {lead.phone}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Confirmation Alert */}
          {showConfirmation && !isSent && (
            <div className="p-4 rounded-lg bg-warm/10 border border-warm/30">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-warm shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-warm">
                    Are you sure you want to send to {selectedLeads.size} leads?
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    This action will queue WhatsApp messages for all selected
                    leads.
                  </p>
                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      onClick={handleConfirmSend}
                      disabled={isSending}
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      {isSending ? 'Sending...' : 'Confirm'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowConfirmation(false)}
                      disabled={isSending}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSending}>
            Cancel
          </Button>
          {isSent ? (
            <Button disabled className="gap-2 bg-success text-white">
              <Check className="h-4 w-4" />
              Sent!
            </Button>
          ) : (
            <Button
              onClick={handleSendClick}
              disabled={
                selectedLeads.size === 0 ||
                message.trim().length === 0 ||
                isSending ||
                showConfirmation
              }
              className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Radio className="h-4 w-4" />
              Send to {selectedLeads.size} Leads
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
