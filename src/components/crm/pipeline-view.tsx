'use client'

import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { Badge } from '@/components/ui/badge'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { LeadCard } from './lead-card'
import type { Lead, Stage } from '@/lib/types'
import { STAGES } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'

interface PipelineViewProps {
  leads: Lead[]
  onLeadClick: (lead: Lead) => void
  onMoveLead: (leadId: string, newStage: Stage) => Promise<void>
}

// ─── Mobile: stage tabs ───────────────────────

function MobilePipelineView({ leads, onLeadClick }: Omit<PipelineViewProps, 'onMoveLead'>) {
  const [activeStage, setActiveStage] = useState<Stage>(STAGES[0].id)
  const stageLeads = leads.filter((l) => l.stage === activeStage)

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Stage tab bar */}
      <div className="flex gap-2 px-3 py-2 overflow-x-auto border-b border-border shrink-0 scrollbar-none">
        {STAGES.map((stage) => {
          const count = leads.filter((l) => l.stage === stage.id).length
          const isActive = stage.id === activeStage
          return (
            <button
              key={stage.id}
              onClick={() => setActiveStage(stage.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors shrink-0',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              )}
            >
              {stage.label}
              <span
                className={cn(
                  'flex items-center justify-center rounded-full w-4 h-4 text-[10px] font-semibold',
                  isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted-foreground/20'
                )}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Lead list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {stageLeads.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-16">No leads in this stage</p>
        ) : (
          stageLeads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} onClick={onLeadClick} />
          ))
        )}
      </div>
    </div>
  )
}

// ─── Desktop: draggable card ──────────────────

function DraggableCard({ lead, onClick }: { lead: Lead; onClick: (lead: Lead) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: lead.id,
    data: { lead },
  })

  return (
    <div ref={setNodeRef} {...listeners} {...attributes} className={cn('touch-none', isDragging && 'opacity-30')}>
      <LeadCard lead={lead} onClick={onClick} />
    </div>
  )
}

// ─── Desktop: droppable column ────────────────

function Column({
  stage,
  leads,
  onLeadClick,
}: {
  stage: { id: Stage; label: string }
  leads: Lead[]
  onLeadClick: (lead: Lead) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id })

  return (
    <div
      className={cn(
        'w-[280px] shrink-0 flex flex-col rounded-lg border transition-colors',
        isOver ? 'bg-primary/10 border-primary/50' : 'bg-secondary/50 border-border'
      )}
    >
      <div className="flex items-center justify-between p-3 border-b border-border">
        <h3 className="font-medium text-foreground text-sm">{stage.label}</h3>
        <Badge variant="secondary" className="text-xs bg-muted text-muted-foreground">
          {leads.length}
        </Badge>
      </div>

      <div
        ref={setNodeRef}
        className="flex-1 p-2 space-y-2 max-h-[calc(100vh-340px)] overflow-y-auto"
      >
        {leads.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8 select-none">Drop here</p>
        ) : (
          leads.map((lead) => (
            <DraggableCard key={lead.id} lead={lead} onClick={onLeadClick} />
          ))
        )}
      </div>
    </div>
  )
}

// ─── Desktop: drag-and-drop swim lanes ────────

function DesktopPipelineView({ leads, onLeadClick, onMoveLead }: PipelineViewProps) {
  const [activeLead, setActiveLead] = useState<Lead | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } })
  )

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveLead((active.data.current as { lead: Lead }).lead)
  }

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    setActiveLead(null)
    if (!over) return
    const lead = leads.find((l) => l.id === active.id)
    const newStage = over.id as Stage
    if (lead && lead.stage !== newStage) await onMoveLead(lead.id, newStage)
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveLead(null)}
    >
      <ScrollArea className="flex-1 w-full">
        <div className="flex gap-4 p-6 min-w-max">
          {STAGES.map((stage) => (
            <Column
              key={stage.id}
              stage={stage}
              leads={leads.filter((l) => l.stage === stage.id)}
              onLeadClick={onLeadClick}
            />
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      <DragOverlay dropAnimation={null}>
        {activeLead && (
          <div className="w-[272px] rotate-1 opacity-95 shadow-xl">
            <LeadCard lead={activeLead} onClick={() => {}} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

// ─── Entry point ──────────────────────────────

export function PipelineView(props: PipelineViewProps) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return <MobilePipelineView leads={props.leads} onLeadClick={props.onLeadClick} />
  }

  return <DesktopPipelineView {...props} />
}
