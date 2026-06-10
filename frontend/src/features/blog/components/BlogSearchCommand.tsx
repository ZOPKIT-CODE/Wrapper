import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { usePublicSearch } from '../hooks/useBlog';

/**
 * ⌘K / Ctrl+K command-palette search over published posts. Mounted in the public
 * blog layout so it's available on every reader page. Uses server-side search
 * (shouldFilter=false disables cmdk's client filtering).
 */
export function BlogSearchCommand() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const navigate = useNavigate();
  const { data: results = [], isFetching } = usePublicSearch(q);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const go = (slug: string) => { setOpen(false); setQ(''); navigate({ to: '/blog/$slug', params: { slug } }); };
  const enough = q.trim().length >= 2;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden p-0">
        <DialogTitle className="sr-only">Search posts</DialogTitle>
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search posts…" value={q} onValueChange={setQ} />
          <CommandList>
            {!enough && <CommandEmpty>Type at least 2 characters…</CommandEmpty>}
            {enough && !isFetching && results.length === 0 && <CommandEmpty>No posts found.</CommandEmpty>}
            {results.length > 0 && (
              <CommandGroup heading="Posts">
                {results.map((p) => (
                  <CommandItem key={p.postId} value={p.postId} onSelect={() => go(p.slug)} className="flex-col items-start gap-0.5">
                    <span className="font-medium">{p.title}</span>
                    {(p.excerpt || p.subtitle) && (
                      <span className="line-clamp-1 text-xs text-muted-foreground">{p.excerpt || p.subtitle}</span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
