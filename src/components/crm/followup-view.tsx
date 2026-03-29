'use client'

import { Phone, AlertCircle, Clock, CalendarCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Lead, Category } from '@/lib/types'
import { cn, formatDate } from '@/lib/utils'

interface FollowupViewProps {
  leads: Lead[]
  onLeadClick: (lead: Lead) => void
}

const categoryStyles: Record<Category, string> = {
  hot: 'bg-hot/20 text-hot border-hot/30',
  warm: 'bg-warm/20 text-warm border-warm/30',
  cold: 'bg-cold/20 text-cold border-cold/30',
}

const categoryLabels: Record<Category, string> = {
  hot: 'Hot',
  warm: 'Warm',
  cold: 'Cold',
}

export function FollowupView({ leads, onLeadClick }: FollowupViewProps) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const leadsWithFollowUp = leads.filter(
    (lead) =>
      lead.nextFollowUp &&
      lead.stage !== 'lost' &&
      lead.stage !== 'closed-won'
  )

  const overdue = leadsWithFollowUp.filter((lead) => {
    const followUp = new Date(lead.nextFollowUp!)
    followUp.setHours(0, 0, 0, 0)
    return followUp < today
  })

  const dueToday = leadsWithFollowUp.filter((lead) => {
    const followUp = new Date(lead.nextFollowUp!)
    followUp.setHours(0, 0, 0, 0)
    return followUp.getTime() === today.getTime()
  })

  const upcoming = leadsWithFollowUp.filter((lead) => {
    const followUp = new Date(lead.nextFollowUp!)
    followUp.setHours(0, 0, 0, 0)
    return followUp >= tomorrow
  })

  const sections = [
    {
      title: 'Overdue',
      leads: overdue,
      icon: AlertCircle,
      color: 'text-hot',
      bgColor: 'bg-hot/10',
      borderColor: 'border-hot/30',
    },
    {
      title: 'Due Today',
      leads: dueToday,
      icon: Clock,
      color: 'text-warm',
      bgColor: 'bg-warm/10',
      borderColor: 'border-warm/30',
    },
    {
      title: 'Upcoming',
      leads: upcoming,
      icon: CalendarCheck,
      color: 'text-success',
      bgColor: 'bg-success/10',
      borderColor: 'border-success/30',
    },
  ]

  return (
    <div className="flex-1 p-6 overflow-auto">
      <div className="grid gap-6 md:grid-cols-3">
        {sections.map((section) => (
          <div
            key={section.title}
            className={cn(
              'rounded-lg border p-4',
              section.borderColor,
              section.bgColor
            )}
          >
            <div className="flex items-center gap-2 mb-4">
              <section.icon className={cn('h-5 w-5', section.color)} />
              <h3 className={cn('font-semibold', section.color)}>
                {section.title}
              </h3>
              <Badge
                variant="secondary"
                className={cn('ml-auto', section.bgColor, section.color)}
              >
                {section.leads.length}
              </Badge>
            </div>

            <div className="space-y-3">
              {section.leads.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No follow-ups
                </p>
              ) : (
                section.leads.map((lead) => (
                  <div
                    key={lead.id}
                    onClick={() => onLeadClick(lead)}
                    className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border cursor-pointer hover:border-primary/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-foreground truncate">
                        {lead.name}
                      </h4>
                      <p className="text-sm text-muted-foreground truncate">
                        {lead.phone}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">
                          Attempt {lead.attempts + 1}/6
                        </span>
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-xs px-1.5 py-0',
                            categoryStyles[lead.category]
                          )}
                        >
                          {categoryLabels[lead.category]}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-xs text-muted-foreground">
                        {lead.nextFollowUp && formatDate(lead.nextFollowUp)}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 text-xs"
                        onClick={(e) => {
                          e.stopPropagation()
                          // Call action would go here
                        }}
                      >
                        <Phone className="h-3 w-3" />
                        Call
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
