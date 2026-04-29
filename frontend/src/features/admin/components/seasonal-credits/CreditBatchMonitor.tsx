import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, AlertTriangle, Trash2, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import {
  useActiveBatches,
  useExpiredHistory,
  useBulkExpire,
  type BatchRecord,
} from '../../hooks/useSeasonalCredits';

const URGENCY_COLORS = (daysLeft: number) => {
  if (daysLeft <= 1) return 'bg-red-100 text-red-800';
  if (daysLeft <= 3) return 'bg-orange-100 text-orange-800';
  if (daysLeft <= 7) return 'bg-yellow-100 text-yellow-800';
  return 'bg-green-100 text-green-800';
};

interface Props {
  mode: 'active' | 'expired';
}

export function CreditBatchMonitor({ mode }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creditTypeFilter, setCreditTypeFilter] = useState('all');
  const [tenantFilter, setTenantFilter] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const filters = {
    creditType: creditTypeFilter !== 'all' ? creditTypeFilter : undefined,
    tenantId: tenantFilter || undefined,
    limit: pageSize,
    offset: page * pageSize,
  };

  const activeQ = useActiveBatches(mode === 'active' ? filters : undefined);
  const expiredQ = useExpiredHistory(mode === 'expired' ? filters : undefined);
  const bulkExpire = useBulkExpire();

  const query = mode === 'active' ? activeQ : expiredQ;
  const batches: BatchRecord[] = query.data?.batches ?? [];
  const total = query.data?.total ?? 0;

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === batches.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(batches.map((b) => b.allocationId)));
    }
  };

  const handleBulkExpire = () => {
    bulkExpire.mutate([...selected], {
      onSuccess: () => setSelected(new Set()),
    });
  };

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Input
          className="w-48 h-8 text-sm"
          placeholder="Filter by tenant ID"
          value={tenantFilter}
          onChange={(e) => { setTenantFilter(e.target.value); setPage(0); }}
        />
        <Select value={creditTypeFilter} onValueChange={(v) => { setCreditTypeFilter(v); setPage(0); }}>
          <SelectTrigger className="w-36 h-8 text-sm">
            <SelectValue placeholder="Credit type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="seasonal">Seasonal</SelectItem>
            <SelectItem value="free">Free</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="ghost" size="sm" onClick={() => query.refetch()} disabled={query.isLoading}>
          <RefreshCw className="w-4 h-4" />
        </Button>

        {mode === 'active' && selected.size > 0 && (
          <Button
            variant="destructive"
            size="sm"
            onClick={handleBulkExpire}
            disabled={bulkExpire.isPending}
          >
            {bulkExpire.isPending
              ? <Loader2 className="w-4 h-4 animate-spin mr-1" />
              : <Trash2 className="w-4 h-4 mr-1" />}
            Expire {selected.size} selected
          </Button>
        )}

        <span className="ml-auto text-xs text-muted-foreground">{total} total</span>
      </div>

      {/* Table */}
      {query.isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : !batches.length ? (
        <p className="text-center text-muted-foreground py-10">No batches found.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              {mode === 'active' && (
                <TableHead className="w-8">
                  <Checkbox checked={selected.size === batches.length && batches.length > 0} onCheckedChange={toggleAll} />
                </TableHead>
              )}
              <TableHead>Tenant</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Credits</TableHead>
              <TableHead>Campaign</TableHead>
              <TableHead>{mode === 'active' ? 'Expires' : 'Expired'}</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {batches.map((b) => {
              const expiryDate = new Date(b.expiresAt);
              const daysLeft = Math.ceil((expiryDate.getTime() - Date.now()) / 86_400_000);
              return (
                <TableRow key={b.allocationId}>
                  {mode === 'active' && (
                    <TableCell>
                      <Checkbox
                        checked={selected.has(b.allocationId)}
                        onCheckedChange={() => toggleSelect(b.allocationId)}
                      />
                    </TableCell>
                  )}
                  <TableCell className="text-xs font-mono truncate max-w-[140px]">
                    {b.tenantName ?? b.tenantId.slice(0, 8) + '…'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs capitalize">
                      {b.creditType}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    <span className="font-medium">{b.remainingCredits.toLocaleString()}</span>
                    <span className="text-muted-foreground text-xs"> / {b.totalCredits.toLocaleString()}</span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground truncate max-w-[120px]">
                    {b.campaignName ?? '—'}
                  </TableCell>
                  <TableCell>
                    {mode === 'active' ? (
                      <Badge className={`${URGENCY_COLORS(daysLeft)} border-0 text-xs flex items-center gap-1 w-fit`}>
                        {daysLeft <= 1 && <AlertTriangle className="w-3 h-3" />}
                        {daysLeft <= 0 ? 'Today' : `${daysLeft}d`}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(expiryDate, { addSuffix: true })}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-xs ${b.isActive ? 'text-green-700' : 'text-gray-500'}`}
                    >
                      {b.isExpired ? 'expired' : b.isActive ? 'active' : 'inactive'}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {/* Pagination */}
      {total > pageSize && (
        <div className="flex justify-center gap-2 pt-1">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            Prev
          </Button>
          <span className="text-xs text-muted-foreground self-center">
            Page {page + 1} / {Math.ceil(total / pageSize)}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={(page + 1) * pageSize >= total}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
