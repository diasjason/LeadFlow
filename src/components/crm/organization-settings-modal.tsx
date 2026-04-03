'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { toast } from 'sonner'

type OrganizationSettings = {
  id: string
  name: string
  phone: string | null
  email: string | null
}

interface OrganizationSettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function OrganizationSettingsModal({
  open,
  onOpenChange,
}: OrganizationSettingsModalProps) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [orgId, setOrgId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!open) return

    const loadSettings = async () => {
      setIsLoading(true)
      try {
        const response = await fetch('/api/organization/settings')
        if (!response.ok) throw new Error('Failed to load settings')

        const data = (await response.json()) as OrganizationSettings
        setOrgId(data.id)
        setName(data.name ?? '')
        setPhone(data.phone ?? '')
        setEmail(data.email ?? '')
      } catch {
        toast.error('Unable to load organization settings')
      } finally {
        setIsLoading(false)
      }
    }

    loadSettings()
  }, [open])

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Organization name is required')
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch('/api/organization/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim() || null,
          email: email.trim() || null,
        }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error((payload as { error?: string }).error ?? 'Failed to save settings')
      }

      toast.success('Organization settings saved')
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save settings')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] bg-card border-border">
        <DialogHeader>
          <DialogTitle>Organization Settings</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-sm text-center text-muted-foreground">Loading...</div>
        ) : (
          <FieldGroup className="gap-4 py-2">
            <Field>
              <FieldLabel>Organization Name</FieldLabel>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Organization"
                className="bg-secondary border-border"
              />
            </Field>
            <Field>
              <FieldLabel>Phone</FieldLabel>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="bg-secondary border-border"
              />
            </Field>
            <Field>
              <FieldLabel>Email</FieldLabel>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contact@yourorg.com"
                className="bg-secondary border-border"
              />
            </Field>
            {orgId && (
              <Field>
                <FieldLabel>Organization ID</FieldLabel>
                <Input
                  value={orgId}
                  readOnly
                  className="bg-secondary border-border font-mono text-xs text-muted-foreground"
                />
              </Field>
            )}
          </FieldGroup>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || isLoading}>
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
