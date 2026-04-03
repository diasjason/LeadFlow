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
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'

type OrgSettings = {
  id: string
  name: string
  phone: string | null
  email: string | null
  whatsappPhoneId: string | null
  whatsappBusinessId: string | null
  whatsappToken: string | null
  vapiApiKey: string | null
  vapiPhoneNumberId: string | null
  vapiAssistantId: string | null
  vapiInboundNumber: string | null
}

interface OrganizationSettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-semibold mb-3">{children}</p>
}

function FieldRow({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <div className="grid grid-cols-[140px_1fr] items-center gap-3">
      <label className="text-sm text-muted-foreground text-right">{label}</label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-secondary border-border h-8 text-sm"
      />
    </div>
  )
}

export function OrganizationSettingsModal({
  open,
  onOpenChange,
}: OrganizationSettingsModalProps) {
  const [orgId, setOrgId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // General
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')

  // WhatsApp
  const [waPhoneId, setWaPhoneId] = useState('')
  const [waBusinessId, setWaBusinessId] = useState('')
  const [waToken, setWaToken] = useState('')

  // Vapi
  const [vapiKey, setVapiKey] = useState('')
  const [vapiPhoneId, setVapiPhoneId] = useState('')
  const [vapiAssistantId, setVapiAssistantId] = useState('')
  const [vapiInbound, setVapiInbound] = useState('')

  useEffect(() => {
    if (!open) return
    setIsLoading(true)
    fetch('/api/organization/settings')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load')
        return r.json() as Promise<OrgSettings>
      })
      .then((d) => {
        setOrgId(d.id)
        setName(d.name ?? '')
        setPhone(d.phone ?? '')
        setEmail(d.email ?? '')
        setWaPhoneId(d.whatsappPhoneId ?? '')
        setWaBusinessId(d.whatsappBusinessId ?? '')
        // Don't pre-fill masked secrets — show placeholder instead
        setWaToken(d.whatsappToken === '••••••••' ? '' : (d.whatsappToken ?? ''))
        setVapiKey(d.vapiApiKey === '••••••••' ? '' : (d.vapiApiKey ?? ''))
        setVapiPhoneId(d.vapiPhoneNumberId ?? '')
        setVapiAssistantId(d.vapiAssistantId ?? '')
        setVapiInbound(d.vapiInboundNumber ?? '')
      })
      .catch(() => toast.error('Failed to load settings'))
      .finally(() => setIsLoading(false))
  }, [open])

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Organization name is required')
      return
    }
    setIsSaving(true)
    try {
      const res = await fetch('/api/organization/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim() || null,
          email: email.trim() || null,
          whatsappPhoneId: waPhoneId.trim() || null,
          whatsappBusinessId: waBusinessId.trim() || null,
          // Empty string = user cleared it; null = use existing (we send '' to clear)
          whatsappToken: waToken.trim() || null,
          vapiApiKey: vapiKey.trim() || null,
          vapiPhoneNumberId: vapiPhoneId.trim() || null,
          vapiAssistantId: vapiAssistantId.trim() || null,
          vapiInboundNumber: vapiInbound.trim() || null,
        }),
      })
      if (!res.ok) {
        const p = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(p.error ?? 'Failed to save')
      }
      toast.success('Settings saved')
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Organization Settings</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="py-10 text-sm text-center text-muted-foreground">Loading...</div>
        ) : (
          <div className="space-y-5 py-2">

            {/* ── General ── */}
            <div className="space-y-3">
              <SectionTitle>General</SectionTitle>
              <FieldRow label="Name" value={name} onChange={setName} placeholder="My Organization" />
              <FieldRow label="Phone" value={phone} onChange={setPhone} placeholder="+91 98765 43210" />
              <FieldRow label="Email" value={email} onChange={setEmail} placeholder="contact@org.com" type="email" />
              {orgId && (
                <FieldRow label="Org ID" value={orgId} onChange={() => {}} placeholder="" />
              )}
            </div>

            <Separator />

            {/* ── WhatsApp ── */}
            <div className="space-y-3">
              <SectionTitle>WhatsApp (Meta Cloud API)</SectionTitle>
              <FieldRow
                label="Phone Number ID"
                value={waPhoneId}
                onChange={setWaPhoneId}
                placeholder="Meta phone number ID"
              />
              <FieldRow
                label="Business Account ID"
                value={waBusinessId}
                onChange={setWaBusinessId}
                placeholder="Meta WABA ID"
              />
              <FieldRow
                label="Access Token"
                value={waToken}
                onChange={setWaToken}
                placeholder="Paste new token to update"
                type="password"
              />
            </div>

            <Separator />

            {/* ── Vapi ── */}
            <div className="space-y-3">
              <SectionTitle>Vapi AI Voice</SectionTitle>
              <FieldRow
                label="Private API Key"
                value={vapiKey}
                onChange={setVapiKey}
                placeholder="Paste new key to update"
                type="password"
              />
              <FieldRow
                label="Phone Number ID"
                value={vapiPhoneId}
                onChange={setVapiPhoneId}
                placeholder="Outbound phone number ID"
              />
              <FieldRow
                label="Inbound Number"
                value={vapiInbound}
                onChange={setVapiInbound}
                placeholder="+1 555 000 0000"
              />
              <FieldRow
                label="Assistant ID"
                value={vapiAssistantId}
                onChange={setVapiAssistantId}
                placeholder="Pre-built assistant (optional)"
              />
            </div>

          </div>
        )}

        <DialogFooter className="pt-2">
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
