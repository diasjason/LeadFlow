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
    <header className="flex min-h-14 items-center justify-between gap-2 border-b border-border bg-card px-3 py-3 sm:px-4 md:px-6 md:py-4">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/20">
          <span className="text-sm font-bold text-primary">LF</span>
        </div>
        <span className="truncate text-lg font-semibold text-foreground md:text-xl">
          Lead<span className="text-primary">Flow</span>
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-1.5 md:gap-3">
        {/* Mobile / small: icon-only actions */}
        <div className="flex items-center gap-1 md:hidden">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0"
            aria-label="Import leads"
            onClick={onImport}
          >
            <Upload className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0"
            aria-label="Broadcast"
            onClick={onBroadcast}
          >
            <Radio className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            className="h-9 w-9 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
            aria-label="New lead"
            onClick={onNewLead}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Desktop: labeled buttons */}
        <div className="hidden items-center gap-2 md:flex md:gap-3">
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
        </div>

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
