'use client'

import { Users, Flame, Calendar, MapPin, Trophy, XCircle } from 'lucide-react'
import type { Lead } from '@/lib/types'

interface StatsBarProps {
  leads: Lead[]
}

export function StatsBar({ leads }: StatsBarProps) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const stats = [
    {
      label: 'Total Leads',
      value: leads.filter(l => l.stage !== 'lost' && l.stage !== 'closed-won').length,
      icon: Users,
      color: 'text-foreground',
      bgColor: 'bg-secondary',
    },
    {
      label: 'Hot Leads',
      value: leads.filter(l => l.category === 'hot' && l.stage !== 'lost' && l.stage !== 'closed-won').length,
      icon: Flame,
      color: 'text-hot',
      bgColor: 'bg-hot/10',
    },
    {
      label: "Today's Follow-ups",
      value: leads.filter(l => {
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
      value: leads.filter(l => l.stage === 'visit-scheduled' || l.stage === 'visit-done').length,
      icon: MapPin,
      color: 'text-facebook',
      bgColor: 'bg-facebook/10',
    },
    {
      label: 'Closed Won',
      value: leads.filter(l => l.stage === 'closed-won').length,
      icon: Trophy,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      label: 'Lost',
      value: leads.filter(l => l.stage === 'lost').length,
      icon: XCircle,
      color: 'text-muted-foreground',
      bgColor: 'bg-muted',
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 px-6 py-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="flex items-center gap-3 p-4 rounded-lg bg-card border border-border"
        >
          <div className={`p-2 rounded-lg ${stat.bgColor}`}>
            <stat.icon className={`h-5 w-5 ${stat.color}`} />
          </div>
          <div>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
