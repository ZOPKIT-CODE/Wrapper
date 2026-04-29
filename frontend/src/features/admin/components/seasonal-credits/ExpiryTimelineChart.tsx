import { useMemo } from 'react';
import { useExpiringSoon } from '../../hooks/useSeasonalCredits';
import { Loader2 } from 'lucide-react';

interface BucketRow {
  label: string;
  credits: number;
  urgency: 'critical' | 'warning' | 'soon' | 'ok';
}

const URGENCY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  warning: '#f97316',
  soon: '#eab308',
  ok: '#22c55e',
};

function bucketize(data: { totalCredits: number; daysUntilExpiry: number }[]): BucketRow[] {
  const buckets: Record<string, { credits: number; urgency: BucketRow['urgency'] }> = {
    '≤1d': { credits: 0, urgency: 'critical' },
    '2–3d': { credits: 0, urgency: 'warning' },
    '4–7d': { credits: 0, urgency: 'soon' },
    '8–14d': { credits: 0, urgency: 'ok' },
    '15–30d': { credits: 0, urgency: 'ok' },
  };
  for (const item of data) {
    const d = item.daysUntilExpiry;
    if (d <= 1) buckets['≤1d'].credits += item.totalCredits;
    else if (d <= 3) buckets['2–3d'].credits += item.totalCredits;
    else if (d <= 7) buckets['4–7d'].credits += item.totalCredits;
    else if (d <= 14) buckets['8–14d'].credits += item.totalCredits;
    else buckets['15–30d'].credits += item.totalCredits;
  }
  return Object.entries(buckets).map(([label, v]) => ({ label, ...v }));
}

export function ExpiryTimelineChart() {
  const { data, isLoading } = useExpiringSoon(30);

  const chartData = useMemo(() => {
    if (!data?.length) return [];
    return bucketize(data);
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const max = Math.max(...chartData.map((b) => b.credits), 1);

  if (!chartData.length || chartData.every((b) => b.credits === 0)) {
    return <p className="text-center text-muted-foreground py-6 text-sm">No credits expiring in the next 30 days.</p>;
  }

  return (
    <div className="space-y-2">
      {chartData.map((bucket) => (
        <div key={bucket.label} className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground w-12 shrink-0 text-right">{bucket.label}</span>
          <div className="flex-1 bg-muted rounded-full h-5 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${(bucket.credits / max) * 100}%`,
                backgroundColor: URGENCY_COLORS[bucket.urgency],
                minWidth: bucket.credits > 0 ? '4px' : '0',
              }}
            />
          </div>
          <span className="text-xs font-medium w-16 shrink-0">
            {bucket.credits > 0 ? bucket.credits.toLocaleString() : '—'}
          </span>
        </div>
      ))}
      <p className="text-xs text-muted-foreground text-right mt-1">credits by expiry window</p>
    </div>
  );
}
