import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2, FlaskConical, Trash2, PlusCircle } from 'lucide-react';
import { useCreateCampaign } from '../../hooks/useSeasonalCredits';
import {
  mergeCongratulatoryDisplay,
  SeasonalCreditsCongratulatoryPreview,
} from '@/features/notifications/SeasonalCreditsCongratulatoryModal';
import type { ModalConfig, ModalTheme } from '@/features/notifications/SeasonalCreditsCongratulatoryModal';

const IS_DEV = import.meta.env.DEV;

const CREDIT_TYPE_OPTIONS = [
  { value: 'free_distribution', label: 'Free Distribution' },
  { value: 'promotional', label: 'Promotional' },
  { value: 'holiday', label: 'Holiday' },
  { value: 'bonus', label: 'Bonus' },
  { value: 'event', label: 'Event' },
] as const;

const THEMES: { value: ModalTheme; label: string; gradient: string }[] = [
  { value: 'dark', label: 'Midnight', gradient: 'from-slate-900 to-slate-700' },
  { value: 'emerald', label: 'Forest', gradient: 'from-emerald-900 to-emerald-700' },
  { value: 'blue', label: 'Ocean', gradient: 'from-blue-900 to-blue-700' },
  { value: 'purple', label: 'Royal', gradient: 'from-purple-900 to-purple-700' },
  { value: 'rose', label: 'Blossom', gradient: 'from-rose-800 to-rose-600' },
  { value: 'gold', label: 'Sunrise', gradient: 'from-amber-700 to-amber-500' },
];

const EMPTY_FORM = {
  campaignName: '',
  creditType: 'free_distribution',
  totalCredits: '',
  creditsPerTenant: '',
  expiresAt: '',
  description: '',
  targetAllTenants: true,
  notifyTenants: false,
};

const EMPTY_MODAL_CONFIG = {
  theme: 'dark' as ModalTheme,
  headerTitle: '',
  headerSubtitle: '',
  headline: '',
  description: '',
  showHighlights: true,
  highlights: [
    { title: '', description: '' },
    { title: '', description: '' },
  ],
  showActions: true,
  actionsTitle: '',
  actions: ['', '', ''],
  primaryCta: '',
  secondaryCta: '',
  footerNote: '',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">{title}</p>
      {children}
    </div>
  );
}

export interface CreateCampaignFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function CreateCampaignForm({ onSuccess, onCancel }: CreateCampaignFormProps) {
  const [devMode, setDevMode] = useState(false);
  const [devMinutes, setDevMinutes] = useState('5');
  const [modalConfig, setModalConfig] = useState(EMPTY_MODAL_CONFIG);
  const create = useCreateCampaign();
  const [form, setForm] = useState(EMPTY_FORM);

  const set = (key: keyof typeof form) => (val: string | boolean) => setForm(prev => ({ ...prev, [key]: val }));

  const setMC = <K extends keyof typeof EMPTY_MODAL_CONFIG>(key: K, val: (typeof EMPTY_MODAL_CONFIG)[K]) =>
    setModalConfig(prev => ({ ...prev, [key]: val }));

  const setHighlight = (i: number, field: 'title' | 'description', v: string) =>
    setModalConfig(prev => ({
      ...prev,
      highlights: prev.highlights.map((h, idx) => (idx === i ? { ...h, [field]: v } : h)),
    }));

  const addHighlight = () =>
    setModalConfig(prev => ({ ...prev, highlights: [...prev.highlights, { title: '', description: '' }] }));

  const removeHighlight = (i: number) =>
    setModalConfig(prev => ({ ...prev, highlights: prev.highlights.filter((_, idx) => idx !== i) }));

  const setAction = (i: number, v: string) =>
    setModalConfig(prev => ({ ...prev, actions: prev.actions.map((a, idx) => (idx === i ? v : a)) }));

  const addAction = () => setModalConfig(prev => ({ ...prev, actions: [...prev.actions, ''] }));

  const removeAction = (i: number) =>
    setModalConfig(prev => ({ ...prev, actions: prev.actions.filter((_, idx) => idx !== i) }));

  const buildCleanConfig = (): ModalConfig | undefined => {
    const c: ModalConfig = {};
    if (modalConfig.theme !== 'dark') c.theme = modalConfig.theme;
    if (modalConfig.headerTitle.trim()) c.headerTitle = modalConfig.headerTitle.trim();
    if (modalConfig.headerSubtitle.trim()) c.headerSubtitle = modalConfig.headerSubtitle.trim();
    if (modalConfig.headline.trim()) c.headline = modalConfig.headline.trim();
    if (modalConfig.description.trim()) c.description = modalConfig.description.trim();
    if (!modalConfig.showHighlights) c.showHighlights = false;
    const cleanH = modalConfig.highlights.filter(h => h.title.trim());
    if (cleanH.length) c.highlights = cleanH.map(h => ({ title: h.title.trim(), description: h.description.trim() }));
    if (!modalConfig.showActions) c.showActions = false;
    if (modalConfig.actionsTitle.trim()) c.actionsTitle = modalConfig.actionsTitle.trim();
    const cleanA = modalConfig.actions.filter(a => a.trim());
    if (cleanA.length) c.actions = cleanA.map(a => a.trim());
    if (modalConfig.primaryCta.trim()) c.primaryCta = modalConfig.primaryCta.trim();
    if (modalConfig.secondaryCta.trim()) c.secondaryCta = modalConfig.secondaryCta.trim();
    if (modalConfig.footerNote.trim()) c.footerNote = modalConfig.footerNote.trim();
    return Object.keys(c).length ? c : undefined;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const payload: Parameters<typeof create.mutate>[0] = {
      campaignName: form.campaignName,
      creditType: form.creditType,
      totalCredits: Number(form.totalCredits),
      creditsPerTenant: form.creditsPerTenant ? Number(form.creditsPerTenant) : undefined,
      targetAllTenants: form.targetAllTenants,
      description: form.description || undefined,
      notifyTenants: form.notifyTenants,
    };

    if (devMode) {
      payload.minutesUntilExpiry = Number(devMinutes);
    } else {
      const d = new Date(form.expiresAt);
      d.setHours(23, 59, 59, 0);
      payload.expiresAt = d.toISOString();
    }

    if (form.notifyTenants) {
      const clean = buildCleanConfig();
      if (clean) payload.modalConfig = clean;
    }

    create.mutate(payload, {
      onSuccess: () => {
        setForm({ ...EMPTY_FORM });
        setDevMinutes('5');
        setModalConfig({
          ...EMPTY_MODAL_CONFIG,
          highlights: [{ title: '', description: '' }, { title: '', description: '' }],
          actions: ['', '', ''],
        });
        onSuccess?.();
      },
    });
  };

  const previewExpiry = devMode && Number(devMinutes) > 0 ? `~${devMinutes} min` : null;

  const previewConfig: ModalConfig = {
    theme: modalConfig.theme,
    headerTitle: modalConfig.headerTitle || undefined,
    headerSubtitle: modalConfig.headerSubtitle || undefined,
    headline: modalConfig.headline || undefined,
    description: modalConfig.description || undefined,
    showHighlights: modalConfig.showHighlights,
    highlights: modalConfig.highlights.some(h => h.title)
      ? modalConfig.highlights.filter(h => h.title).map(h => ({ title: h.title, description: h.description }))
      : undefined,
    showActions: modalConfig.showActions,
    actionsTitle: modalConfig.actionsTitle || undefined,
    actions: modalConfig.actions.some(Boolean) ? modalConfig.actions.filter(Boolean) : undefined,
    primaryCta: modalConfig.primaryCta || undefined,
    secondaryCta: modalConfig.secondaryCta || undefined,
    footerNote: modalConfig.footerNote || undefined,
  };

  const previewCredits = form.creditsPerTenant ? Number(form.creditsPerTenant) : form.totalCredits ? Number(form.totalCredits) : 500;
  const previewCampaignName = form.campaignName || 'Campaign Preview';
  const congratulatoryDisplay = mergeCongratulatoryDisplay(previewConfig, previewCredits, previewCampaignName);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {IS_DEV && (
        <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm dark:border-amber-800 dark:bg-amber-950">
          <FlaskConical className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="text-amber-700 dark:text-amber-300 flex-1">Dev mode — short expiry</span>
          <Switch checked={devMode} onCheckedChange={setDevMode} />
        </div>
      )}

      <div className="space-y-2">
          <Label>Campaign Name</Label>
          <Input required placeholder="e.g. Diwali 2025" value={form.campaignName} onChange={e => set('campaignName')(e.target.value)} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Credit Type</Label>
            <Select value={form.creditType} onValueChange={set('creditType')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CREDIT_TYPE_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Total Credits</Label>
            <Input
              required
              type="number"
              min={1}
              placeholder="e.g. 5000"
              value={form.totalCredits}
              onChange={e => set('totalCredits')(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>
              Credits per Tenant <span className="text-muted-foreground text-xs">(optional)</span>
            </Label>
            <Input type="number" min={1} placeholder="Auto-distribute" value={form.creditsPerTenant} onChange={e => set('creditsPerTenant')(e.target.value)} />
          </div>
          <div className="space-y-2">
            {devMode ? (
              <>
                <Label className="flex items-center gap-1">
                  Expires in (minutes)
                  {previewExpiry && <span className="text-xs text-muted-foreground font-normal">→ {previewExpiry}</span>}
                </Label>
                <Input required type="number" min={1} max={1440} placeholder="5" value={devMinutes} onChange={e => setDevMinutes(e.target.value)} />
              </>
            ) : (
              <>
                <Label>Expires On</Label>
                <Input required type="date" min={new Date().toISOString().split('T')[0]} value={form.expiresAt} onChange={e => set('expiresAt')(e.target.value)} />
              </>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label>
            Description <span className="text-muted-foreground text-xs">(internal notes)</span>
          </Label>
          <Textarea rows={2} placeholder="Internal notes about this campaign" value={form.description} onChange={e => set('description')(e.target.value)} />
        </div>

        <div className="flex items-center gap-2">
          <Switch id="targetAll" checked={form.targetAllTenants} onCheckedChange={v => set('targetAllTenants')(v)} />
          <Label htmlFor="targetAll" className="cursor-pointer">
            Target all tenants
            <span className="text-xs text-muted-foreground ml-1">
              {form.targetAllTenants ? '(all active tenants)' : '(no tenants selected)'}
            </span>
          </Label>
        </div>

        <div className="flex items-center gap-2">
          <Switch id="notify" checked={form.notifyTenants} onCheckedChange={v => set('notifyTenants')(v)} />
          <Label htmlFor="notify" className="cursor-pointer">
            Notify tenants on distribution
          </Label>
        </div>

        {form.notifyTenants && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-900">
            <div className="bg-slate-50 dark:bg-slate-800/50 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Tenant notification</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Customize the message on the left; the live preview updates on the right.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(280px,380px)] lg:items-start">
              <div className="min-w-0 divide-y divide-slate-100 dark:divide-slate-800 max-h-[min(75vh,880px)] overflow-y-auto border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-700">
                <div className="px-4 sm:px-5 py-4">
                  <Section title="Theme">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {THEMES.map(th => (
                        <button
                          key={th.value}
                          type="button"
                          onClick={() => setMC('theme', th.value)}
                          className={`group relative overflow-hidden rounded-lg border-2 transition-all ${
                            modalConfig.theme === th.value
                              ? 'border-[#1B2E5A] ring-2 ring-[#1B2E5A]/20'
                              : 'border-transparent hover:border-slate-300'
                          }`}
                        >
                          <div className={`bg-gradient-to-br ${th.gradient} h-10 w-full`} />
                          <div className="bg-white py-1 text-center">
                            <span className="text-[10px] font-semibold text-slate-600">{th.label}</span>
                          </div>
                          {modalConfig.theme === th.value && (
                            <div className="absolute top-1.5 right-1.5 h-3.5 w-3.5 rounded-full bg-white flex items-center justify-center shadow">
                              <div className="h-2 w-2 rounded-full bg-[#1B2E5A]" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </Section>
                </div>

                <div className="px-4 sm:px-5 py-4 space-y-3">
                  <Section title="Header">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-500">Title</Label>
                        <Input placeholder="Account Enhancement" value={modalConfig.headerTitle} onChange={e => setMC('headerTitle', e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-500">Subtitle</Label>
                        <Input
                          placeholder="Seasonal Credit Allocation"
                          value={modalConfig.headerSubtitle}
                          onChange={e => setMC('headerSubtitle', e.target.value)}
                        />
                      </div>
                    </div>
                  </Section>
                </div>

                <div className="px-4 sm:px-5 py-4 space-y-3">
                  <Section title="Content">
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">Headline</Label>
                      <Input placeholder="Credits Successfully Allocated" value={modalConfig.headline} onChange={e => setMC('headline', e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">Description</Label>
                      <Textarea
                        rows={2}
                        placeholder="Your account has been enhanced with seasonal credits..."
                        value={modalConfig.description}
                        onChange={e => setMC('description', e.target.value)}
                      />
                    </div>
                  </Section>
                </div>

                <div className="px-4 sm:px-5 py-4 space-y-3">
                  <Section title="Highlight Cards">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">Show highlight cards</span>
                      <Switch checked={modalConfig.showHighlights} onCheckedChange={v => setMC('showHighlights', v)} />
                    </div>
                    {modalConfig.showHighlights && (
                      <div className="space-y-2">
                        {modalConfig.highlights.map((h, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <Input
                                placeholder={i === 0 ? 'Premium Features' : i === 1 ? 'Usage Credits' : `Feature ${i + 1}`}
                                value={h.title}
                                onChange={e => setHighlight(i, 'title', e.target.value)}
                              />
                              <Input
                                placeholder={i === 0 ? 'Advanced tools' : 'Apply to services'}
                                value={h.description}
                                onChange={e => setHighlight(i, 'description', e.target.value)}
                              />
                            </div>
                            {modalConfig.highlights.length > 1 && (
                              <button type="button" onClick={() => removeHighlight(i)} className="mt-2 text-slate-300 hover:text-red-400 transition-colors">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        ))}
                        {modalConfig.highlights.length < 4 && (
                          <button type="button" onClick={addHighlight} className="flex items-center gap-1.5 text-xs text-[#1B2E5A] hover:text-[#243A6C] font-medium">
                            <PlusCircle className="h-3.5 w-3.5" />
                            Add card
                          </button>
                        )}
                      </div>
                    )}
                  </Section>
                </div>

                <div className="px-4 sm:px-5 py-4 space-y-3">
                  <Section title="Recommended Actions">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">Show actions section</span>
                      <Switch checked={modalConfig.showActions} onCheckedChange={v => setMC('showActions', v)} />
                    </div>
                    {modalConfig.showActions && (
                      <div className="space-y-2">
                        <div className="space-y-1">
                          <Label className="text-xs text-slate-500">Section title</Label>
                          <Input placeholder="Recommended Actions" value={modalConfig.actionsTitle} onChange={e => setMC('actionsTitle', e.target.value)} />
                        </div>
                        {modalConfig.actions.map((a, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span className="text-xs text-slate-400 w-3 shrink-0">{i + 1}.</span>
                            <Input
                              className="flex-1"
                              placeholder={
                                i === 0
                                  ? 'Review premium features in your dashboard'
                                  : i === 1
                                    ? 'Explore integration options'
                                    : 'Monitor credit usage and expiration'
                              }
                              value={a}
                              onChange={e => setAction(i, e.target.value)}
                            />
                            {modalConfig.actions.length > 1 && (
                              <button type="button" onClick={() => removeAction(i)} className="text-slate-300 hover:text-red-400 transition-colors">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        ))}
                        {modalConfig.actions.length < 6 && (
                          <button type="button" onClick={addAction} className="flex items-center gap-1.5 text-xs text-[#1B2E5A] hover:text-[#243A6C] font-medium">
                            <PlusCircle className="h-3.5 w-3.5" />
                            Add action
                          </button>
                        )}
                      </div>
                    )}
                  </Section>
                </div>

                <div className="px-4 sm:px-5 py-4 space-y-3">
                  <Section title="Buttons & Footer">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-500">Primary button</Label>
                        <Input placeholder="Manage Credits" value={modalConfig.primaryCta} onChange={e => setMC('primaryCta', e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-500">Secondary button</Label>
                        <Input placeholder="Continue" value={modalConfig.secondaryCta} onChange={e => setMC('secondaryCta', e.target.value)} />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">Footer note</Label>
                      <Textarea
                        rows={2}
                        placeholder="Credits are subject to campaign terms and expiration dates."
                        value={modalConfig.footerNote}
                        onChange={e => setMC('footerNote', e.target.value)}
                      />
                    </div>
                  </Section>
                </div>
              </div>

              <aside className="min-w-0 p-4 sm:p-5 bg-slate-50/90 dark:bg-slate-800/30 lg:max-h-[min(75vh,880px)] lg:overflow-y-auto lg:sticky lg:top-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3">Live preview</p>
                <SeasonalCreditsCongratulatoryPreview display={congratulatoryDisplay} className="mx-auto w-full max-w-[380px]" cardClassName="shadow-lg" />
                <p className="text-[11px] text-muted-foreground text-center mt-3 max-w-[380px] mx-auto">
                  Buttons are inert here; tenants get the real modal after distribution.
                </p>
              </aside>
            </div>
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-6 border-t">
          <Button type="button" variant="outline" onClick={() => onCancel?.()}>
            Cancel
          </Button>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            Create Campaign
          </Button>
        </div>
      </form>
  );
}
