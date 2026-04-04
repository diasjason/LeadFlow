'use client'

import { Users, Flame, Calendar, MapPin, Trophy, XCircle } from 'lucide-react'
import type { Lead } from '@/lib/types'

interface StatsBarProps {
  leads: Lead[]
}

type StatDef = {
  label: string
  shortLabel: string
  value: number
  icon: typeof Users
  color: string
  bgColor: string
}

export function StatsBar({ leads }: StatsBarProps) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const stats: StatDef[] = [
    {
      label: 'Total Leads',
      shortLabel: 'Total',
      value: leads.filter((l) => l.stage !== 'lost' && l.stage !== 'closed-won').length,
      icon: Users,
      color: 'text-foreground',
      bgColor: 'bg-secondary',
    },
    {
      label: 'Hot Leads',
      shortLabel: 'Hot',
      value: leads.filter(
        (l) => l.category === 'hot' && l.stage !== 'lost' && l.stage !== 'closed-won'
      ).length,
      icon: Flame,
      color: 'text-hot',
      bgColor: 'bg-hot/10',
    },
    {
      label: "Today's Follow-ups",
      shortLabel: 'Today',
      value: leads.filter((l) => {
        if (!l.nextFollowUp) return false
        const followUp = new Date(l.nextFollowUp)
        followUp.setHours(0, 0, 0, 0)
        return followUp.getTime() === today.getTime()
      }).length,
      icon: Calendar,
      color: 'text-warm',
      bgColor: 'bg-warm/10',
    },
    {
      label: 'Site Visits',
      shortLabel: 'Visits',
      value: leads.filter((l) => l.stage === 'visit-scheduled' || l.stage === 'visit-done').length,
      icon: MapPin,
      color: 'text-facebook',
      bgColor: 'bg-facebook/10',
    },
    {
      label: 'Closed Won',
      shortLabel: 'Won',
      value: leads.filter((l) => l.stage === 'closed-won').length,
      icon: Trophy,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      label: 'Lost',
      shortLabel: 'Lost',
      value: leads.filter((l) => l.stage === 'lost').length,
      icon: XCircle,
      color: 'text-muted-foreground',
      bgColor: 'bg-muted',
    },
  ]

  return (
    <>
      {/* Mobile: single-row horizontal scroll, compact */}
      <div className="border-b border-border px-3 py-2 md:hidden">
        <div className="scrollbar-none flex snap-x snap-mandatory gap-2 overflow-x-auto pb-0.5">
          {stats.map((stat) => (
            <div
              key={stat.label}
              title={stat.label}
              className="flex shrink-0 snap-start items-center gap-2 rounded-md border border-border bg-card px-2.5 py-2 shadow-sm"
            >
              <div className={`shrink-0 rounded-md p-1.5 ${stat.bgColor}`}>
                <stat.icon className={`h-3.5 w-3.5 ${stat.color}`} />
              </div>
              <div className="min-w-0 pr-0.5">
                <p className={`text-base font-bold tabular-nums leading-none ${stat.color}`}>
                  {stat.value}
                </p>
                <p className="mt-0.5 max-w-[4.5rem] truncate text-[10px] leading-tight text-muted-foreground">
                  {stat.shortLabel}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* md+: original card grid */}
      <div className="hidden min-w-0 max-w-full grid-cols-3 gap-4 px-4 py-4 md:grid md:px-6 lg:grid-cols-6">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex items-center gap-3 rounded-lg border border-border bg-card p-4"
          >
            <div className={`rounded-lg p-2 ${stat.bgColor}`}>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </div>
            <div className="min-w-0">
              <p className={`text-2xl font-bold tabular-nums ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
