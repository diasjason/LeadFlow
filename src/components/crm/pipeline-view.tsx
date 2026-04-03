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

// ─── Draggable card ───────────────────────────

function DraggableCard({ lead, onClick }: { lead: Lead; onClick: (lead: Lead) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: lead.id,
    data: { lead },
  })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn('touch-none', isDragging && 'opacity-30')}
    >
      <LeadCard lead={lead} onClick={onClick} />
    </div>
  )
}

// ─── Droppable column ─────────────────────────

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
          <p className="text-sm text-muted-foreground text-center py-8 select-none">
            Drop here
          </p>
        ) : (
          leads.map((lead) => (
            <DraggableCard key={lead.id} lead={lead} onClick={onLeadClick} />
          ))
        )}
      </div>
    </div>
  )
}

// ─── Pipeline view ────────────────────────────

interface PipelineViewProps {
  leads: Lead[]
  onLeadClick: (lead: Lead) => void
  onMoveLead: (leadId: string, newStage: Stage) => Promise<void>
}

export function PipelineView({ leads, onLeadClick, onMoveLead }: PipelineViewProps) {
  const [activeLead, setActiveLead] = useState<Lead | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 }, // small threshold so clicks still work
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 6 },
    })
  )

  const handleDragStart = ({ active }: DragStartEvent) => {
    const lead = (active.data.current as { lead: Lead }).lead
    setActiveLead(lead)
  }

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    setActiveLead(null)
    if (!over) return

    const leadId = active.id as string
    const newStage = over.id as Stage
    const lead = leads.find((l) => l.id === leadId)

    if (lead && lead.stage !== newStage) {
      await onMoveLead(leadId, newStage)
    }
  }

  const handleDragCancel = () => setActiveLead(null)

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
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

      {/* Floating card shown while dragging */}
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
