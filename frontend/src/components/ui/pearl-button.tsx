import React, { useState, forwardRef } from 'react'
import { cn } from '@/lib/utils'
interface PearlButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
  className?: string
  variant?: 'primary' | 'secondary' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  color?:
    | 'blue'
    | 'sky'
    | 'indigo'
    | 'cyan'
    | 'emerald'
    | 'rose'
    | 'amber'
    | 'violet'
    | 'purple'
    | 'orange'
    | 'red'
    | 'yellow'
}

export const PearlButton = forwardRef<HTMLButtonElement, PearlButtonProps>(
  (
    {
      children,
      className,
      variant = 'primary',
      size = 'md',
      color = 'blue',
      ...props
    },
    ref
  ) => {
    const [isHovered, setIsHovered] = useState(false)

    const getVariantStyles = () => {
      // Full literal class strings — dynamic `bg-${x}` / `text-${x}` would be excluded by Tailwind JIT in production builds
      const bgClassMap: Record<string, string> = {
        blue: 'bg-primary',
        sky: 'bg-sky-500',
        indigo: 'bg-indigo-600',
        cyan: 'bg-cyan-500',
        emerald: 'bg-emerald-600',
        rose: 'bg-rose-500',
        amber: 'bg-amber-500',
        violet: 'bg-violet-600',
        purple: 'bg-purple-600',
        orange: 'bg-orange-500',
        red: 'bg-red-600',
        yellow: 'bg-yellow-500',
      }

      const outlineTextClassMap: Record<string, string> = {
        blue: 'text-primary',
        sky: 'text-sky-600',
        indigo: 'text-indigo-600',
        cyan: 'text-cyan-600',
        emerald: 'text-emerald-600',
        rose: 'text-rose-600',
        amber: 'text-amber-600',
        violet: 'text-violet-600',
        purple: 'text-purple-600',
        orange: 'text-orange-600',
        red: 'text-red-600',
        yellow: 'text-yellow-600',
      }

      const backgroundClass = bgClassMap[color] ?? 'bg-primary'
      const outlineTextClass = outlineTextClassMap[color] ?? 'text-primary'
      const isLightColor =
        color === 'yellow' ||
        color === 'amber' ||
        color === 'sky' ||
        color === 'cyan'

      const styles = {
        primary: {
          background: backgroundClass,
          text: isLightColor
            ? 'text-slate-900 font-semibold tracking-tight'
            : 'text-white font-semibold tracking-tight',
          shadow: `shadow-[inset_0_2px_4px_rgba(255,255,255,0.4),0_10px_20px_rgba(0,0,0,0.1)]`,
          hoverShadow: `hover:shadow-[inset_0_2px_4px_rgba(255,255,255,0.5),0_15px_30px_rgba(0,0,0,0.15)]`,
          activeShadow: `active:shadow-[inset_0_4px_8px_rgba(0,0,0,0.3)]`,
          overlayBg: 'bg-white/10',
          highlightShadow: 'inset 0 12px 10px -10px rgba(255, 255, 255, 1)',
          highlightBg:
            'linear-gradient(180deg, rgba(255, 255, 255, 0.4) 0%, rgba(255, 255, 255, 0.05) 45%, rgba(255, 255, 255, 0) 100%)',
        },
        secondary: {
          background: 'bg-secondary',
          text: 'text-secondary-foreground font-medium',
          shadow: 'shadow-sm',
          hoverShadow: 'hover:shadow-md',
          activeShadow: 'active:shadow-inner',
          overlayBg: 'bg-slate-500/5',
          highlightShadow: 'none',
          highlightBg: 'transparent',
        },
        outline: {
          background: 'bg-transparent border border-border',
          text: outlineTextClass,
          shadow: 'shadow-none',
          hoverShadow: 'hover:bg-accent',
          activeShadow: 'active:bg-muted',
          overlayBg: 'bg-black/5',
          highlightShadow: 'none',
          highlightBg: 'transparent',
        },
      }

      return styles[variant || 'primary']
    }

    const getSizeStyles = () => {
      switch (size) {
        case 'sm':
          return 'text-xs px-5 py-2'
        case 'lg':
          return 'text-lg px-10 py-5'
        default:
          return 'text-base px-8 py-3.5'
      }
    }

    const variantStyles = getVariantStyles()
    const sizeStyles = getSizeStyles()

    return (
      <button
        ref={ref}
        className={cn(
          'relative cursor-pointer rounded-full border-0 transition-all duration-300 ease-out outline-none',
          variantStyles.background,
          variantStyles.shadow,
          variantStyles.hoverShadow,
          variantStyles.activeShadow,
          'active:translate-y-0.5 active:scale-95',
          'hover:-translate-y-1',
          className
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        {...props}
      >
        <div
          className={cn(
            'relative flex items-center justify-center gap-3 overflow-hidden rounded-full',
            variantStyles.text,
            sizeStyles
          )}
        >
          {/* Animated Gloss Overlay */}
          <div
            className={cn(
              'absolute inset-0 rounded-full transition-opacity duration-500',
              variantStyles.overlayBg
            )}
            style={{ opacity: isHovered ? 1 : 0 }}
          />

          {/* The Spherical Gloss Effect (Top Highlight) */}
          {variant !== 'outline' && (
            <div
              className="pointer-events-none absolute top-[8%] right-[8%] left-[8%] h-[50%] rounded-full transition-all duration-500"
              style={{
                opacity: isHovered ? 0.9 : 0.7,
                transform: isHovered
                  ? 'translateY(2%) scaleX(1.05)'
                  : 'translateY(0) scaleX(1)',
                boxShadow: variantStyles.highlightShadow,
                background: variantStyles.highlightBg,
              }}
            />
          )}

          {/* Content */}
          <span
            className="relative z-10 flex items-center justify-center gap-2 transition-transform duration-300"
            style={{
              transform: isHovered ? 'translateY(-1px)' : 'translateY(0)',
            }}
          >
            {children}
          </span>
        </div>
      </button>
    )
  }
)

PearlButton.displayName = 'PearlButton'
