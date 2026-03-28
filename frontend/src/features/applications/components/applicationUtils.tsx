import {
  Users,
  Building,
  TrendingUp,
  Settings,
  PieChart,
  Package,
  Activity,
} from "lucide-react";
import { AppCode, ApplicationStatus } from "@/types/application";
import { memo } from "react";

// Memoized icon components to prevent unnecessary re-renders
const IconComponents = {
  crm: memo(() => <Users className="w-6 h-6" />),
  hr: memo(() => <Building className="w-6 h-6" />),
  affiliate: memo(() => <TrendingUp className="w-6 h-6" />),
  system: memo(() => <Settings className="w-6 h-6" />),
  finance: memo(() => <PieChart className="w-6 h-6" />),
  inventory: memo(() => <Package className="w-6 h-6" />),
  analytics: memo(() => <Activity className="w-6 h-6" />),
} as const;

/**
 * Get appropriate icon for application based on app code
 */
export const getApplicationIcon = (appCode: string) => {
  const IconComponent = IconComponents[appCode as AppCode];
  return IconComponent ? <IconComponent /> : <Package className="w-6 h-6" />;
};

/**
 * Get status color classes for application status badges
 * Note: Theme-aware colors are applied in the components that use this function
 */
export const getStatusColor = (status: string): string => {
  const statusColors: Record<ApplicationStatus, string> = {
    active: "bg-green-100 text-green-800",
    inactive: "bg-gray-100 text-gray-800",
    maintenance: "bg-yellow-100 text-yellow-800",
  };

  return statusColors[status.toLowerCase() as ApplicationStatus] || statusColors.inactive;
};

// Theme color utilities for consistent application card styling
export const getThemeColors = (theme: 'light' | 'dark' | 'monochrome') => {
  const themes = {
    light: {
      cardBg: 'bg-white/80 backdrop-blur-sm',
      cardBorder: 'border-gray-200/50',
      cardHover: 'hover:bg-white/90',
      iconBg: 'bg-gray-100/80',
      iconColor: 'text-gray-700',
      titleColor: 'text-[#1B2E5A]',
      subtitleColor: 'text-gray-600',
      descriptionColor: 'text-gray-700',
      badgeBg: 'bg-gray-100',
      badgeText: 'text-gray-800',
      badgeBorder: 'border-gray-200',
      buttonBg: 'bg-gray-100 hover:bg-gray-200',
      buttonText: 'text-gray-900',
      buttonIcon: 'text-gray-700',
      statusActiveBg: 'bg-emerald-50',
      statusActiveText: 'text-emerald-700',
      statusActiveBorder: 'border-emerald-200',
      statusInactiveBg: 'bg-red-50',
      statusInactiveText: 'text-red-700',
      statusInactiveBorder: 'border-red-200',
    },
    dark: {
      cardBg: 'bg-slate-800/80 backdrop-blur-sm',
      cardBorder: 'border-slate-700/50',
      cardHover: 'hover:bg-slate-800/90',
      iconBg: 'bg-slate-700/80',
      iconColor: 'text-slate-200',
      titleColor: 'text-white',
      subtitleColor: 'text-slate-400',
      descriptionColor: 'text-slate-300',
      badgeBg: 'bg-slate-700',
      badgeText: 'text-slate-200',
      badgeBorder: 'border-slate-600',
      buttonBg: 'bg-slate-700 hover:bg-slate-600',
      buttonText: 'text-white',
      buttonIcon: 'text-slate-200',
      statusActiveBg: 'bg-emerald-900/30',
      statusActiveText: 'text-emerald-400',
      statusActiveBorder: 'border-emerald-800',
      statusInactiveBg: 'bg-red-900/30',
      statusInactiveText: 'text-red-400',
      statusInactiveBorder: 'border-red-800',
    },
    monochrome: {
      cardBg: 'bg-gray-100/80 backdrop-blur-sm',
      cardBorder: 'border-gray-300/50',
      cardHover: 'hover:bg-gray-200/80',
      iconBg: 'bg-gray-200/80',
      iconColor: 'text-gray-700',
      titleColor: 'text-[#1B2E5A]',
      subtitleColor: 'text-gray-500',
      descriptionColor: 'text-gray-600',
      badgeBg: 'bg-gray-200',
      badgeText: 'text-gray-700',
      badgeBorder: 'border-gray-300',
      buttonBg: 'bg-gray-300 hover:bg-gray-400',
      buttonText: 'text-gray-900',
      buttonIcon: 'text-gray-700',
      statusActiveBg: 'bg-gray-200/50',
      statusActiveText: 'text-gray-700',
      statusActiveBorder: 'border-gray-300',
      statusInactiveBg: 'bg-gray-300/50',
      statusInactiveText: 'text-gray-600',
      statusInactiveBorder: 'border-gray-400',
    }
  };

  return themes[theme] || themes.light;
};

// Get status-specific colors
export const getStatusColors = (isEnabled: boolean, theme: 'light' | 'dark' | 'monochrome') => {
  const colors = getThemeColors(theme);
  return isEnabled
    ? {
        bg: colors.statusActiveBg,
        text: colors.statusActiveText,
        border: colors.statusActiveBorder,
        dot: colors.statusActiveText,
      }
    : {
        bg: colors.statusInactiveBg,
        text: colors.statusInactiveText,
        border: colors.statusInactiveBorder,
        dot: colors.statusInactiveText,
      };
};
