import { Search, X } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RoleFilters as RoleFiltersType } from '@/types/role-management'

interface RoleFiltersProps {
  filters: RoleFiltersType
  onFiltersChange: (filters: Partial<RoleFiltersType>) => void
  onClearFilters: () => void
  totalCount: number
  filteredCount: number
}

export function RoleFilters({
  filters,
  onFiltersChange,
  onClearFilters,
  totalCount,
  filteredCount,
}: RoleFiltersProps) {
  const hasActiveFilters = filters.searchQuery || filters.typeFilter !== 'all'

  return (
    <Card>
      <CardContent className="space-y-6 p-6">
        {/* Search Bar */}
        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="flex-1 space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Search Roles
            </label>
            <div className="relative">
              <Search className="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 transform text-gray-400" />
              <Input
                placeholder="Search by role name, description, or department..."
                value={filters.searchQuery}
                onChange={(e) =>
                  onFiltersChange({ searchQuery: e.target.value })
                }
                className="pl-11"
              />
            </div>
          </div>

          <div className="flex flex-shrink-0 items-end">
            <Button
              variant="outline"
              onClick={onClearFilters}
              className="gap-2"
            >
              <X className="h-4 w-4" />
              Clear All
            </Button>
          </div>
        </div>

        {/* Filter Row */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Role Type
            </label>
            <Select
              value={filters.typeFilter}
              onValueChange={(value: 'all' | 'custom' | 'system') =>
                onFiltersChange({ typeFilter: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="custom">Custom Roles</SelectItem>
                <SelectItem value="system">System Roles</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Sort By</label>
            <Select
              value={`${filters.sortBy}-${filters.sortOrder}`}
              onValueChange={(value: string) => {
                const [field, order] = value.split('-')
                onFiltersChange({
                  sortBy: field as RoleFiltersType['sortBy'],
                  sortOrder: order as RoleFiltersType['sortOrder'],
                })
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name-asc">Name A-Z</SelectItem>
                <SelectItem value="name-desc">Name Z-A</SelectItem>
                <SelectItem value="created-desc">Newest First</SelectItem>
                <SelectItem value="created-asc">Oldest First</SelectItem>
                <SelectItem value="users-desc">Most Users</SelectItem>
                <SelectItem value="users-asc">Least Users</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end">
            <Button
              variant="outline"
              onClick={onClearFilters}
              className="w-full"
            >
              Reset Filters
            </Button>
          </div>
        </div>

        {/* Results Summary */}
        <div className="flex items-center justify-between border-t pt-4">
          <div className="text-sm text-gray-600">
            Showing {filteredCount} of {totalCount} roles
          </div>

          {/* Active Filters Display */}
          {hasActiveFilters && (
            <div className="flex flex-wrap gap-2">
              <span className="text-sm font-medium text-gray-600">
                Active filters:
              </span>
              {filters.searchQuery && (
                <Badge variant="secondary" className="gap-1">
                  Search: "{filters.searchQuery}"
                  <button
                    onClick={() => onFiltersChange({ searchQuery: '' })}
                    className="ml-1 hover:text-red-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {filters.typeFilter !== 'all' && (
                <Badge variant="secondary" className="gap-1">
                  Type: {filters.typeFilter}
                  <button
                    onClick={() => onFiltersChange({ typeFilter: 'all' })}
                    className="ml-1 hover:text-red-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
