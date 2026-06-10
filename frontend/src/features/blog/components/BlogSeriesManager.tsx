import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, ArrowUp, ArrowDown, Trash2, Loader2, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useSeriesList, useSeries, useCreateSeries, useDeleteSeries, useReorderSeries } from '../hooks/useBlog';
import type { BlogPost } from '../types/blog';

function SeriesDetail({ seriesId, onDeleted }: { seriesId: string; onDeleted: () => void }) {
  const { data, isLoading } = useSeries(seriesId);
  const reorder = useReorderSeries();
  const del = useDeleteSeries();
  const [order, setOrder] = useState<BlogPost[]>([]);

  useEffect(() => { if (data?.posts) setOrder(data.posts); }, [data?.posts]);

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const next = order.slice();
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
  };
  const dirty = data?.posts && order.map((p) => p.postId).join() !== data.posts.map((p) => p.postId).join();

  if (isLoading) return <Skeleton className="h-40 w-full rounded-lg" />;
  if (!data) return null;

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">{data.series.title}</h3>
          <p className="text-xs text-gray-400">/blog/series/{data.series.slug} · {order.length} posts</p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" className="text-red-600"><Trash2 size={15} className="mr-1" /> Delete series</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this series?</AlertDialogTitle>
              <AlertDialogDescription>“{data.series.title}” will be removed and its posts detached (the posts themselves are kept).</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => del.mutate(seriesId, { onSuccess: onDeleted })}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {order.length === 0 && (
        <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-500">
          No posts yet. Open a post in the editor and pick this series under “SEO &amp; metadata → Series.”
        </p>
      )}
      <ol className="space-y-2">
        {order.map((p, i) => (
          <li key={p.postId} className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2">
            <span className="w-6 text-sm text-slate-400">{i + 1}.</span>
            <span className="min-w-0 flex-1 truncate text-sm text-slate-800">{p.title}</span>
            <span className="text-xs capitalize text-slate-400">{p.status}</span>
            <Button variant="ghost" size="icon" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={15} /></Button>
            <Button variant="ghost" size="icon" disabled={i === order.length - 1} onClick={() => move(i, 1)}><ArrowDown size={15} /></Button>
          </li>
        ))}
      </ol>

      {dirty && (
        <div className="mt-3">
          <Button size="sm" disabled={reorder.isPending}
            onClick={() => reorder.mutate({ seriesId, orderedPostIds: order.map((p) => p.postId) }, { onSuccess: () => toast.success('Order saved') })}>
            {reorder.isPending && <Loader2 size={14} className="mr-1 animate-spin" />} Save order
          </Button>
        </div>
      )}
    </Card>
  );
}

/** Company-admin series manager: create series + reorder their posts. */
export default function BlogSeriesManager() {
  const { data: series, isLoading } = useSeriesList();
  const create = useCreateSeries();
  const [title, setTitle] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const onCreate = () => {
    if (!title.trim()) { toast.error('Series title is required'); return; }
    create.mutate({ title: title.trim() }, { onSuccess: (s) => { setTitle(''); setSelected(s.seriesId); } });
  };

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Series</h2>
        <p className="text-sm text-gray-500">Group posts into ordered reading paths. Add posts from the post editor.</p>
      </div>

      <div className="mb-5 flex gap-2">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New series title…" className="max-w-sm"
          onKeyDown={(e) => { if (e.key === 'Enter') onCreate(); }} />
        <Button onClick={onCreate} disabled={create.isPending}>
          {create.isPending ? <Loader2 size={15} className="mr-1 animate-spin" /> : <Plus size={16} className="mr-1" />} Create
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          {isLoading && Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
          {!isLoading && series && series.length === 0 && <p className="text-sm text-slate-400">No series yet.</p>}
          {series?.map((s) => (
            <button key={s.seriesId} type="button" onClick={() => setSelected(s.seriesId)}
              className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left ${selected === s.seriesId ? 'border-slate-900' : 'border-slate-200 hover:border-slate-300'}`}>
              <span>
                <span className="block font-medium text-slate-900">{s.title}</span>
                <span className="text-xs text-slate-400">{s.postCount} posts</span>
              </span>
              <ChevronRight size={16} className="text-slate-400" />
            </button>
          ))}
        </div>
        <div>{selected && <SeriesDetail seriesId={selected} onDeleted={() => setSelected(null)} />}</div>
      </div>
    </div>
  );
}
