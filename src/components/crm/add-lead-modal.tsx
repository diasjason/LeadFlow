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
      <DialogContent className="sm:max-w-[480px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-xl">Add New Lead</DialogTitle>
        </DialogHeader>

        <FieldGroup className="gap-4 py-4">
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

          <div className="grid grid-cols-2 gap-4">
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
              className="bg-secondary border-border min-h-[80px]"
            />
          </Field>
        </FieldGroup>

        <DialogFooter>
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
            className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <MessageCircle className="h-4 w-4" />
            {isSubmitting ? 'Adding...' : 'Add Lead & Send WhatsApp'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
