import React, { ReactNode, useState, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  ColumnDef,
  flexRender,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  FilterFn,
} from '@tanstack/react-table';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuCheckboxItem } from '@/components/ui/dropdown-menu';
import { MoreVertical, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search, Filter, X } from 'lucide-react';

export interface TableColumn<T = any> {
  key: string;
  label: string;
  width?: string;
  render?: (item: T) => ReactNode;
  sortable?: boolean;
  filterable?: boolean;
  filterFn?: FilterFn<T>;
  cell?: (props: any) => ReactNode;
}

export interface TableAction<T = any> {
  key: string;
  label: string | ((item: T) => string);
  icon: React.ElementType;
  onClick: (item: T) => void;
  disabled?: (item: T) => boolean;
  destructive?: boolean;
  separator?: boolean;
  variant?: 'ghost' | 'default' | 'destructive' | 'outline' | 'secondary' | 'link';
  className?: string;
}

export interface TableFilter {
  key: string;
  label: string;
  type: 'text' | 'select' | 'multiselect';
  options?: { value: string; label: string }[];
  placeholder?: string;
}

export interface ReusableTableProps<T = any> {
  data: T[];
  columns: TableColumn<T>[];
  actions?: TableAction<T>[];
  filters?: TableFilter[];
  selectable?: boolean;
  selectedItems?: Set<string>;
  onSelectionChange?: (selectedItems: Set<string>) => void;
  getItemId: (item: T) => string;
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
  enablePagination?: boolean;
  pageSize?: number;
  enableColumnVisibility?: boolean;
  enableGlobalSearch?: boolean;
  searchPlaceholder?: string;
  title?: string;
}

export function ReusableTable<T = any>({
  data,
  columns,
  actions = [],
  filters = [],
  selectable = false,
  selectedItems,
  onSelectionChange,
  getItemId,
  loading = false,
  emptyMessage = 'No data available',
  className = '',
  enablePagination = true,
  pageSize = 10,
  enableColumnVisibility = true,
  enableGlobalSearch = true,
  searchPlaceholder = 'Search...',
  title
}: ReusableTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});
  const [globalFilter, setGlobalFilter] = useState('');

  // Convert legacy columns to TanStack columns
  const tableColumns = useMemo<ColumnDef<T>[]>(() => {
    const cols: ColumnDef<T>[] = [];

    // Selection column
    if (selectable) {
      cols.push({
        id: 'select',
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
          />
        ),
        enableSorting: false,
        enableHiding: false,
        size: 40,
      });
    }

    // Data columns
    columns.forEach((column) => {
      cols.push({
        accessorKey: column.key,
        header: column.label,
        cell: column.cell || (({ getValue, row }) => {
          const value = getValue();
          return column.render ? column.render(row.original) : (
            <span className="truncate block">{String(value || '')}</span>
          );
        }),
        size: column.width ? parseInt(column.width) : undefined,
        enableSorting: column.sortable !== false,
        enableColumnFilter: column.filterable !== false,
        filterFn: column.filterFn,
      });
    });

    // Actions column
    if (actions.length > 0) {
      cols.push({
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="bottom" className="z-50">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />

              {actions.map((action, index) => (
                <React.Fragment key={action.key}>
                  {action.separator && index > 0 && <DropdownMenuSeparator />}
                  <DropdownMenuItem
                    onClick={() => action.onClick(row.original)}
                    disabled={action.disabled?.(row.original)}
                    className={action.destructive ? 'text-red-600 hover:text-red-700 hover:bg-red-50' : ''}
                  >
                    <action.icon className="w-4 h-4 mr-2" />
                    {typeof action.label === 'function' ? action.label(row.original) : action.label}
                  </DropdownMenuItem>
                </React.Fragment>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ),
        enableSorting: false,
        enableHiding: false,
        size: 64,
      });
    }

    return cols;
  }, [columns, actions, selectable]);

  const table = useReactTable({
    data,
    columns: tableColumns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: enablePagination ? getPaginationRowModel() : undefined,
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: 'includesString',
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter,
      pagination: enablePagination ? {
        pageIndex: 0,
        pageSize,
      } : undefined,
    },
  });

  // Sync row selection with external state - only if selectable and onSelectionChange provided
  const onSelectionChangeRef = React.useRef(onSelectionChange);
  const getItemIdRef = React.useRef(getItemId);
  const lastSelectedIdsRef = React.useRef<Set<string> | null>(null);
  const tableRef = React.useRef(table);

  React.useEffect(() => {
    onSelectionChangeRef.current = onSelectionChange;
    getItemIdRef.current = getItemId;
    tableRef.current = table;
  });

  React.useEffect(() => {
    // Only sync selection if selectable is enabled, onSelectionChange is provided,
    // AND selectedItems is not provided (to avoid conflict with useSelectableTable)
    if (onSelectionChangeRef.current && selectable && !selectedItems) {
      const selectedIds = new Set(
        table.getFilteredSelectedRowModel().rows.map(row => getItemIdRef.current(row.original))
      );

      // Only call onSelectionChange if the selection actually changed
      const lastSelectedIds = lastSelectedIdsRef.current;
      const hasChanged = !lastSelectedIds ||
        selectedIds.size !== lastSelectedIds.size ||
        [...selectedIds].some(id => !lastSelectedIds.has(id)) ||
        [...lastSelectedIds].some(id => !selectedIds.has(id));

      if (hasChanged) {
        lastSelectedIdsRef.current = selectedIds;
        onSelectionChangeRef.current(selectedIds);
      }
    }
  }, [rowSelection, selectable, selectedItems]);

  // Initialize row selection when selectedItems is provided (for useSelectableTable compatibility)
  React.useEffect(() => {
    if (selectable && selectedItems && Object.keys(rowSelection).length === 0) {
      const initialRowSelection: Record<string, boolean> = {};
      tableRef.current.getFilteredRowModel().rows.forEach((row, index) => {
        const itemId = getItemIdRef.current(row.original);
        if (selectedItems.has(itemId)) {
          initialRowSelection[index.toString()] = true;
        }
      });
      if (Object.keys(initialRowSelection).length > 0) {
        tableRef.current.setState((old) => ({ ...old, rowSelection: initialRowSelection }));
      }
    }
  }, [selectedItems, selectable]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
          </div>
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500 dark:text-white text-lg">{emptyMessage}</div>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 ${className}`}>
      {/* Header */}
      {(title || enableGlobalSearch || enableColumnVisibility || filters.length > 0) && (
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          {title && (
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[#1B2E5A] dark:text-white">{title}</h3>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4">
            {/* Global Search */}
            {enableGlobalSearch && (
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder={searchPlaceholder}
                  value={globalFilter ?? ''}
                  onChange={(event) => setGlobalFilter(String(event.target.value))}
                  className="pl-10"
                />
                {globalFilter && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setGlobalFilter('')}
                    className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            )}

            {/* Column Filters */}
            {filters.map((filter) => (
              <div key={filter.key} className="min-w-[200px]">
                {filter.type === 'select' && (
                  <Select
                    value={(table.getColumn(filter.key)?.getFilterValue() as string) ?? '__all__'}
                    onValueChange={(value) => table.getColumn(filter.key)?.setFilterValue(value === '__all__' ? '' : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={filter.placeholder || `Filter by ${filter.label}`} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All</SelectItem>
                      {filter.options?.filter(option => option && option.value && option.value.trim() !== '' && option.label).map((option, index) => (
                        <SelectItem key={`${filter.key}-${option.value}-${index}`} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {filter.type === 'text' && (
                  <Input
                    placeholder={filter.placeholder || `Filter by ${filter.label}`}
                    value={(table.getColumn(filter.key)?.getFilterValue() as string) ?? ''}
                    onChange={(event) => table.getColumn(filter.key)?.setFilterValue(event.target.value)}
                  />
                )}
              </div>
            ))}

            {/* Column Visibility */}
            {enableColumnVisibility && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Filter className="w-4 h-4 mr-2" />
                    Columns
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {table
                    .getAllColumns()
                    .filter((column) => column.getCanHide())
                    .map((column) => (
                      <DropdownMenuCheckboxItem
                        key={column.id}
                        checked={column.getIsVisible()}
                        onCheckedChange={(value) => column.toggleVisibility(!!value)}
                      >
                        {column.id}
                      </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gradient-to-r from-sky-50 to-blue-50 border-b border-sky-100">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="p-4 text-left font-black text-sky-900 uppercase tracking-wider text-[10px]"
                    style={{ width: header.getSize() }}
                  >
                    {header.isPlaceholder ? null : (
                      <div
                        className={header.column.getCanSort() ? 'cursor-pointer select-none flex items-center gap-2' : ''}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}

                      </div>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors border-b border-gray-200 dark:border-gray-700 last:border-b-0"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="p-4">
                      <div className="min-w-0">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </div>
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={tableColumns.length} className="p-8 text-center text-gray-500 dark:text-white">
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {enablePagination && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-white">
            <span>
              Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} to{' '}
              {Math.min(
                (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                table.getFilteredRowModel().rows.length
              )} of {table.getFilteredRowModel().rows.length} results
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Select
              value={String(table.getState().pagination.pageSize)}
              onValueChange={(value) => table.setPageSize(Number(value))}
            >
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 20, 30, 40, 50].map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
              >
                <ChevronsLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm text-gray-700 dark:text-white px-2">
                {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
              >
                <ChevronsRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ReusableTable; 