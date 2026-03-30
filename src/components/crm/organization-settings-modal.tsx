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
  whatsappPhoneId: string | null
  whatsappToken: string | null
  whatsappBusinessId: string | null
}

interface OrganizationSettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function OrganizationSettingsModal({
  open,
  onOpenChange,
}: OrganizationSettingsModalProps) {
  const [settings, setSettings] = useState<OrganizationSettings | null>(null)
  const [name, setName] = useState('')
  const [whatsappPhoneId, setWhatsappPhoneId] = useState('')
  const [whatsappBusinessId, setWhatsappBusinessId] = useState('')
  const [whatsappToken, setWhatsappToken] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!open) return

    const loadSettings = async () => {
      setIsLoading(true)
      try {
        const response = await fetch('/api/organization/settings')
        if (!response.ok) {
          throw new Error('Failed to load settings')
        }

        const data = (await response.json()) as OrganizationSettings
        setSettings(data)
        setName(data.name ?? '')
        setWhatsappPhoneId(data.whatsappPhoneId ?? '')
        setWhatsappBusinessId(data.whatsappBusinessId ?? '')
        setWhatsappToken(data.whatsappToken ?? '')
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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          whatsappPhoneId: whatsappPhoneId.trim() || null,
          whatsappBusinessId: whatsappBusinessId.trim() || null,
          whatsappToken: whatsappToken.trim() || null,
        }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error ?? 'Failed to save settings')
      }

      const updated = (await response.json()) as OrganizationSettings
      setSettings(updated)
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
      <DialogContent className="sm:max-w-[540px] bg-card border-border">
        <DialogHeader>
          <DialogTitle>Organization Settings</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-sm text-center text-muted-foreground">Loading settings...</div>
        ) : (
          <FieldGroup className="gap-4 py-2">
            <Field>
              <FieldLabel>Organization Name</FieldLabel>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="My Organization"
                className="bg-secondary border-border"
              />
            </Field>

            <Field>
              <FieldLabel>WhatsApp Phone Number ID</FieldLabel>
              <Input
                value={whatsappPhoneId}
                onChange={(event) => setWhatsappPhoneId(event.target.value)}
                placeholder="Meta phone number ID"
                className="bg-secondary border-border"
              />
            </Field>

            <Field>
              <FieldLabel>WhatsApp Business Account ID</FieldLabel>
              <Input
                value={whatsappBusinessId}
                onChange={(event) => setWhatsappBusinessId(event.target.value)}
                placeholder="Meta business account ID"
                className="bg-secondary border-border"
              />
            </Field>

            <Field>
              <FieldLabel>WhatsApp Access Token</FieldLabel>
              <Input
                type="password"
                value={whatsappToken}
                onChange={(event) => setWhatsappToken(event.target.value)}
                placeholder="Permanent access token"
                className="bg-secondary border-border"
              />
            </Field>

            <p className="text-xs text-muted-foreground">
              Use Meta Cloud API values here. Once saved, creating a lead will trigger the
              welcome WhatsApp template automatically.
            </p>
          </FieldGroup>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || isLoading || !settings}>
            {isSaving ? 'Saving...' : 'Save Settings'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
