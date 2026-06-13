import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { PageLoading } from '@/components/common/feedback/LoadingStates'
import { cn } from '@/lib/utils'
import { config } from '@/lib/config'

type AuthFlowLayoutProps = {
  children: ReactNode
  className?: string
  style?: React.CSSProperties
  /** Skip centered logo header (onboarding / invite supply their own chrome). */
  hideHeader?: boolean
}

/**
 * Shared shell for login, invite accept, and onboarding flows.
 * Scoped with `data-auth-flow` for Inter + JetBrains typography only.
 */
export function AuthFlowLayout({
  children,
  className,
  style,
  hideHeader = false,
}: AuthFlowLayoutProps) {
  return (
    <div
      data-auth-flow
      className={cn(
        'bg-background text-foreground min-h-screen font-sans antialiased',
        className
      )}
      style={style}
    >
      {!hideHeader && (
        <header className="absolute top-0 right-0 left-0 z-10 flex items-center justify-between px-6 py-5">
          <Link to="/" className="flex items-center gap-2.5">
            <img
              src={config.LOGO_URL}
              alt="Zopkit"
              className="h-9 w-9 rounded-md object-contain"
            />
            <span className="text-foreground text-sm font-semibold tracking-tight">
              Zopkit
            </span>
          </Link>
          <Link
            to="/landing"
            className="text-muted-foreground hover:text-foreground text-sm transition-colors"
          >
            Back to site
          </Link>
        </header>
      )}
      {children}
    </div>
  )
}

export function AuthFlowLoading({
  message = 'Loading...',
}: {
  message?: string
}) {
  return <PageLoading message={message} />
}
