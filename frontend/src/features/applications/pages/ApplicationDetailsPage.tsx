import type { JSX } from "react";
import { useParams, useNavigate } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { Badge } from "@/components/ui";
import { Application } from "@/types/application";
import { getApplicationIcon } from "@/features/applications/components/applicationUtils";
import { cn } from "@/lib/utils";
import {
  DASHBOARD_PAGE_DESCRIPTION_CLASS,
  DASHBOARD_PAGE_TITLE_CLASS,
} from '@/components/dashboard/DashboardPageHeader';
import {
  Crown,
  CheckCircle,
  XCircle,
  ExternalLink,
  Lock,
  Edit,
  Eye,
  Hash,
  Settings,
  Play
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Container } from '@/components/common/Page';
import { Button } from '@/components/ui/button';
import { useApplications } from '@/hooks/useApplications';
import AnimatedLoader from '@/components/common/feedback/AnimatedLoader';
import { AlertCircle } from 'lucide-react';
import { useBreadcrumbLabel } from '@/contexts/BreadcrumbLabelContext';
import { useEffect } from 'react';
import { config } from '@/lib/config';

export function ApplicationDetailsPage() {
  const { appId } = useParams({ strict: false });
  const navigate = useNavigate();
  const { applications, isLoading } = useApplications();
  const { setLastSegmentLabel } = useBreadcrumbLabel();

  // Find application by appId
  const application = applications.find((app: Application) => app.appId === appId) || null;

  // Set breadcrumb label when application is loaded, clear on unmount
  useEffect(() => {
    if (application?.appName) {
      setLastSegmentLabel(application.appName);
    } else if (application?.appCode) {
      setLastSegmentLabel(application.appCode);
    }
    
    return () => {
      setLastSegmentLabel(null);
    };
  }, [application?.appName, application?.appCode, setLastSegmentLabel]);

  if (isLoading) {
    return (
      <Container>
        <div className="flex items-center justify-center min-h-[400px]">
          <AnimatedLoader size="md" />
        </div>
      </Container>
    );
  }

  if (!application) {
    return (
      <Container>
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
          <AlertCircle className="h-12 w-12 text-gray-400" />
          <h2 className="text-xl font-semibold">Application Not Found</h2>
          <p className="text-gray-600">The application you're looking for doesn't exist or has been removed.</p>
          <Button onClick={() => navigate({ to: '/dashboard/applications' })} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Applications
          </Button>
        </div>
      </Container>
    );
  }

  const {
    appName,
    appCode,
    description,
    subscriptionTier,
    isEnabled,
    modules,
    enabledModules,
    enabledModulesPermissions,
    customPermissions,
    baseUrl,
  } = application;

  const getApplicationUrl = (): string => {
    if (baseUrl) return baseUrl;
    const baseDomain = window.location.origin;
    const urlPatterns: Record<string, string> = {
      affiliateConnect: `${baseDomain}/affiliate`,
      crm: config.CRM_DOMAIN,
      hr: `${baseDomain}/hr`,
    };
    return urlPatterns[appCode] || `${baseDomain}/apps/${appCode}`;
  };

  const applicationUrl = getApplicationUrl();

  const getMetricCardClasses = () => {
    return "bg-white dark:bg-slate-800 p-6 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm";
  };

  const getIconContainerClasses = () => {
    return "p-3 bg-slate-100 dark:bg-slate-700 rounded-lg";
  };

  return (
    <Container>
      <div className="space-y-6">
        {/* Header with Back Button */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: '/dashboard/applications' })}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Applications
          </Button>
        </div>

        {/* Header Section */}
        <div className={cn(
          "relative overflow-hidden rounded-2xl",
          "bg-slate-50 dark:bg-slate-800 px-8 py-6 border border-slate-200 dark:border-slate-700"
        )}>
          <div className="relative flex items-center gap-4">
            <div className="relative">
              <div className={cn(
                "p-4 rounded-xl",
                "bg-slate-100 dark:bg-slate-700"
              )}>
                <div className={cn("text-2xl", "text-slate-600 dark:text-slate-400")}>
                  {getApplicationIcon(appCode)}
                </div>
              </div>
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className={cn(DASHBOARD_PAGE_TITLE_CLASS, 'drop-shadow-sm')}>
                  {appName || "Unknown Application"}
                </h1>
                <div className={cn(
                  "relative px-3 py-1 rounded-full text-xs font-semibold",
                  `border ${
                      isEnabled
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700'
                        : 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700'
                    }`
                )}>
                  <span className="relative">{isEnabled ? "Active" : "Inactive"}</span>
                </div>
              </div>
              <p className={cn(DASHBOARD_PAGE_DESCRIPTION_CLASS, 'text-sm leading-relaxed max-w-2xl')}>
                {description || "No description available for this application."}
              </p>
            </div>
          </div>
        </div>

        {/* Application settings */}
        <div className={cn(
          "relative rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6",
          "bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700"
        )}>
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2.5 rounded-xl",
              "bg-slate-200/80 dark:bg-slate-700"
            )}>
              <Settings className="h-6 w-6 text-slate-700 dark:text-slate-300" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[#1B2E5A] dark:text-white">Application settings</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Launch the app or open in a new tab
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => { window.location.href = applicationUrl; }}
              className="gap-2 bg-primary hover:bg-primary/90"
            >
              <Play className="h-4 w-4" />
              Open application
            </Button>
            <Button
              variant="outline"
              onClick={() => window.open(applicationUrl, '_blank', 'noopener,noreferrer')}
              className="gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Open in new tab
            </Button>
          </div>
        </div>

        {/* Content Area */}
        <div className={cn(
          "relative space-y-10",
          "p-8"
        )}>
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Application Code Card */}
            <div className={getMetricCardClasses()}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">Application Code</p>
                  <p className="text-2xl font-bold text-[#1B2E5A] dark:text-white mt-2">{appCode}</p>
                </div>
                <div className="relative">
                  <div className={getIconContainerClasses()}>
                    <span className="text-slate-800 dark:text-slate-200 font-mono text-sm">{appCode.substring(0, 3)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Subscription Plan Card */}
            <div className={getMetricCardClasses()}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">Subscription Plan</p>
                  <p className="text-xl font-semibold text-[#1B2E5A] dark:text-white mt-2">
                    {typeof subscriptionTier === "object" ? "Enterprise" : subscriptionTier || "Basic"}
                  </p>
                </div>
                <div className="relative">
                  <div className={getIconContainerClasses()}>
                    <Crown className="text-purple-700 dark:text-purple-300 w-6 h-6" />
                  </div>
                </div>
              </div>
            </div>

            {/* Access URL Card */}
            {baseUrl && (
              <div className={getMetricCardClasses()}>
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">Access URL</p>
                    <a
                      href={baseUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-lg font-medium text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 truncate block mt-2 transition-colors"
                      title={baseUrl}
                    >
                      {new URL(baseUrl).hostname}
                    </a>
                  </div>
                  <div className="relative ml-4">
                    <div className={getIconContainerClasses()}>
                      <ExternalLink className="text-cyan-700 dark:text-cyan-300 w-6 h-6" />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Application Modules */}
          {(() => {
            const moduleList = Array.isArray(modules) ? modules : [];
            return moduleList.length > 0 && (
              <div className="relative">
                <div className="pt-8">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h2 className="text-2xl font-bold text-[#1B2E5A] dark:text-white">Application Modules</h2>
                      <p className="text-slate-600 dark:text-slate-400 mt-2">
                        Feature capabilities and system integrations
                      </p>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <CheckCircle className="w-5 h-5 text-emerald-500" />
                        </div>
                        <span className="text-slate-700 dark:text-slate-300 font-medium">Enabled</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <XCircle className="w-5 h-5 text-slate-400" />
                        </div>
                        <span className="text-slate-700 dark:text-slate-300 font-medium">Disabled</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-6">
                    {moduleList.map((module, index) => (
                      <ModuleCard
                        key={`${module.moduleId ?? module.moduleCode}-${index}`}
                        module={module}
                        isEnabled={Array.isArray(enabledModules) && enabledModules.includes(module.moduleCode)}
                        modulePermissions={enabledModulesPermissions?.[module.moduleCode] || []}
                        customPermissions={customPermissions?.[module.moduleCode] || []}
                      />
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </Container>
  );
}

// Role-builder style: analyze permission type for icon and risk styling
function analyzePermissionType(permCode: string): { risk: 'high' | 'medium' | 'low'; icon: JSX.Element } {
  const code = permCode.toLowerCase();
  if (code.includes('admin') || code.includes('manage') || code.includes('delete')) {
    return { risk: 'high', icon: <Lock className="w-3.5 h-3.5" /> };
  }
  if (code.includes('write') || code.includes('edit') || code.includes('create') || code.includes('update')) {
    return { risk: 'medium', icon: <Edit className="w-3.5 h-3.5" /> };
  }
  return { risk: 'low', icon: <Eye className="w-3.5 h-3.5" /> };
}

// Module Card Component - permissions displayed like Role Builder
interface ModuleCardProps {
  module: any;
  isEnabled: boolean;
  modulePermissions: string[];
  customPermissions: string[];
}

function ModuleCard({ module, isEnabled, modulePermissions, customPermissions }: ModuleCardProps) {
  const { moduleName, description, isCore, permissions } = module;

  const permissionCodes = Array.isArray(modulePermissions)
    ? modulePermissions.map((p: any) => (typeof p === 'string' ? p : (p?.code ?? p?.name ?? '')).toString()).filter(Boolean)
    : [];
  const customCodes = Array.isArray(customPermissions) ? customPermissions : [];

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-4">
              <div className="relative">
                <div className={`w-4 h-4 rounded-full shadow-lg ${isEnabled ? 'bg-emerald-400' : 'bg-slate-400'}`} />
              </div>
              <h4 className="font-semibold text-[#1B2E5A] dark:text-white text-lg">
                {moduleName || "Unknown Module"}
              </h4>
            </div>

            <div className="flex items-center gap-3 mb-4">
              <Badge
                variant={isCore ? "default" : "outline"}
                className={cn(
                  "text-xs backdrop-blur-sm",
                  isCore
                    ? "bg-slate-900/20 text-slate-800 dark:bg-slate-700/50 dark:text-slate-300 border-slate-400/50"
                    : "border-slate-400/50 text-slate-700 dark:text-slate-400 bg-white/20 dark:bg-slate-800/20"
                )}
              >
                {isCore ? "Core Module" : "Optional Module"}
              </Badge>
              {isEnabled && (
                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/20 backdrop-blur-sm px-3 py-1 rounded-full border border-emerald-400/30">
                  Active
                </span>
              )}
            </div>
          </div>
        </div>

        <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed mb-6">
          {description || "No description available for this module."}
        </p>

        {/* Permissions - Role Builder style grid */}
        {permissions && permissions.length > 0 && (
          <div className="relative pt-4">
            <div className="flex items-center justify-between mb-4">
              <h5 className="font-medium text-[#1B2E5A] dark:text-white text-sm">
                Permissions
              </h5>
              <div className="text-xs text-slate-700 dark:text-slate-300 bg-white/60 dark:bg-white/20 backdrop-blur-md px-3 py-1 rounded-full border border-white/40 dark:border-white/30 shadow-sm">
                {permissions.length} total
              </div>
            </div>
            <TooltipProvider delayDuration={300}>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                {permissions.map((permission: any, index: number) => {
                  const code = typeof permission === "string" ? permission : (permission.code ?? permission.name ?? "unknown");
                  const name = typeof permission === "object" && permission?.name ? permission.name : code;
                  const desc = typeof permission === "object" ? permission?.description : undefined;
                  const isActive =
                    isEnabled &&
                    (permissionCodes.includes(code) || customCodes.includes(code));
                  const { icon, risk } = analyzePermissionType(code);
                  const tooltipText = [name, desc].filter(Boolean).join(" — ") || code;

                  return (
                    <Tooltip key={`${code}-${index}`}>
                      <TooltipTrigger asChild>
                        <div
                          className={cn(
                            "relative flex flex-col gap-2 p-3 rounded-2xl border transition-all text-left select-none cursor-default",
                            isActive
                              ? risk === "high"
                                ? "bg-rose-50 border-rose-200 dark:bg-rose-900/20 dark:border-rose-800 shadow-rose-500/5 shadow-inner"
                                : risk === "medium"
                                  ? "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800 shadow-amber-500/5 shadow-inner"
                                  : "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 shadow-blue-500/5 shadow-inner"
                              : "bg-white dark:bg-slate-900/40 border-slate-100 dark:border-slate-800"
                          )}
                        >
                          <div className="flex items-start justify-between">
                            <div className={cn(
                              "p-1 rounded-lg",
                              isActive ? "bg-white/50 dark:bg-slate-950/50" : "opacity-40"
                            )}>
                              {icon}
                            </div>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[7px] h-3.5 px-1 font-black leading-none uppercase border-none",
                                isActive ? "text-blue-600 dark:text-blue-400" : "text-slate-300 dark:text-slate-600"
                              )}
                            >
                              {isActive ? "ACTIVE" : "READY"}
                            </Badge>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className={cn(
                              "text-[10px] font-black uppercase leading-tight line-clamp-2 tracking-tight mb-0.5 break-words",
                              isActive ? "text-slate-900 dark:text-white" : "text-slate-500 dark:text-slate-400"
                            )}>
                              {name}
                            </div>
                            <div className="text-[8px] font-bold text-slate-400 flex items-center gap-1 uppercase tracking-tighter">
                              <Hash className="w-2 h-2" /> {code}
                            </div>
                          </div>
                          {isActive && (
                            <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-blue-500" />
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs text-xs bg-slate-900 text-white border-slate-700">
                        {tooltipText}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </TooltipProvider>
          </div>
        )}
      </div>
    </div>
  );
}
