'use client'

import { Plus, Radio, Upload, Settings } from 'lucide-react'
import { UserButton } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'

interface HeaderProps {
  onNewLead: () => void
  onBroadcast: () => void
  onImport: () => void
  onSettings: () => void
}

export function Header({ onNewLead, onBroadcast, onImport, onSettings }: HeaderProps) {
  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
          <span className="text-primary font-bold text-sm">LF</span>
        </div>
        <span className="text-xl font-semibold text-foreground">
          Lead<span className="text-primary">Flow</span>
        </span>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={onImport} className="gap-2">
          <Upload className="h-4 w-4" />
          Import
        </Button>
        <Button variant="outline" size="sm" onClick={onBroadcast} className="gap-2">
          <Radio className="h-4 w-4" />
          Broadcast
        </Button>
        <Button
          size="sm"
          onClick={onNewLead}
          className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          New Lead
        </Button>

        <ThemeToggle />

        <UserButton
          appearance={{
            elements: {
              avatarBox: 'h-8 w-8',
              userButtonPopoverCard: 'border border-border shadow-lg',
            },
          }}
        >
          <UserButton.MenuItems>
            <UserButton.Action
              label="Settings"
              labelIcon={<Settings className="h-4 w-4" />}
              onClick={onSettings}
            />
          </UserButton.MenuItems>
        </UserButton>
      </div>
    </header>
  )
}
