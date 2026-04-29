import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Coins, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useTenantCreditSummary, type BatchRecord } from '../../hooks/useSeasonalCredits';
import { GrantCreditsDialog } from './GrantCreditsDialog';

interface Props {
  tenantId: string;
  tenantName?: string;
}

export function TenantCreditPanel({ tenantId, tenantName }: Props) {
  const { data, isLoading } = useTenantCreditSummary(tenantId);

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const summary = data?.summary as Record<string, { total: number; available: number; expiringSoonCount: number }> ?? {};
  const batches: BatchRecord[] = data?.activeBatches ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
          {tenantName ?? tenantId}
        </h3>
        <GrantCreditsDialog tenantId={tenantId} tenantName={tenantName} />
      </div>

      {/* Credit type summary */}
      <div className="grid grid-cols-3 gap-3">
        {Object.entries(summary).map(([type, stats]) => (
          <Card key={type}>
            <CardContent className="pt-3 pb-3">
              <p className="text-xs text-muted-foreground capitalize">{type}</p>
              <p className="font-semibold">{stats.available.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">of {stats.total.toLocaleString()}</p>
              {stats.expiringSoonCount > 0 && (
                <Badge className="mt-1 bg-yellow-100 text-yellow-800 border-0 text-xs">
                  <Clock className="w-3 h-3 mr-1" />{stats.expiringSoonCount} expiring
                </Badge>
              )}
            </CardContent>
          </Card>
        ))}
        {Object.keys(summary).length === 0 && (
          <p className="text-muted-foreground text-sm col-span-3">No credits allocated.</p>
        )}
      </div>

      {/* Active batches */}
      {batches.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Coins className="w-4 h-4" /> Active Batches
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Remaining</TableHead>
                  <TableHead>App</TableHead>
                  <TableHead>Expires</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((b) => (
                  <TableRow key={b.allocationId}>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">{b.creditType}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      <span className="font-medium">{b.remainingCredits.toLocaleString()}</span>
                      <span className="text-muted-foreground text-xs"> / {b.totalCredits.toLocaleString()}</span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {b.targetApplication ?? 'Org pool'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(b.expiresAt), { addSuffix: true })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
