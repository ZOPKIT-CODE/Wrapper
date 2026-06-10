import { Search, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RoleFilters as RoleFiltersType } from '@/types/role-management';

interface RoleFiltersProps {
  filters: RoleFiltersType;
  onFiltersChange: (filters: Partial<RoleFiltersType>) => void;
  onClearFilters: () => void;
  totalCount: number;
  filteredCount: number;
}

export function RoleFilters({
  filters,
  onFiltersChange,
  onClearFilters,
  totalCount,
  filteredCount,
}: RoleFiltersProps) {
  const hasActiveFilters = filters.searchQuery || filters.typeFilter !== 'all';

  return (
    <Card>
      <CardContent className="p-6 space-y-6">
        {/* Search Bar */}
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 space-y-2">
            <label className="text-sm font-medium text-gray-700">Search Roles</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                placeholder="Search by role name, description, or department..."
                value={filters.searchQuery}
                onChange={(e) => onFiltersChange({ searchQuery: e.target.value })}
                className="pl-11"
              />
            </div>
          </div>
          
          <div className="flex-shrink-0 flex items-end">
            <Button
              variant="outline"
              onClick={onClearFilters}
              className="gap-2"
            >
              <X className="w-4 h-4" />
              Clear All
            </Button>
          </div>
        </div>
        
        {/* Filter Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Role Type</label>
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
                const [field, order] = value.split('-');
                onFiltersChange({ 
                  sortBy: field as any, 
                  sortOrder: order as any 
                });
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
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-sm text-gray-600">
            Showing {filteredCount} of {totalCount} roles
          </div>
          
          {/* Active Filters Display */}
          {hasActiveFilters && (
            <div className="flex flex-wrap gap-2">
              <span className="text-sm font-medium text-gray-600">Active filters:</span>
              {filters.searchQuery && (
                <Badge variant="secondary" className="gap-1">
                  Search: "{filters.searchQuery}"
                  <button
                    onClick={() => onFiltersChange({ searchQuery: '' })}
                    className="ml-1 hover:text-red-600"
                  >
                    <X className="w-3 h-3" />
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
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
