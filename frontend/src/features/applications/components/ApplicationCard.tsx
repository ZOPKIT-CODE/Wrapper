import React, { memo, useMemo } from 'react';
import { Database, CreditCard, Package, ShieldCheck, ExternalLink, ArrowRight, Layers, Layout, Cpu, Zap, Activity, Shield, Settings } from 'lucide-react';
import { Application, AppThemeConfig, ThemeType } from '@/types/application';
import { useTheme } from '@/components/theme/ThemeProvider';
import { cn } from '@/lib/utils';
import { config } from '@/lib/config';
import { ApplicationCardDecoration } from './ApplicationCardDecoration';
import { PearlButton } from '@/components/ui/pearl-button';

// Static class maps — full literal strings so Tailwind JIT includes them in the build
const THEME_STATIC: Record<ThemeType, { colorClass: string; bgGradient: string; glowClass: string }> = {
  cyan:    { colorClass: 'text-cyan-500',    bgGradient: 'from-cyan-500/20 via-cyan-500/5 to-transparent',    glowClass: 'group-hover:shadow-cyan-500/40' },
  indigo:  { colorClass: 'text-indigo-500',  bgGradient: 'from-indigo-500/20 via-indigo-500/5 to-transparent',  glowClass: 'group-hover:shadow-indigo-500/40' },
  emerald: { colorClass: 'text-emerald-500', bgGradient: 'from-emerald-500/20 via-emerald-500/5 to-transparent', glowClass: 'group-hover:shadow-emerald-500/40' },
  rose:    { colorClass: 'text-rose-500',    bgGradient: 'from-rose-500/20 via-rose-500/5 to-transparent',    glowClass: 'group-hover:shadow-rose-500/40' },
  amber:   { colorClass: 'text-amber-500',   bgGradient: 'from-amber-500/20 via-amber-500/5 to-transparent',   glowClass: 'group-hover:shadow-amber-500/40' },
  purple:  { colorClass: 'text-purple-500',  bgGradient: 'from-purple-500/20 via-purple-500/5 to-transparent',  glowClass: 'group-hover:shadow-purple-500/40' },
  red:     { colorClass: 'text-red-500',     bgGradient: 'from-red-500/20 via-red-500/5 to-transparent',     glowClass: 'group-hover:shadow-red-500/40' },
  blue:    { colorClass: 'text-blue-500',    bgGradient: 'from-blue-500/20 via-blue-500/5 to-transparent',    glowClass: 'group-hover:shadow-blue-500/40' },
  violet:  { colorClass: 'text-violet-500',  bgGradient: 'from-violet-500/20 via-violet-500/5 to-transparent',  glowClass: 'group-hover:shadow-violet-500/40' },
  orange:  { colorClass: 'text-orange-500',  bgGradient: 'from-orange-500/20 via-orange-500/5 to-transparent',  glowClass: 'group-hover:shadow-orange-500/40' },
  yellow:  { colorClass: 'text-yellow-500',  bgGradient: 'from-yellow-500/20 via-yellow-500/5 to-transparent',  glowClass: 'group-hover:shadow-yellow-500/40' },
};

const THEME_POOL: { type: ThemeType; color: string; icon: React.ReactNode }[] = [
  { type: 'cyan',    color: 'cyan',    icon: <Zap className="w-8 h-8" /> },
  { type: 'indigo',  color: 'indigo',  icon: <Layers className="w-8 h-8" /> },
  { type: 'emerald', color: 'emerald', icon: <Activity className="w-8 h-8" /> },
  { type: 'rose',    color: 'rose',    icon: <Shield className="w-8 h-8" /> },
  { type: 'amber',   color: 'amber',   icon: <Cpu className="w-8 h-8" /> },
  { type: 'purple',  color: 'purple',  icon: <Layout className="w-8 h-8" /> },
  { type: 'red',     color: 'red',     icon: <Package className="w-8 h-8" /> },
  { type: 'blue',    color: 'blue',    icon: <Database className="w-8 h-8" /> },
  { type: 'violet',  color: 'violet',  icon: <ShieldCheck className="w-8 h-8" /> },
  { type: 'orange',  color: 'orange',  icon: <Zap className="w-8 h-8" /> },
  { type: 'yellow',  color: 'yellow',  icon: <Activity className="w-8 h-8" /> },
];

const getAppThemeByIndex = (index: number): AppThemeConfig => {
  const theme = THEME_POOL[index % THEME_POOL.length];
  const statics = THEME_STATIC[theme.type];

  return {
    type: theme.type,
    color: theme.color,
    colorClass: statics.colorClass,
    bgGradient: statics.bgGradient,
    glowClass: statics.glowClass,
    icon: theme.icon
  };
};

const getApplicationUrl = (application: Application): string => {
  const apiBaseUrl =
    application.baseUrl ||
    (application as any).base_url ||
    (application as any).baseurl;

  if (apiBaseUrl) return apiBaseUrl;

  const baseDomain = window.location.origin;
  const urlPatterns: Record<string, string> = {
    affiliateConnect: `${baseDomain}/affiliate`,
    crm: config.CRM_DOMAIN,
    hr: `${baseDomain}/hr`,
  };

  return urlPatterns[application.appCode] || `${baseDomain}/apps/${application.appCode}`;
};

interface ApplicationCardProps {
  application: Application;
  onView: (app: Application) => void;
  index: number;
}

export const ApplicationCard = memo(function ApplicationCard({ application, onView, index }: ApplicationCardProps) {
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';
  const theme = useMemo(() => getAppThemeByIndex(index), [index]);

  const handleLaunch = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = getApplicationUrl(application);
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleCardClick = () => {
    const url = getApplicationUrl(application);
    if (url) {
      window.location.href = url;
    }
  };

  const handleOpenSettings = (e: React.MouseEvent) => {
    e.stopPropagation();
    onView(application);
  };

  const handleExternalLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = getApplicationUrl(application);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="w-full h-[280px]">
      <div
        onClick={handleCardClick}
        className={cn(
          "card-inner group relative h-full w-full rounded-[32px] p-8 cursor-pointer overflow-hidden border",
          isDark
            ? "bg-slate-900/80 border-white/10 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)]"
            : "bg-white border-slate-200 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.08)]",
          theme.glowClass
        )}
      >
        {/* Persistent background gradient */}
        <div className={cn(
          "absolute inset-0 opacity-20 pointer-events-none",
          "bg-[radial-gradient(circle_at_50%_120%,var(--tw-gradient-from),transparent_70%)]",
          theme.bgGradient
        )} />

        {/* Decoration */}
        <ApplicationCardDecoration
          type={theme.type}
          className="opacity-80 origin-bottom-right"
        />

        {/* Content Container */}
        <div className="relative z-10 h-full flex flex-col items-center justify-between">
          {/* Header */}
          <div className="flex justify-between items-start w-full mb-4">
            <div className={cn(
              "relative w-20 h-20 rounded-[24px] flex items-center justify-center",
              isDark ? "bg-slate-800/90 shadow-xl" : "bg-slate-50 shadow-sm",
              theme.colorClass
            )}>
              {theme.icon}
              <div className={cn("absolute inset-0 rounded-[24px] opacity-15 blur-xl", theme.colorClass.replace('text-', 'bg-'))} />
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleOpenSettings}
                className={cn(
                  "w-9 h-9 rounded-full border flex items-center justify-center opacity-60 hover:opacity-100",
                  isDark ? "border-white/10 text-slate-400 hover:bg-white/10" : "border-slate-200 text-slate-500 hover:bg-slate-100",
                  "group-hover:opacity-100 group-hover:bg-white dark:group-hover:bg-slate-800"
                )}
                title="Application settings"
              >
                <Settings className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleExternalLink}
                className={cn(
                  "w-9 h-9 rounded-full border flex items-center justify-center opacity-60 hover:opacity-100",
                  isDark ? "border-white/10 text-slate-400 hover:bg-white/10" : "border-slate-200 text-slate-500 hover:bg-slate-100",
                  "group-hover:opacity-100 group-hover:bg-white dark:group-hover:bg-slate-800"
                )}
                title="Open in new tab"
              >
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body - Centered Icon-like Layout */}
          <div className="flex-1 flex flex-col items-center justify-center w-full space-y-3">
            <h3 className={cn(
              "text-xl font-black tracking-tight leading-tight uppercase text-center",
              isDark ? "text-white" : "text-[#1B2E5A]"
            )}>
              {application.appName}
            </h3>
          </div>

          {/* Launch Button */}
          <div className="mt-4 flex items-center justify-center w-full">
            <PearlButton
              onClick={handleLaunch}
              size="sm"
              color={theme.color as any}
              className="w-full text-sm font-bold uppercase tracking-wider gap-2"
            >
              Launch
              <ArrowRight className="w-4 h-4" />
            </PearlButton>
          </div>
        </div>

      </div>
    </div>
  );
});