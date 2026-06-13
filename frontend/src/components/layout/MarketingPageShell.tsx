import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import '@/features/landing/landing.css'

type MarketingPageShellProps = {
  children: ReactNode
  className?: string
}

/** Wraps public marketing pages with Vercel-minimal light theme scope. */
export function MarketingPageShell({
  children,
  className,
}: MarketingPageShellProps) {
  return (
    <div
      data-landing
      data-landing-theme="minimal"
      className={cn(
        'bg-background text-foreground min-h-screen overflow-x-clip font-sans antialiased',
        className
      )}
    >
      {children}
    </div>
  )
}
