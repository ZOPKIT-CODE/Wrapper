import React, { useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { X, CheckCircle, TrendingUp, Award, Gift, Zap, Star, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// ─── Config shape ─────────────────────────────────────────────────────────────

export type ModalTheme = 'dark' | 'emerald' | 'blue' | 'purple' | 'rose' | 'gold';

export interface ModalConfig {
  // Header
  theme?: ModalTheme;
  headerTitle?: string;
  headerSubtitle?: string;

  // Body
  headline?: string;
  description?: string;

  // Highlights
  showHighlights?: boolean;
  highlights?: Array<{ title: string; description: string }>;

  // Actions
  showActions?: boolean;
  actionsTitle?: string;
  actions?: string[];

  // Buttons
  primaryCta?: string;
  primaryCtaUrl?: string;
  secondaryCta?: string;

  // Footer
  footerNote?: string;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULTS = {
  theme: 'dark' as ModalTheme,
  headerTitle: 'Account Enhancement',
  headerSubtitle: 'Seasonal Credit Allocation',
  headline: 'Credits Successfully Allocated',
  description:
    'Your account has been enhanced with seasonal credits as part of our ongoing commitment to your success.',
  showHighlights: true,
  highlights: [
    { title: 'Premium Features', description: 'Access advanced tools and integrations' },
    { title: 'Usage Credits', description: 'Apply towards service consumption' },
  ],
  showActions: true,
  actionsTitle: 'Recommended Actions',
  actions: [
    'Review available premium features in your dashboard',
    'Explore integration options for your workflow',
    'Monitor credit usage and expiration dates',
  ],
  primaryCta: 'Manage Credits',
  primaryCtaUrl: '/dashboard/billing',
  secondaryCta: 'Continue',
  footerNote:
    'Credits are subject to campaign terms and expiration dates.\nContact support for assistance or questions.',
};

// ─── Theme system ─────────────────────────────────────────────────────────────

const THEME_STYLES: Record<ModalTheme, {
  gradient: string;
  badgeBg: string;
  iconBg: string;
  checkBg: string;
  checkColor: string;
  actionsBg: string;
  actionsBorder: string;
  actionsTitle: string;
  actionsBullet: string;
  actionsText: string;
  primaryBtn: string;
  highlightBg: string;
  highlightBorder: string;
  highlightIcon: string;
}> = {
  dark: {
    gradient: 'from-slate-900 via-slate-800 to-slate-900',
    badgeBg: 'bg-emerald-600 hover:bg-emerald-700',
    iconBg: 'bg-white/10',
    checkBg: 'bg-emerald-100',
    checkColor: 'text-emerald-600',
    actionsBg: 'bg-blue-50',
    actionsBorder: 'border-blue-200',
    actionsTitle: 'text-blue-900',
    actionsBullet: 'bg-blue-500',
    actionsText: 'text-blue-800',
    primaryBtn: 'bg-slate-900 hover:bg-slate-800',
    highlightBg: 'bg-slate-50',
    highlightBorder: 'border-slate-200',
    highlightIcon: 'text-slate-600',
  },
  emerald: {
    gradient: 'from-emerald-900 via-emerald-800 to-emerald-900',
    badgeBg: 'bg-white/20 hover:bg-white/30',
    iconBg: 'bg-white/15',
    checkBg: 'bg-emerald-100',
    checkColor: 'text-emerald-600',
    actionsBg: 'bg-emerald-50',
    actionsBorder: 'border-emerald-200',
    actionsTitle: 'text-emerald-900',
    actionsBullet: 'bg-emerald-500',
    actionsText: 'text-emerald-800',
    primaryBtn: 'bg-emerald-700 hover:bg-emerald-800',
    highlightBg: 'bg-emerald-50',
    highlightBorder: 'border-emerald-200',
    highlightIcon: 'text-emerald-600',
  },
  blue: {
    gradient: 'from-blue-900 via-blue-800 to-blue-900',
    badgeBg: 'bg-sky-400/30 hover:bg-sky-400/40',
    iconBg: 'bg-white/15',
    checkBg: 'bg-blue-100',
    checkColor: 'text-blue-600',
    actionsBg: 'bg-blue-50',
    actionsBorder: 'border-blue-200',
    actionsTitle: 'text-blue-900',
    actionsBullet: 'bg-blue-500',
    actionsText: 'text-blue-800',
    primaryBtn: 'bg-blue-800 hover:bg-blue-900',
    highlightBg: 'bg-blue-50',
    highlightBorder: 'border-blue-200',
    highlightIcon: 'text-blue-600',
  },
  purple: {
    gradient: 'from-purple-900 via-purple-800 to-purple-900',
    badgeBg: 'bg-purple-400/30 hover:bg-purple-400/40',
    iconBg: 'bg-white/15',
    checkBg: 'bg-purple-100',
    checkColor: 'text-purple-600',
    actionsBg: 'bg-purple-50',
    actionsBorder: 'border-purple-200',
    actionsTitle: 'text-purple-900',
    actionsBullet: 'bg-purple-500',
    actionsText: 'text-purple-800',
    primaryBtn: 'bg-purple-800 hover:bg-purple-900',
    highlightBg: 'bg-purple-50',
    highlightBorder: 'border-purple-200',
    highlightIcon: 'text-purple-600',
  },
  rose: {
    gradient: 'from-rose-800 via-rose-700 to-rose-800',
    badgeBg: 'bg-rose-400/30 hover:bg-rose-400/40',
    iconBg: 'bg-white/15',
    checkBg: 'bg-rose-100',
    checkColor: 'text-rose-600',
    actionsBg: 'bg-rose-50',
    actionsBorder: 'border-rose-200',
    actionsTitle: 'text-rose-900',
    actionsBullet: 'bg-rose-500',
    actionsText: 'text-rose-800',
    primaryBtn: 'bg-rose-700 hover:bg-rose-800',
    highlightBg: 'bg-rose-50',
    highlightBorder: 'border-rose-200',
    highlightIcon: 'text-rose-600',
  },
  gold: {
    gradient: 'from-amber-700 via-amber-600 to-amber-700',
    badgeBg: 'bg-white/20 hover:bg-white/30',
    iconBg: 'bg-white/15',
    checkBg: 'bg-amber-100',
    checkColor: 'text-amber-600',
    actionsBg: 'bg-amber-50',
    actionsBorder: 'border-amber-200',
    actionsTitle: 'text-amber-900',
    actionsBullet: 'bg-amber-500',
    actionsText: 'text-amber-800',
    primaryBtn: 'bg-amber-700 hover:bg-amber-800',
    highlightBg: 'bg-amber-50',
    highlightBorder: 'border-amber-200',
    highlightIcon: 'text-amber-600',
  },
};

const HIGHLIGHT_ICONS = [TrendingUp, Gift, Zap, Award, Star, Sparkles];

// ─── Merged display (shared by modal + inline preview) ───────────────────────

export type CongratulatoryDisplay = {
  cfg: {
    theme: ModalTheme;
    headerTitle: string;
    headerSubtitle: string;
    headline: string;
    description: string;
    showHighlights: boolean;
    highlights: Array<{ title: string; description: string }>;
    showActions: boolean;
    actionsTitle: string;
    actions: string[];
    primaryCta: string;
    primaryCtaUrl: string;
    secondaryCta: string;
    footerNote: string;
  };
  t: (typeof THEME_STYLES)[ModalTheme];
  displayCredits: number;
  displayCampaign: string;
};

export function mergeCongratulatoryDisplay(
  modalConfig: ModalConfig | undefined,
  creditsAmount = 200,
  campaignName = 'Seasonal Campaign',
): CongratulatoryDisplay {
  const cfg = {
    theme: (modalConfig?.theme ?? DEFAULTS.theme) as ModalTheme,
    headerTitle: modalConfig?.headerTitle || DEFAULTS.headerTitle,
    headerSubtitle: modalConfig?.headerSubtitle || DEFAULTS.headerSubtitle,
    headline: modalConfig?.headline || DEFAULTS.headline,
    description: modalConfig?.description || DEFAULTS.description,
    showHighlights: modalConfig?.showHighlights ?? DEFAULTS.showHighlights,
    highlights: modalConfig?.highlights?.length ? modalConfig.highlights : DEFAULTS.highlights,
    showActions: modalConfig?.showActions ?? DEFAULTS.showActions,
    actionsTitle: modalConfig?.actionsTitle || DEFAULTS.actionsTitle,
    actions: modalConfig?.actions?.length ? modalConfig.actions : DEFAULTS.actions,
    primaryCta: modalConfig?.primaryCta || DEFAULTS.primaryCta,
    primaryCtaUrl: modalConfig?.primaryCtaUrl || DEFAULTS.primaryCtaUrl,
    secondaryCta: modalConfig?.secondaryCta || DEFAULTS.secondaryCta,
    footerNote: modalConfig?.footerNote || DEFAULTS.footerNote,
  };

  const t = THEME_STYLES[cfg.theme];
  const displayCredits = creditsAmount || 200;
  const displayCampaign = campaignName || 'Campaign';

  return { cfg, t, displayCredits, displayCampaign };
}

export interface SeasonalCreditsCongratulatoryPreviewProps {
  display: CongratulatoryDisplay;
  className?: string;
  cardClassName?: string;
  onPrimaryClick?: () => void;
  onSecondaryClick?: () => void;
}

/** Renders the congratulatory card only (no overlay). Use with `mergeCongratulatoryDisplay`. */
export function SeasonalCreditsCongratulatoryPreview({
  display,
  className,
  cardClassName,
  onPrimaryClick,
  onSecondaryClick,
}: SeasonalCreditsCongratulatoryPreviewProps) {
  const { cfg, t, displayCredits, displayCampaign } = display;

  const handlePrimary = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onPrimaryClick?.();
  };

  const handleSecondary = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onSecondaryClick?.();
  };

  return (
    <div className={className}>
      <Card className={`overflow-hidden border-0 shadow-xl ${cardClassName ?? ''}`}>
        <div className={`bg-gradient-to-br ${t.gradient} px-5 sm:px-7 py-5 sm:py-6 text-white`}>
          <div className="flex items-center gap-3 mb-4">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${t.iconBg}`}>
              <Award className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold leading-tight truncate">{cfg.headerTitle}</h2>
              <p className="text-sm text-white/70 truncate">{cfg.headerSubtitle}</p>
            </div>
          </div>
          <div className="flex items-end justify-between gap-2">
            <div>
              <p className="text-2xl sm:text-3xl font-bold tracking-tight">{displayCredits.toLocaleString()}</p>
              <p className="text-sm text-white/60 mt-0.5">Credits Added</p>
            </div>
            <Badge className={`${t.badgeBg} border-0 text-white text-xs px-3 py-1 shrink-0 max-w-[140px] truncate`}>
              {displayCampaign}
            </Badge>
          </div>
        </div>

        <CardContent className="px-5 sm:px-7 py-5 sm:py-6 space-y-4 sm:space-y-5">
          <div className="text-center">
            <div className={`inline-flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full ${t.checkBg} mb-3`}>
              <CheckCircle className={`h-6 w-6 sm:h-7 sm:w-7 ${t.checkColor}`} />
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">{cfg.headline}</h3>
            <p className="text-sm text-gray-500 leading-relaxed">{cfg.description}</p>
          </div>

          {cfg.showHighlights && cfg.highlights.length > 0 && (
            <div className={`grid gap-2 sm:gap-3 ${cfg.highlights.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {cfg.highlights.slice(0, 4).map((h, i) => {
                const Icon = HIGHLIGHT_ICONS[i % HIGHLIGHT_ICONS.length];
                return (
                  <div key={i} className={`rounded-xl p-3 sm:p-4 border ${t.highlightBg} ${t.highlightBorder}`}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <Icon className={`h-4 w-4 shrink-0 ${t.highlightIcon}`} />
                      <span className="text-sm font-semibold text-gray-800 line-clamp-2">{h.title}</span>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed line-clamp-4">{h.description}</p>
                  </div>
                );
              })}
            </div>
          )}

          {cfg.showActions && cfg.actions.length > 0 && (
            <div className={`rounded-xl border p-3 sm:p-4 ${t.actionsBg} ${t.actionsBorder}`}>
              <h4 className={`mb-2 flex items-center gap-2 text-sm font-semibold ${t.actionsTitle}`}>
                <CheckCircle className="h-4 w-4 shrink-0" />
                {cfg.actionsTitle}
              </h4>
              <ul className="space-y-1.5">
                {cfg.actions.map((action, i) => (
                  <li key={i} className={`flex items-start gap-2 text-xs sm:text-sm ${t.actionsText}`}>
                    <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${t.actionsBullet}`} />
                    {action}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-2 sm:gap-3 pt-1">
            <Button type="button" onClick={handlePrimary} className={`flex-1 font-medium text-white text-sm ${t.primaryBtn}`}>
              {cfg.primaryCta}
            </Button>
            <Button type="button" onClick={handleSecondary} variant="outline" className="flex-1 border-gray-200 text-gray-700 hover:bg-gray-50 text-sm">
              {cfg.secondaryCta}
            </Button>
          </div>

          <p className="whitespace-pre-line text-center text-[11px] sm:text-xs text-gray-400 leading-relaxed">{cfg.footerNote}</p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Full-screen modal ────────────────────────────────────────────────────────

interface SeasonalCreditsCongratulatoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  creditsAmount?: number;
  campaignName?: string;
  modalConfig?: ModalConfig;
}

export const SeasonalCreditsCongratulatoryModal: React.FC<SeasonalCreditsCongratulatoryModalProps> = ({
  isOpen,
  onClose,
  creditsAmount = 200,
  campaignName = 'Seasonal Campaign',
  modalConfig,
}) => {
  const navigate = useNavigate();
  const display = mergeCongratulatoryDisplay(modalConfig, creditsAmount, campaignName);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : 'unset';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePrimary = () => {
    onClose();
    navigate({ to: display.cfg.primaryCtaUrl as any });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md">
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-2 -right-2 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white shadow-lg hover:bg-gray-50 text-gray-500 transition-colors"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <SeasonalCreditsCongratulatoryPreview display={display} cardClassName="shadow-2xl" onPrimaryClick={handlePrimary} onSecondaryClick={onClose} />
      </div>
    </div>
  );
};
