import React, { useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Gift, Loader2 } from 'lucide-react';
import { useGrantToTenant } from '../../hooks/useSeasonalCredits';

interface Props {
  tenantId: string;
  tenantName?: string;
  onGranted?: () => void;
}

export function GrantCreditsDialog({ tenantId, tenantName, onGranted }: Props) {
  const [open, setOpen] = useState(false);
  const grant = useGrantToTenant();

  const [form, setForm] = useState({
    creditAmount: '',
    expiresAt: '',
    reason: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const expiresAtDate = new Date(form.expiresAt);
    expiresAtDate.setHours(23, 59, 59, 0);

    grant.mutate(
      {
        tenantId,
        data: {
          creditAmount: Number(form.creditAmount),
          expiresAt: expiresAtDate.toISOString(),
          reason: form.reason || undefined,
        },
      },
      {
        onSuccess: () => {
          setOpen(false);
          setForm({ creditAmount: '', expiresAt: '', reason: '' });
          onGranted?.();
        },
      },
    );
  };

  const set = (key: keyof typeof form) => (val: string) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Gift className="w-4 h-4 mr-1" />Grant Credits
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Grant Seasonal Credits</DialogTitle>
          {tenantName && (
            <p className="text-sm text-muted-foreground">To: {tenantName}</p>
          )}
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Credits</Label>
              <Input
                required
                type="number"
                min={1}
                placeholder="e.g. 500"
                value={form.creditAmount}
                onChange={(e) => set('creditAmount')(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Expires On</Label>
              <Input
                required
                type="date"
                min={new Date().toISOString().split('T')[0]}
                value={form.expiresAt}
                onChange={(e) => set('expiresAt')(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Reason <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Textarea
              rows={2}
              placeholder="e.g. Compensation for downtime, promotional grant"
              value={form.reason}
              onChange={(e) => set('reason')(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={grant.isPending}>
              {grant.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Grant
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
