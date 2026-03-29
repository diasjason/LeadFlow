'use client'

import { Calendar, MessageCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { Lead, Category, Source } from '@/lib/types'
import { cn, formatDate } from '@/lib/utils'

interface LeadCardProps {
  lead: Lead
  onClick: (lead: Lead) => void
}

const categoryStyles: Record<Category, string> = {
  hot: 'bg-hot/20 text-hot border-hot/30',
  warm: 'bg-warm/20 text-warm border-warm/30',
  cold: 'bg-cold/20 text-cold border-cold/30',
}

const sourceStyles: Record<Source, string> = {
  facebook: 'bg-facebook/20 text-facebook border-facebook/30',
  instagram: 'bg-instagram/20 text-instagram border-instagram/30',
  referral: 'bg-referral/20 text-referral border-referral/30',
  excel: 'bg-excel/20 text-excel border-excel/30',
}

const sourceLabels: Record<Source, string> = {
  facebook: 'FB',
  instagram: 'IG',
  referral: 'Ref',
  excel: 'Excel',
}

const categoryLabels: Record<Category, string> = {
  hot: 'Hot',
  warm: 'Warm',
  cold: 'Cold',
}

export function LeadCard({ lead, onClick }: LeadCardProps) {
  return (
    <div
      onClick={() => onClick(lead)}
      className="p-3 rounded-lg bg-card border border-border hover:border-primary/50 cursor-pointer transition-colors"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-foreground truncate flex items-center gap-1.5">
            {lead.name}
            {lead.whatsAppSent && (
              <MessageCircle className="h-3.5 w-3.5 text-success shrink-0" />
            )}
          </h4>
          <p className="text-sm text-muted-foreground truncate">{lead.phone}</p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap mb-2">
        <Badge
          variant="outline"
          className={cn('text-xs px-1.5 py-0', categoryStyles[lead.category])}
        >
          {categoryLabels[lead.category]}
        </Badge>
        <Badge
          variant="outline"
          className={cn('text-xs px-1.5 py-0', sourceStyles[lead.source])}
        >
          {sourceLabels[lead.source]}
        </Badge>
      </div>

      {lead.nextFollowUp && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          <span>Follow-up: {formatDate(lead.nextFollowUp)}</span>
        </div>
      )}
    </div>
  )
}
