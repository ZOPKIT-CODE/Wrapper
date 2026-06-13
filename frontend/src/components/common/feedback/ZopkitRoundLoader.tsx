import { cn } from '@/lib/utils'
import AnimatedLoader from './AnimatedLoader'

const sizeClasses = {
  xs: 'w-4 h-4',
  sm: 'w-6 h-6',
  md: 'w-8 h-8',
  lg: 'w-10 h-10',
  xl: 'w-12 h-12',
} as const

export type ZopkitRoundLoaderSize = keyof typeof sizeClasses | 'page'

interface ZopkitRoundLoaderProps {
  size?: ZopkitRoundLoaderSize
  className?: string
}

/**
 * Zopkit round loader – use everywhere for consistent loading UX.
 * - xs/sm/md/lg/xl: round blue border spinner (buttons, inline, cards).
 * - page: full AnimatedLoader with ZOPKIT letters (full-page loading).
 */
export function ZopkitRoundLoader({
  size = 'md',
  className = '',
}: ZopkitRoundLoaderProps) {
  if (size === 'page') {
    return <AnimatedLoader size="md" className={className} />
  }

  const sizeClass =
    sizeClasses[size as keyof typeof sizeClasses] ?? sizeClasses.md

  return (
    <div
      className={cn(
        'flex-shrink-0 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600',
        sizeClass,
        className
      )}
      aria-hidden
    />
  )
}

export default ZopkitRoundLoader
