'use client'

import { useState } from 'react'
import { MessageCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Field, FieldLabel, FieldGroup } from '@/components/ui/field'
import { SOURCES, CATEGORIES, type Source, type Category, type Lead } from '@/lib/types'
import { toast } from 'sonner'

interface AddLeadModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddLead: (
    lead: Omit<Lead, 'id' | 'createdAt' | 'documents' | 'attempts' | 'whatsAppSent'>
  ) => Promise<void>
}

export function AddLeadModal({ open, onOpenChange, onAddLead }: AddLeadModalProps) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [source, setSource] = useState<Source>('facebook')
  const [category, setCategory] = useState<Category>('warm')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const resetForm = () => {
    setName('')
    setPhone('')
    setEmail('')
    setSource('facebook')
    setCategory('warm')
    setNotes('')
  }

  const handleSubmit = async () => {
    if (!name.trim() || !phone.trim()) {
      toast.error('Please fill in required fields')
      return
    }

    setIsSubmitting(true)

    try {
      await onAddLead({
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        source,
        category,
        stage: 'new',
        notes: notes.trim() || undefined,
      })

      toast.success('Lead added. WhatsApp welcome message sent.')
      resetForm()
      onOpenChange(false)
    } catch {
      toast.error('Failed to save lead to database')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-3 left-1/2 flex max-h-[min(92dvh,100vh-1rem)] w-[calc(100%-1rem)] max-w-[calc(100%-1rem)] translate-x-[-50%] translate-y-0 flex-col gap-0 overflow-hidden p-4 sm:top-[50%] sm:max-h-[85vh] sm:max-w-[480px] sm:-translate-y-1/2 sm:p-6 bg-card border-border">
        <DialogHeader className="shrink-0 space-y-1 pr-7 text-left">
          <DialogTitle className="text-lg sm:text-xl">Add New Lead</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-3 sm:py-4">
          <FieldGroup className="gap-3 sm:gap-4">
            <Field>
              <FieldLabel>
                Name <span className="text-hot">*</span>
              </FieldLabel>
              <Input
                placeholder="Enter full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-secondary border-border"
              />
            </Field>

            <Field>
              <FieldLabel>
                Phone <span className="text-hot">*</span>
              </FieldLabel>
              <Input
                placeholder="+91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="bg-secondary border-border"
              />
            </Field>

            <Field>
              <FieldLabel>Email</FieldLabel>
              <Input
                type="email"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-secondary border-border"
              />
            </Field>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              <Field>
                <FieldLabel>Source</FieldLabel>
                <Select value={source} onValueChange={(v) => setSource(v as Source)}>
                  <SelectTrigger className="bg-secondary border-border">
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
              </Field>

              <Field>
                <FieldLabel>Category</FieldLabel>
                <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
                  <SelectTrigger className="bg-secondary border-border">
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
              </Field>
            </div>

            <Field>
              <FieldLabel>Notes</FieldLabel>
              <Textarea
                placeholder="Add any notes about this lead..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-[72px] bg-secondary border-border sm:min-h-[80px]"
              />
            </Field>
          </FieldGroup>
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t border-border pt-3 sm:pt-4">
          <Button
            variant="outline"
            onClick={() => {
              resetForm()
              onOpenChange(false)
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !name.trim() || !phone.trim()}
            className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 sm:shrink-0"
          >
            <MessageCircle className="h-4 w-4 shrink-0" />
            <span className="text-center sm:inline">
              {isSubmitting ? 'Adding...' : (
                <>
                  <span className="sm:hidden">Add &amp; send WhatsApp</span>
                  <span className="hidden sm:inline">Add Lead &amp; Send WhatsApp</span>
                </>
              )}
            </span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
