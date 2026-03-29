'use client'

import { MessageCircle, MoreHorizontal } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Lead, Category, Source, Stage } from '@/lib/types'
import { STAGES } from '@/lib/types'
import { cn, formatDate } from '@/lib/utils'

interface TableViewProps {
  leads: Lead[]
  onLeadClick: (lead: Lead) => void
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
  facebook: 'Facebook',
  instagram: 'Instagram',
  referral: 'Referral',
  excel: 'Excel',
}

const categoryLabels: Record<Category, string> = {
  hot: 'Hot',
  warm: 'Warm',
  cold: 'Cold',
}

const getStageLabel = (stage: Stage): string => {
  const stageObj = STAGES.find(s => s.id === stage)
  return stageObj?.label || stage
}

const getAttemptsColor = (attempts: number): string => {
  if (attempts <= 2) return 'text-success'
  if (attempts <= 4) return 'text-warm'
  return 'text-hot'
}

export function TableView({ leads, onLeadClick }: TableViewProps) {
  // Filter out lost and closed-won leads for table view
  const activeLeads = leads.filter(
    (lead) => lead.stage !== 'lost' && lead.stage !== 'closed-won'
  )

  return (
    <div className="flex-1 p-6 overflow-auto">
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/50 hover:bg-secondary/50">
              <TableHead className="text-muted-foreground">Name</TableHead>
              <TableHead className="text-muted-foreground">Phone</TableHead>
              <TableHead className="text-muted-foreground">Source</TableHead>
              <TableHead className="text-muted-foreground">Category</TableHead>
              <TableHead className="text-muted-foreground">Stage</TableHead>
              <TableHead className="text-muted-foreground">Attempts</TableHead>
              <TableHead className="text-muted-foreground">Last Contact</TableHead>
              <TableHead className="text-muted-foreground">Next Follow-up</TableHead>
              <TableHead className="text-muted-foreground w-[60px]">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activeLeads.map((lead, index) => (
              <TableRow
                key={lead.id}
                onClick={() => onLeadClick(lead)}
                className={cn(
                  'cursor-pointer transition-colors',
                  index % 2 === 0 ? 'bg-card' : 'bg-secondary/20'
                )}
              >
                <TableCell className="font-medium">
                  <div className="flex items-center gap-1.5">
                    {lead.name}
                    {lead.whatsAppSent && (
                      <MessageCircle className="h-3.5 w-3.5 text-success" />
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{lead.phone}</TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={cn('text-xs', sourceStyles[lead.source])}
                  >
                    {sourceLabels[lead.source]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={cn('text-xs', categoryStyles[lead.category])}
                  >
                    {categoryLabels[lead.category]}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {getStageLabel(lead.stage)}
                </TableCell>
                <TableCell>
                  <span className={cn('font-medium', getAttemptsColor(lead.attempts))}>
                    {lead.attempts}/6
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(lead.lastContact)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(lead.nextFollowUp)}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon-sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onLeadClick(lead)}>
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem>Follow Up</DropdownMenuItem>
                      <DropdownMenuItem>Schedule Visit</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
