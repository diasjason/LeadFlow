'use client'

import { Badge } from '@/components/ui/badge'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { LeadCard } from './lead-card'
import type { Lead, Stage } from '@/lib/types'
import { STAGES } from '@/lib/types'

interface PipelineViewProps {
  leads: Lead[]
  onLeadClick: (lead: Lead) => void
}

export function PipelineView({ leads, onLeadClick }: PipelineViewProps) {
  const getLeadsByStage = (stage: Stage) => {
    return leads.filter((lead) => lead.stage === stage)
  }

  return (
    <ScrollArea className="flex-1 w-full">
      <div className="flex gap-4 p-6 min-w-max">
        {STAGES.map((stage) => {
          const stageLeads = getLeadsByStage(stage.id)
          return (
            <div
              key={stage.id}
              className="w-[280px] shrink-0 flex flex-col rounded-lg bg-secondary/50 border border-border"
            >
              <div className="flex items-center justify-between p-3 border-b border-border">
                <h3 className="font-medium text-foreground text-sm">
                  {stage.label}
                </h3>
                <Badge
                  variant="secondary"
                  className="text-xs bg-muted text-muted-foreground"
                >
                  {stageLeads.length}
                </Badge>
              </div>
              <div className="flex-1 p-2 space-y-2 max-h-[calc(100vh-340px)] overflow-y-auto">
                {stageLeads.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No leads
                  </p>
                ) : (
                  stageLeads.map((lead) => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      onClick={onLeadClick}
                    />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  )
}
