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
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'

type OrganizationSettings = {
  id: string
  name: string
  // WhatsApp
  whatsappPhoneId: string | null
  whatsappToken: string | null
  whatsappBusinessId: string | null
  // Vapi
  vapiApiKey: string | null
  vapiPhoneNumberId: string | null
  vapiAssistantId: string | null
  vapiInboundNumber: string | null
  // Google
  googleConnected: boolean
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
  // WhatsApp
  const [whatsappPhoneId, setWhatsappPhoneId] = useState('')
  const [whatsappBusinessId, setWhatsappBusinessId] = useState('')
  const [whatsappToken, setWhatsappToken] = useState('')
  // Vapi
  const [vapiApiKey, setVapiApiKey] = useState('')
  const [vapiPhoneNumberId, setVapiPhoneNumberId] = useState('')
  const [vapiAssistantId, setVapiAssistantId] = useState('')
  const [vapiInboundNumber, setVapiInboundNumber] = useState('')
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
        setSettings(data)
        setName(data.name ?? '')
        setWhatsappPhoneId(data.whatsappPhoneId ?? '')
        setWhatsappBusinessId(data.whatsappBusinessId ?? '')
        setWhatsappToken(data.whatsappToken ?? '')
        setVapiApiKey(data.vapiApiKey ?? '')
        setVapiPhoneNumberId(data.vapiPhoneNumberId ?? '')
        setVapiAssistantId(data.vapiAssistantId ?? '')
        setVapiInboundNumber(data.vapiInboundNumber ?? '')
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
          whatsappPhoneId: whatsappPhoneId.trim() || null,
          whatsappBusinessId: whatsappBusinessId.trim() || null,
          whatsappToken: whatsappToken.trim() || null,
          vapiApiKey: vapiApiKey.trim() || null,
          vapiPhoneNumberId: vapiPhoneNumberId.trim() || null,
          vapiAssistantId: vapiAssistantId.trim() || null,
          vapiInboundNumber: vapiInboundNumber.trim() || null,
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
      <DialogContent className="sm:max-w-[580px] bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Organization Settings</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-sm text-center text-muted-foreground">Loading settings...</div>
        ) : (
          <div className="space-y-6 py-2">
            {/* General */}
            <FieldGroup className="gap-4">
              <Field>
                <FieldLabel>Organization Name</FieldLabel>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My Organization"
                  className="bg-secondary border-border"
                />
              </Field>
            </FieldGroup>

            <Separator />

            {/* WhatsApp */}
            <div>
              <p className="text-sm font-semibold mb-3">WhatsApp (Meta Cloud API)</p>
              <FieldGroup className="gap-4">
                <Field>
                  <FieldLabel>Phone Number ID</FieldLabel>
                  <Input
                    value={whatsappPhoneId}
                    onChange={(e) => setWhatsappPhoneId(e.target.value)}
                    placeholder="Meta phone number ID"
                    className="bg-secondary border-border"
                  />
                </Field>
                <Field>
                  <FieldLabel>Business Account ID</FieldLabel>
                  <Input
                    value={whatsappBusinessId}
                    onChange={(e) => setWhatsappBusinessId(e.target.value)}
                    placeholder="Meta WABA ID"
                    className="bg-secondary border-border"
                  />
                </Field>
                <Field>
                  <FieldLabel>Access Token</FieldLabel>
                  <Input
                    type="password"
                    value={whatsappToken}
                    onChange={(e) => setWhatsappToken(e.target.value)}
                    placeholder="Permanent access token"
                    className="bg-secondary border-border"
                  />
                </Field>
              </FieldGroup>
            </div>

            <Separator />

            {/* Vapi */}
            <div>
              <p className="text-sm font-semibold mb-1">Vapi AI Voice Calling</p>
              <p className="text-xs text-muted-foreground mb-3">
                Used for automated outbound calls and inbound call routing.
                Get your keys from <span className="font-mono">app.vapi.ai</span>.
              </p>
              <FieldGroup className="gap-4">
                <Field>
                  <FieldLabel>Vapi Private API Key</FieldLabel>
                  <Input
                    type="password"
                    value={vapiApiKey}
                    onChange={(e) => setVapiApiKey(e.target.value)}
                    placeholder="vapi_••••••••"
                    className="bg-secondary border-border"
                  />
                </Field>
                <Field>
                  <FieldLabel>Outbound Phone Number ID</FieldLabel>
                  <Input
                    value={vapiPhoneNumberId}
                    onChange={(e) => setVapiPhoneNumberId(e.target.value)}
                    placeholder="Vapi phone number ID for outbound calls"
                    className="bg-secondary border-border"
                  />
                </Field>
                <Field>
                  <FieldLabel>Inbound Number (leads call this)</FieldLabel>
                  <Input
                    value={vapiInboundNumber}
                    onChange={(e) => setVapiInboundNumber(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    className="bg-secondary border-border"
                  />
                </Field>
                <Field>
                  <FieldLabel>Pre-built Assistant ID (optional)</FieldLabel>
                  <Input
                    value={vapiAssistantId}
                    onChange={(e) => setVapiAssistantId(e.target.value)}
                    placeholder="Leave blank to use dynamic assistant config"
                    className="bg-secondary border-border"
                  />
                </Field>
              </FieldGroup>
            </div>

            <Separator />

            {/* Google Calendar */}
            <div>
              <p className="text-sm font-semibold mb-1">Google Calendar</p>
              <p className="text-xs text-muted-foreground mb-3">
                When the AI books a site visit, it creates a Google Calendar event for your agent.
              </p>
              <div className="flex items-center gap-3">
                <div className={`h-2 w-2 rounded-full ${settings?.googleConnected ? 'bg-green-500' : 'bg-muted-foreground'}`} />
                <span className="text-sm">
                  {settings?.googleConnected ? 'Google Calendar connected' : 'Not connected'}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    window.location.href = '/api/auth/google'
                  }}
                >
                  {settings?.googleConnected ? 'Reconnect' : 'Connect Google Calendar'}
                </Button>
              </div>
              {!process.env.NEXT_PUBLIC_BASE_URL && (
                <p className="text-xs text-yellow-500 mt-2">
                  Set NEXT_PUBLIC_BASE_URL in your environment to enable Google Calendar OAuth.
                </p>
              )}
            </div>
          </div>
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
