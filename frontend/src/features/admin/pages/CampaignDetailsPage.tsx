import { useParams, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, Send, RotateCcw, Ban, Loader2, AlertTriangle, RefreshCw, XCircle } from 'lucide-react';
import { Container } from '@/components/common/Page';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AnimatedLoader from '@/components/common/feedback/AnimatedLoader';
import { AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import {
  useCampaignTenantBreakdown,
  useDistributeCampaign,
  useCancelCampaign,
  useRerunFailed,
  type TenantBreakdownRow,
  type FailedTenantRow,
} from '../hooks/useSeasonalCredits';

const EXPIRY_BADGE: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  expiring_soon: 'bg-orange-100 text-orange-800',
  expired: 'bg-gray-100 text-gray-500',
};

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-700',
  processing: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  partial_success: 'bg-yellow-100 text-yellow-800',
  failed: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-500',
};

function ExpiryBadge({ row }: { row: TenantBreakdownRow }) {
  const label =
    row.expiryStatus === 'expired'
      ? 'Expired'
      : row.expiryStatus === 'expiring_soon'
      ? `${row.daysUntilExpiry}d left`
      : `${row.daysUntilExpiry}d left`;

  return (
    <Badge className={`${EXPIRY_BADGE[row.expiryStatus]} border-0 text-xs flex items-center gap-1 w-fit`}>
      {row.expiryStatus === 'expiring_soon' && <AlertTriangle className="w-3 h-3" />}
      {label}
    </Badge>
  );
}

function UtilizationBar({ pct }: { pct: number }) {
  const color = pct >= 80 ? 'bg-green-500' : pct >= 40 ? 'bg-blue-500' : 'bg-gray-300';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 rounded-full bg-gray-200 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className="text-xs text-muted-foreground">{pct}%</span>
    </div>
  );
}

export function CampaignDetailsPage() {
  const { campaignId } = useParams({ strict: false });
  const navigate = useNavigate();

  const { data: breakdown, isLoading, refetch } = useCampaignTenantBreakdown(campaignId ?? '');
  const distribute = useDistributeCampaign();
  const cancel = useCancelCampaign();
  const rerun = useRerunFailed();

  if (isLoading) {
    return (
      <Container className="dashboard-actionable-cursors">
        <div className="flex items-center justify-center min-h-[400px]">
          <AnimatedLoader size="md" />
        </div>
      </Container>
    );
  }

  if (!breakdown) {
    return (
      <Container className="dashboard-actionable-cursors">
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
          <AlertCircle className="h-12 w-12 text-gray-400" />
          <h2 className="text-xl font-semibold">Campaign Not Found</h2>
          <Button onClick={() => navigate({ to: '/company-admin' as any })} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />Back to Admin
          </Button>
        </div>
      </Container>
    );
  }

  const busy = distribute.isPending || cancel.isPending || rerun.isPending;
  const { summary, tenants, failedTenants, distributionStatus } = breakdown;

  return (
    <Container className="dashboard-actionable-cursors">
      <div className="space-y-6">

        {/* Header */}
        <div className="flex items-center gap-4 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: '/company-admin' as any })} className="gap-2">
            <ArrowLeft className="h-4 w-4" />Back to Admin
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-semibold truncate">{breakdown.campaignName}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={`${STATUS_BADGE[distributionStatus ?? 'pending'] ?? ''} border-0 text-xs capitalize`}>
                {distributionStatus}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Expires {breakdown.expiresAt ? format(new Date(breakdown.expiresAt), 'MMM d, yyyy HH:mm') : '—'}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isLoading}>
              <RefreshCw className="w-4 h-4" />
            </Button>
            {distributionStatus === 'pending' && (
              <Button size="sm" disabled={busy} onClick={() => distribute.mutate(breakdown.campaignId)}>
                {distribute.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
                Distribute
              </Button>
            )}
            {distributionStatus === 'failed' && (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => rerun.mutate(breakdown.campaignId)}>
                {rerun.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RotateCcw className="w-4 h-4 mr-1" />}
                Rerun Failed
              </Button>
            )}
            {distributionStatus !== 'cancelled' && distributionStatus !== 'completed' && (
              <Button size="sm" variant="destructive" disabled={busy} onClick={() => cancel.mutate(breakdown.campaignId)}>
                {cancel.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Ban className="w-4 h-4 mr-1" />}
                Cancel
              </Button>
            )}
          </div>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {[
            { label: 'Tenants Reached', value: breakdown.successfulTenants, color: '' },
            { label: 'Failed', value: breakdown.failedTenantCount, color: breakdown.failedTenantCount > 0 ? 'text-red-600' : '' },
            { label: 'Total Allocated', value: summary.totalAllocated.toLocaleString(), color: '' },
            { label: 'Total Used', value: summary.totalUsed.toLocaleString(), color: 'text-orange-600' },
            { label: 'Remaining', value: summary.totalRemaining.toLocaleString(), color: 'text-green-600' },
            { label: 'Expiring ≤7d', value: summary.expiringSoonCount, color: summary.expiringSoonCount > 0 ? 'text-orange-600' : '' },
          ].map(({ label, value, color }) => (
            <Card key={label}>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className={`text-xl font-bold ${color}`}>{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Expiry health chips */}
        <div className="flex gap-2 flex-wrap">
          <Badge className="bg-green-100 text-green-800 border-0">{summary.activeCount} active</Badge>
          {summary.expiringSoonCount > 0 && (
            <Badge className="bg-orange-100 text-orange-800 border-0">
              <AlertTriangle className="w-3 h-3 mr-1" />{summary.expiringSoonCount} expiring ≤7d
            </Badge>
          )}
          {summary.expiredCount > 0 && (
            <Badge className="bg-gray-100 text-gray-500 border-0">{summary.expiredCount} expired</Badge>
          )}
        </div>

        {/* Tenant breakdown table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Tenant Distribution</CardTitle>
            <CardDescription>
              {breakdown.successfulTenants} tenant{breakdown.successfulTenants !== 1 ? 's' : ''} received credits
              {breakdown.failedTenantCount > 0 && (
                <span className="text-destructive ml-2">· {breakdown.failedTenantCount} failed</span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {tenants.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No tenants have received credits yet.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead>
                    <TableHead className="text-right">Allocated</TableHead>
                    <TableHead className="text-right">Used</TableHead>
                    <TableHead className="text-right">Remaining</TableHead>
                    <TableHead>Usage</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead>Expires At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenants.map((row: TenantBreakdownRow) => (
                    <TableRow key={row.tenantId} className={row.expiryStatus === 'expired' ? 'opacity-50' : ''}>
                      <TableCell>
                        <div className="font-medium text-sm">{row.tenantName}</div>
                        <div className="text-xs text-muted-foreground font-mono">{row.tenantId.slice(0, 8)}…</div>
                      </TableCell>
                      <TableCell className="text-right font-medium">{row.allocatedCredits.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-orange-600">{row.usedCredits.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-green-600">{row.remainingCredits.toLocaleString()}</TableCell>
                      <TableCell><UtilizationBar pct={row.utilizationPct} /></TableCell>
                      <TableCell><ExpiryBadge row={row} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(row.expiresAt), 'MMM d, yyyy HH:mm')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Failed tenants section */}
        {failedTenants.length > 0 && (
          <Card className="border-red-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2 text-red-700">
                <XCircle className="w-4 h-4" />
                Failed Distributions ({failedTenants.length})
              </CardTitle>
              <CardDescription>
                These tenants did not receive credits. Use "Rerun Failed" to retry after fixing the underlying issue.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Failure Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {failedTenants.map((ft: FailedTenantRow) => (
                    <TableRow key={ft.tenantId}>
                      <TableCell>
                        <div className="font-medium text-sm">{ft.tenantName}</div>
                        <div className="text-xs text-muted-foreground font-mono">{ft.tenantId.slice(0, 8)}…</div>
                      </TableCell>
                      <TableCell className="text-sm text-red-600">{ft.error}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

      </div>
    </Container>
  );
}
