'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Header } from './header'
import { StatsBar } from './stats-bar'
import { FilterBar, type ViewMode } from './filter-bar'
import { PipelineView } from './pipeline-view'
import { TableView } from './table-view'
import { FollowupView } from './followup-view'
import { AddLeadModal } from './add-lead-modal'
import { LeadDetailModal } from './lead-detail-modal'
import { BroadcastModal } from './broadcast-modal'
import { ImportModal } from './import-modal'
import { OrganizationSettingsModal } from './organization-settings-modal'
import type { Lead } from '@/lib/types'

type NewLeadInput = Omit<
  Lead,
  'id' | 'createdAt' | 'documents' | 'attempts' | 'whatsAppSent'
>

const LEADS_QUERY_KEY = ['leads']

async function fetchLeads(): Promise<Lead[]> {
  const response = await fetch('/api/leads')
  if (!response.ok) {
    throw new Error('Failed to load leads')
  }

  return response.json()
}

async function createLead(newLead: NewLeadInput): Promise<Lead> {
  const response = await fetch('/api/leads', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(newLead),
  })

  if (!response.ok) {
    throw new Error('Failed to create lead')
  }

  return response.json()
}

async function updateLead({
  id,
  updates,
}: {
  id: string
  updates: Partial<Lead>
}): Promise<Lead> {
  const response = await fetch(`/api/leads/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  })

  if (!response.ok) {
    throw new Error('Failed to update lead')
  }

  return response.json()
}

export function Dashboard() {
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('pipeline')
  const [searchQuery, setSearchQuery] = useState('')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const queryClient = useQueryClient()

  // Modal states
  const [addLeadOpen, setAddLeadOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [broadcastOpen, setBroadcastOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const { data: leads = [], isLoading } = useQuery({
    queryKey: LEADS_QUERY_KEY,
    queryFn: fetchLeads,
  })

  const createLeadMutation = useMutation({
    mutationFn: createLead,
    onSuccess: (createdLead) => {
      queryClient.setQueryData<Lead[]>(LEADS_QUERY_KEY, (previous = []) => [
        createdLead,
        ...previous,
      ])
    },
  })

  const updateLeadMutation = useMutation({
    mutationFn: updateLead,
    onSuccess: (updatedLead) => {
      queryClient.setQueryData<Lead[]>(LEADS_QUERY_KEY, (previous = []) =>
        previous.map((lead) => (lead.id === updatedLead.id ? updatedLead : lead))
      )
    },
  })

  const selectedLead =
    selectedLeadId ? leads.find((lead) => lead.id === selectedLeadId) ?? null : null

  // Filter leads based on search and filters
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesName = lead.name.toLowerCase().includes(query)
        const matchesPhone = lead.phone.toLowerCase().includes(query)
        if (!matchesName && !matchesPhone) return false
      }

      // Source filter
      if (sourceFilter !== 'all' && lead.source !== sourceFilter) return false

      // Category filter
      if (categoryFilter !== 'all' && lead.category !== categoryFilter) return false

      return true
    })
  }, [leads, searchQuery, sourceFilter, categoryFilter])

  const handleLeadClick = (lead: Lead) => {
    setSelectedLeadId(lead.id)
    setDetailOpen(true)
  }

  const handleAddLead = async (
    newLead: NewLeadInput
  ) => {
    await createLeadMutation.mutateAsync(newLead)
  }

  const handleUpdateLead = async (id: string, updates: Partial<Lead>) => {
    await updateLeadMutation.mutateAsync({ id, updates })
  }

  const handleImportComplete = (count: number) => {
    // In a real app, this would add the imported leads
    // For now, we'll just close the modal and show a toast
    console.log(`Imported ${count} leads`)
  }

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <Header
        onNewLead={() => setAddLeadOpen(true)}
        onBroadcast={() => setBroadcastOpen(true)}
        onImport={() => setImportOpen(true)}
        onSettings={() => setSettingsOpen(true)}
      />

      <StatsBar leads={leads} />

      <FilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        sourceFilter={sourceFilter}
        onSourceChange={setSourceFilter}
        categoryFilter={categoryFilter}
        onCategoryChange={setCategoryFilter}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      <main className="flex-1 overflow-hidden">
        {isLoading && (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Loading leads...
          </div>
        )}
        {!isLoading && (createLeadMutation.isError || updateLeadMutation.isError) && (
          <div className="px-4 py-2 text-sm text-hot">Unable to persist latest change. Please retry.</div>
        )}
        {!isLoading && viewMode === 'pipeline' && (
          <PipelineView leads={filteredLeads} onLeadClick={handleLeadClick} />
        )}
        {!isLoading && viewMode === 'table' && (
          <TableView leads={filteredLeads} onLeadClick={handleLeadClick} />
        )}
        {!isLoading && viewMode === 'followups' && (
          <FollowupView leads={filteredLeads} onLeadClick={handleLeadClick} />
        )}
      </main>

      {/* Modals */}
      <AddLeadModal
        open={addLeadOpen}
        onOpenChange={setAddLeadOpen}
        onAddLead={handleAddLead}
      />

      <LeadDetailModal
        lead={selectedLead}
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open)
          if (!open) {
            setSelectedLeadId(null)
          }
        }}
        onUpdateLead={handleUpdateLead}
      />

      <BroadcastModal
        open={broadcastOpen}
        onOpenChange={setBroadcastOpen}
        leads={leads}
      />

      <ImportModal
        open={importOpen}
        onOpenChange={setImportOpen}
        onImportComplete={handleImportComplete}
      />

      <OrganizationSettingsModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      />
    </div>
  )
}
