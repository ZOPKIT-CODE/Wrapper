import React, { ReactNode, useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { 
  MoreVertical, 
  Search, 
  ChevronDown,
  ChevronUp,
  ArrowUpDown
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface DataTableColumn<T = any> {
  key: string
  label: string
  sortable?: boolean
  searchable?: boolean
  render?: (item: T, index: number) => ReactNode
  width?: string
  className?: string
}

export interface DataTableAction<T = any> {
  key: string
  label: string
  icon: React.ElementType
  onClick: (item: T) => void
  disabled?: (item: T) => boolean
  variant?: 'default' | 'destructive' | 'secondary'
  separator?: boolean
}

export interface DataTableProps<T = any> {
  data: T[]
  columns: DataTableColumn<T>[]
  actions?: DataTableAction<T>[]
  searchable?: boolean
  selectable?: boolean
  selectedItems?: Set<string>
  onSelectionChange?: (selectedItems: Set<string>) => void
  getItemId: (item: T) => string
  loading?: boolean
  emptyMessage?: string
  className?: string
  pageSize?: number
  searchPlaceholder?: string
  title?: string
  description?: string
  onRefresh?: () => void
}

export function DataTable<T = any>({
  data,
  columns,
  actions = [],
  searchable = true,
  selectable = false,
  selectedItems = new Set(),
  onSelectionChange,
  getItemId,
  loading = false,
  emptyMessage = 'No data available',
  className,
  pageSize = 10,
  searchPlaceholder = 'Search...',
  title,
  description,
  onRefresh
}: DataTableProps<T>) {
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [currentPage, setCurrentPage] = useState(1)

  // Handle sorting
  const handleSort = (columnKey: string) => {
    if (sortBy === columnKey) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(columnKey)
      setSortOrder('asc')
    }
  }

  // Filter and sort data
  const filteredData = React.useMemo(() => {
    let filtered = data

    // Apply search filter
    if (search) {
      filtered = data.filter(item => {
        return columns.some(column => {
          if (!column.searchable) return false
          const value = (item as any)[column.key]
          return value && value.toString().toLowerCase().includes(search.toLowerCase())
        })
      })
    }

    // Apply sorting
    if (sortBy) {
      filtered = [...filtered].sort((a, b) => {
        const aVal = (a as any)[sortBy]
        const bVal = (b as any)[sortBy]
        
        if (sortOrder === 'asc') {
          return aVal > bVal ? 1 : -1
        } else {
          return aVal < bVal ? 1 : -1
        }
      })
    }

    return filtered
  }, [data, search, sortBy, sortOrder, columns])

  // Pagination
  const totalPages = Math.ceil(filteredData.length / pageSize)
  const paginatedData = filteredData.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  )

  // Selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (!onSelectionChange) return
    
    if (checked) {
      onSelectionChange(new Set(paginatedData.map(getItemId)))
    } else {
      onSelectionChange(new Set())
    }
  }

  const handleSelectItem = (itemId: string, checked: boolean) => {
    if (!onSelectionChange) return
    
    const newSelection = new Set(selectedItems)
    if (checked) {
      newSelection.add(itemId)
    } else {
      newSelection.delete(itemId)
    }
    onSelectionChange(newSelection)
  }

  const isAllSelected = paginatedData.length > 0 && 
    paginatedData.every(item => selectedItems.has(getItemId(item)))
  const isPartiallySelected = paginatedData.some(item => selectedItems.has(getItemId(item))) && !isAllSelected

  if (loading) {
    return (
      <div className={cn("space-y-4", className)}>
        {title && (
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            {description && <Skeleton className="h-4 w-96" />}
          </div>
        )}
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      {(title || description) && (
        <div>
          {title && <h3 className="text-lg font-semibold">{title}</h3>}
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {searchable && (
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 w-64"
              />
            </div>
          )}
          {selectedItems.size > 0 && (
            <Badge variant="secondary">
              {selectedItems.size} selected
            </Badge>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          {onRefresh && (
            <Button variant="outline" size="sm" onClick={onRefresh}>
              Refresh
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {selectable && (
                <TableHead className="w-12">
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={handleSelectAll}
                    aria-label="Select all"
                    className={isPartiallySelected ? 'data-[state=checked]:bg-blue-500' : ''}
                  />
                </TableHead>
              )}
              
              {columns.map((column) => (
                <TableHead 
                  key={column.key}
                  className={cn(column.className)}
                  style={{ width: column.width }}
                >
                  {column.sortable ? (
                    <Button
                      variant="ghost"
                      onClick={() => handleSort(column.key)}
                      className="h-auto p-0 font-medium hover:bg-transparent"
                    >
                      {column.label}
                      {sortBy === column.key ? (
                        sortOrder === 'asc' ? (
                          <ChevronUp className="ml-2 h-4 w-4" />
                        ) : (
                          <ChevronDown className="ml-2 h-4 w-4" />
                        )
                      ) : (
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                      )}
                    </Button>
                  ) : (
                    column.label
                  )}
                </TableHead>
              ))}
              
              {actions.length > 0 && (
                <TableHead className="w-16">Actions</TableHead>
              )}
            </TableRow>
          </TableHeader>
          
          <TableBody>
            {paginatedData.length === 0 ? (
              <TableRow>
                <TableCell 
                  colSpan={columns.length + (selectable ? 1 : 0) + (actions.length > 0 ? 1 : 0)}
                  className="h-24 text-center"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((item, index) => {
                const itemId = getItemId(item)
                const isSelected = selectedItems.has(itemId)
                
                return (
                  <TableRow key={itemId} className={isSelected ? 'bg-muted/50' : ''}>
                    {selectable && (
                      <TableCell>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => handleSelectItem(itemId, checked as boolean)}
                          aria-label={`Select item ${itemId}`}
                        />
                      </TableCell>
                    )}
                    
                    {columns.map((column) => (
                      <TableCell key={column.key} className={column.className}>
                        {column.render ? (
                          column.render(item, index)
                        ) : (
                          (item as any)[column.key]
                        )}
                      </TableCell>
                    ))}
                    
                    {actions.length > 0 && (
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            
                            {actions.map((action, actionIndex) => (
                              <React.Fragment key={action.key}>
                                {action.separator && actionIndex > 0 && <DropdownMenuSeparator />}
                                <DropdownMenuItem
                                  onClick={() => action.onClick(item)}
                                  disabled={action.disabled?.(item)}
                                  className={action.variant === 'destructive' ? 'text-red-600' : ''}
                                >
                                  <action.icon className="mr-2 h-4 w-4" />
                                  {action.label}
                                </DropdownMenuItem>
                              </React.Fragment>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredData.length)} of {filteredData.length} results
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <div className="flex items-center space-x-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const page = i + Math.max(1, currentPage - 2)
                return (
                  <Button
                    key={page}
                    variant={currentPage === page ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </Button>
                )
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
} 