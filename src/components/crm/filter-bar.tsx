'use client'

import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { SOURCES, CATEGORIES } from '@/lib/types'

export type ViewMode = 'pipeline' | 'table' | 'followups'

interface FilterBarProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  sourceFilter: string
  onSourceChange: (source: string) => void
  categoryFilter: string
  onCategoryChange: (category: string) => void
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
}

export function FilterBar({
  searchQuery,
  onSearchChange,
  sourceFilter,
  onSourceChange,
  categoryFilter,
  onCategoryChange,
  viewMode,
  onViewModeChange,
}: FilterBarProps) {
  return (
    <div className="flex min-w-0 max-w-full flex-wrap items-center gap-3 border-b border-border px-3 py-3 sm:gap-4 sm:px-4 md:px-6 md:py-4">
      <div className="relative min-w-0 max-w-full flex-1 basis-full sm:min-w-[200px] sm:max-w-sm sm:basis-auto">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or phone..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 bg-secondary border-border"
        />
      </div>

      <Select value={sourceFilter} onValueChange={onSourceChange}>
        <SelectTrigger className="w-[160px] bg-secondary border-border">
          <SelectValue placeholder="All Sources" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Sources</SelectItem>
          {SOURCES.map((source) => (
            <SelectItem key={source.id} value={source.id}>
              {source.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={categoryFilter} onValueChange={onCategoryChange}>
        <SelectTrigger className="w-[140px] bg-secondary border-border">
          <SelectValue placeholder="All Categories" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Categories</SelectItem>
          {CATEGORIES.map((category) => (
            <SelectItem key={category.id} value={category.id}>
              {category.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="ml-auto">
        <ToggleGroup
          type="single"
          value={viewMode}
          onValueChange={(value) => value && onViewModeChange(value as ViewMode)}
          className="bg-secondary rounded-lg p-1"
        >
          <ToggleGroupItem
            value="pipeline"
            className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground px-4 text-sm"
          >
            Pipeline
          </ToggleGroupItem>
          <ToggleGroupItem
            value="table"
            className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground px-4 text-sm"
          >
            Table
          </ToggleGroupItem>
          <ToggleGroupItem
            value="followups"
            className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground px-4 text-sm"
          >
            Follow-ups
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
    </div>
  )
}
