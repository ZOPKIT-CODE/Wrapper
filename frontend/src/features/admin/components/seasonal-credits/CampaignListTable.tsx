import { useNavigate } from '@tanstack/react-router';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Eye, Send, RotateCcw, Ban, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import {
  useCampaigns,
  useDistributeCampaign,
  useCancelCampaign,
  useRerunFailed,
  type Campaign,
} from '../../hooks/useSeasonalCredits';

const TYPE_COLORS: Record<string, string> = {
  free_distribution: 'bg-blue-100 text-blue-800',
  promotional: 'bg-purple-100 text-purple-800',
  holiday: 'bg-green-100 text-green-800',
  bonus: 'bg-yellow-100 text-yellow-800',
  event: 'bg-orange-100 text-orange-800',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-500 line-through',
};

interface Props {
  filter?: { isActive?: boolean; distributionStatus?: string };
}

export function CampaignListTable({ filter }: Props) {
  const navigate = useNavigate();
  const { data: campaigns, isLoading, refetch } = useCampaigns(filter);
  const distribute = useDistributeCampaign();
  const cancel = useCancelCampaign();
  const rerun = useRerunFailed();

  const busy = distribute.isPending || cancel.isPending || rerun.isPending;

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!campaigns?.length) {
    return (
      <p className="text-center text-muted-foreground py-10">No campaigns found.</p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Credits</TableHead>
          <TableHead>Tenants</TableHead>
          <TableHead>Expires</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {campaigns.map((c: Campaign) => {
          const total = Number(c.totalCredits ?? 0);
          const distributed = c.distributedCount ?? 0;
          return (
            <TableRow key={c.campaignId}>
              <TableCell className="font-medium max-w-[200px] truncate">{c.campaignName}</TableCell>
              <TableCell>
                <Badge className={`${TYPE_COLORS[c.creditType] ?? 'bg-gray-100 text-gray-700'} border-0 text-xs`}>
                  {c.creditType.replace('_', ' ')}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="text-sm">
                  <span className="font-medium">{total.toLocaleString()}</span>
                  {distributed > 0 && (
                    <span className="text-muted-foreground text-xs ml-1">({distributed} tenant{distributed !== 1 ? 's' : ''})</span>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-sm">{c.failedCount > 0 ? <span className="text-red-500">{c.failedCount} failed</span> : distributed || '—'}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(c.expiresAt), { addSuffix: true })}
              </TableCell>
              <TableCell>
                <Badge className={`${STATUS_COLORS[c.distributionStatus ?? 'pending'] ?? ''} border-0 text-xs`}>
                  {c.distributionStatus ?? 'pending'}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" disabled={busy}>
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => navigate({ to: `/company-admin/campaigns/$campaignId`, params: { campaignId: c.campaignId } } as any)}
                    >
                      <Eye className="w-4 h-4 mr-2" />View Details
                    </DropdownMenuItem>
                    {c.distributionStatus === 'pending' && (
                      <DropdownMenuItem
                        onClick={() => distribute.mutate(c.campaignId, { onSuccess: () => refetch() })}
                      >
                        <Send className="w-4 h-4 mr-2" />Distribute
                      </DropdownMenuItem>
                    )}
                    {c.distributionStatus === 'failed' && (
                      <DropdownMenuItem
                        onClick={() => rerun.mutate(c.campaignId, { onSuccess: () => refetch() })}
                      >
                        <RotateCcw className="w-4 h-4 mr-2" />Rerun Failed
                      </DropdownMenuItem>
                    )}
                    {c.distributionStatus !== 'cancelled' && c.distributionStatus !== 'completed' && (
                      <DropdownMenuItem
                        className="text-red-600"
                        onClick={() => cancel.mutate(c.campaignId, { onSuccess: () => refetch() })}
                      >
                        <Ban className="w-4 h-4 mr-2" />Cancel
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
