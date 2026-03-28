import React, { useState, forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/components/theme/ThemeProvider';

interface PearlButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  className?: string;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  color?: 'blue' | 'sky' | 'indigo' | 'cyan' | 'emerald' | 'rose' | 'amber' | 'violet' | 'purple' | 'orange' | 'red' | 'yellow';
}

export const PearlButton = forwardRef<HTMLButtonElement, PearlButtonProps>(({
  children,
  className,
  variant = 'primary',
  size = 'md',
  color = 'blue',
  ...props
}, ref) => {
  const [isHovered, setIsHovered] = useState(false);
  const { actualTheme } = useTheme();

  const getVariantStyles = () => {
    const colorClassMap: Record<string, string> = {
      blue: '[#1B2E5A]',
      sky: 'sky-500',
      indigo: 'indigo-600',
      cyan: 'cyan-500',
      emerald: 'emerald-600',
      rose: 'rose-500',
      amber: 'amber-500',
      violet: 'violet-600',
      purple: 'purple-600',
      orange: 'orange-500',
      red: 'red-600',
      yellow: 'yellow-500'
    };

    const themeColorClass = colorClassMap[color] || 'blue-600';
    const isLightColor = color === 'yellow' || color === 'amber' || color === 'sky' || color === 'cyan';

    const baseStyles = {
      light: {
        primary: {
          background: `bg-${themeColorClass}`,
          text: isLightColor ? 'text-slate-900 font-black tracking-tight' : 'text-white font-bold tracking-tight',
          shadow: `shadow-[inset_0_2px_4px_rgba(255,255,255,0.4),0_10px_20px_rgba(0,0,0,0.1)]`,
          hoverShadow: `hover:shadow-[inset_0_2px_4px_rgba(255,255,255,0.5),0_15px_30px_rgba(0,0,0,0.15)]`,
          activeShadow: `active:shadow-[inset_0_4px_8px_rgba(0,0,0,0.3)]`,
          overlayBg: 'bg-white/10',
          highlightShadow: 'inset 0 12px 10px -10px rgba(255, 255, 255, 1)',
          highlightBg: 'linear-gradient(180deg, rgba(255, 255, 255, 0.4) 0%, rgba(255, 255, 255, 0.05) 45%, rgba(255, 255, 255, 0) 100%)'
        },
        secondary: {
          background: 'bg-slate-100',
          text: 'text-slate-700 font-medium',
          shadow: 'shadow-sm',
          hoverShadow: 'hover:shadow-md',
          activeShadow: 'active:shadow-inner',
          overlayBg: 'bg-slate-500/5',
          highlightShadow: 'none',
          highlightBg: 'transparent'
        },
        outline: {
          background: 'bg-transparent border border-slate-200',
          text: themeColorClass.startsWith('[') ? `text-${themeColorClass}` : `text-${themeColorClass.split('-')[0]}-600`,
          shadow: 'shadow-none',
          hoverShadow: 'hover:bg-slate-50',
          activeShadow: 'active:bg-slate-100',
          overlayBg: 'bg-black/5',
          highlightShadow: 'none',
          highlightBg: 'transparent'
        }
      },
      monochrome: {
        primary: {
          background: 'bg-slate-900',
          text: 'text-white font-semibold',
          shadow: 'shadow-md',
          hoverShadow: 'hover:shadow-lg',
          activeShadow: 'active:shadow-inner',
          overlayBg: 'bg-white/5',
          highlightShadow: 'none',
          highlightBg: 'transparent'
        },
        secondary: {
          background: 'bg-slate-200',
          text: 'text-slate-900',
          shadow: 'shadow-md',
          hoverShadow: 'hover:shadow-lg',
          activeShadow: 'active:shadow-inner',
          overlayBg: 'bg-slate-900/5',
          highlightShadow: 'none',
          highlightBg: 'transparent'
        },
        outline: {
          background: 'bg-transparent border border-slate-300',
          text: 'text-slate-800',
          shadow: 'shadow-none',
          hoverShadow: 'hover:shadow-sm',
          activeShadow: 'active:bg-slate-100',
          overlayBg: 'bg-slate-900/5',
          highlightShadow: 'none',
          highlightBg: 'transparent'
        }
      },
      dark: {
        primary: {
          background: `bg-${themeColorClass}`,
          text: isLightColor ? 'text-slate-900 font-black' : 'text-white font-bold',
          shadow: 'shadow-[inset_0_2px_4px_rgba(255,255,255,0.2),0_10px_30px_rgba(0,0,0,0.5)]',
          hoverShadow: 'hover:shadow-[inset_0_2px_4px_rgba(255,255,255,0.3),0_15px_40px_rgba(0,0,0,0.6)]',
          activeShadow: 'active:shadow-inner',
          overlayBg: 'bg-white/10',
          highlightShadow: 'inset 0 12px 10px -10px rgba(255, 255, 255, 0.4)',
          highlightBg: 'linear-gradient(180deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.02) 45%, rgba(255, 255, 255, 0) 100%)'
        },
        secondary: {
          background: 'bg-slate-800',
          text: 'text-slate-300',
          shadow: 'shadow-md',
          hoverShadow: 'hover:shadow-lg',
          activeShadow: 'active:shadow-inner',
          overlayBg: 'bg-white/5',
          highlightShadow: 'none',
          highlightBg: 'transparent'
        },
        outline: {
          background: 'bg-transparent border border-white/20',
          text: 'text-white',
          shadow: 'shadow-none',
          hoverShadow: 'hover:bg-white/5',
          activeShadow: 'active:bg-white/10',
          overlayBg: 'bg-white/5',
          highlightShadow: 'none',
          highlightBg: 'transparent'
        }
      }
    };

    const themeKey = (actualTheme === 'dark' || actualTheme === 'light' || actualTheme === 'monochrome') ? actualTheme : 'light';
    const variantKey = variant || 'primary';

    return baseStyles[themeKey][variantKey];
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return 'text-xs px-5 py-2';
      case 'lg':
        return 'text-lg px-10 py-5';
      default:
        return 'text-base px-8 py-3.5';
    }
  };

  const variantStyles = getVariantStyles();
  const sizeStyles = getSizeStyles();

  return (
    <button
      ref={ref}
      className={cn(
        "outline-none cursor-pointer border-0 relative rounded-full transition-all duration-300 ease-out",
        variantStyles.background,
        variantStyles.shadow,
        variantStyles.hoverShadow,
        variantStyles.activeShadow,
        "active:scale-95 active:translate-y-0.5",
        "hover:-translate-y-1",
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      {...props}
    >
      <div className={cn(
        "rounded-full relative overflow-hidden flex items-center justify-center gap-3",
        variantStyles.text,
        sizeStyles
      )}>
        {/* Animated Gloss Overlay */}
        <div
          className={cn("absolute inset-0 rounded-full transition-opacity duration-500", variantStyles.overlayBg)}
          style={{ opacity: isHovered ? 1 : 0 }}
        />

        {/* The Spherical Gloss Effect (Top Highlight) */}
        {variant !== 'outline' && (
          <div
            className="absolute left-[8%] right-[8%] top-[8%] h-[50%] rounded-full transition-all duration-500 pointer-events-none"
            style={{
              opacity: isHovered ? 0.9 : 0.7,
              transform: isHovered ? 'translateY(2%) scaleX(1.05)' : 'translateY(0) scaleX(1)',
              boxShadow: variantStyles.highlightShadow,
              background: variantStyles.highlightBg,
            }}
          />
        )}

        {/* Content */}
        <span
          className="relative z-10 flex items-center justify-center gap-2 transition-transform duration-300"
          style={{ transform: isHovered ? 'translateY(-1px)' : 'translateY(0)' }}
        >
          {children}
        </span>
      </div>
    </button>
  );
});

PearlButton.displayName = 'PearlButton';
