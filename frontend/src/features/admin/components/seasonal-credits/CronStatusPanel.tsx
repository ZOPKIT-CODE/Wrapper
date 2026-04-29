import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RefreshCw, CheckCircle2, AlertTriangle, XCircle, Clock, Zap } from 'lucide-react';
import { useCronStatus, useTriggerCron, type CronRun } from '../../hooks/useSeasonalCredits';
import { formatDistanceToNow } from 'date-fns';

function StatusBadge({ status }: { status: CronRun['status'] }) {
  if (status === 'success')
    return <Badge className="bg-green-100 text-green-800 border-0"><CheckCircle2 className="w-3 h-3 mr-1" />Success</Badge>;
  if (status === 'partial')
    return <Badge className="bg-yellow-100 text-yellow-800 border-0"><AlertTriangle className="w-3 h-3 mr-1" />Partial</Badge>;
  return <Badge className="bg-red-100 text-red-800 border-0"><XCircle className="w-3 h-3 mr-1" />Error</Badge>;
}

export function CronStatusPanel() {
  const { data, isLoading, refetch } = useCronStatus(20);
  const trigger = useTriggerCron();

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Last Run</p>
            <p className="font-semibold text-sm mt-1">
              {data?.lastRun
                ? formatDistanceToNow(new Date(data.lastRun.ranAt), { addSuffix: true })
                : '—'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Success Rate (30d)</p>
            <p className="font-semibold text-sm mt-1">
              {data ? `${data.stats.successRate.toFixed(0)}%` : '—'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Avg Duration</p>
            <p className="font-semibold text-sm mt-1">
              {data?.stats.avgDurationMs ? `${data.stats.avgDurationMs}ms` : '—'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Runs (30d)</p>
            <p className="font-semibold text-sm mt-1">{data?.stats.total ?? '—'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
          <RefreshCw className="w-4 h-4 mr-1" />Refresh
        </Button>
        <Button
          size="sm"
          onClick={() => trigger.mutate()}
          disabled={trigger.isPending}
        >
          <Zap className="w-4 h-4 mr-1" />
          {trigger.isPending ? 'Running…' : 'Trigger Now'}
        </Button>
      </div>

      {/* Run history table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Recent Runs</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Batches</TableHead>
                <TableHead>Errors</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                    Loading…
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && !data?.runs.length && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                    No runs recorded yet
                  </TableCell>
                </TableRow>
              )}
              {data?.runs.map((run) => (
                <TableRow key={run.runId}>
                  <TableCell className="text-xs">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-muted-foreground" />
                      {formatDistanceToNow(new Date(run.ranAt), { addSuffix: true })}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs capitalize">
                      {run.triggerSource.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{run.batchesProcessed}</TableCell>
                  <TableCell className="text-sm">{run.errorCount}</TableCell>
                  <TableCell className="text-sm">
                    {run.durationMs != null ? `${run.durationMs}ms` : '—'}
                  </TableCell>
                  <TableCell><StatusBadge status={run.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
