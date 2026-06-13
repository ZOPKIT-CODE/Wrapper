import { Link } from '@tanstack/react-router'
import { ChevronRight, LayoutGrid } from 'lucide-react'
import { ThemeToggle } from '@/components/theme/ThemeToggle'
import { useUserContextSafe } from '@/contexts/UserContextProvider'

export function ApplicationsHubTopBar() {
  const ctx = useUserContextSafe()
  const isTenantAdmin = ctx?.user?.isTenantAdmin ?? false
  const workspaceTo = isTenantAdmin
    ? '/dashboard/organization'
    : '/dashboard/applications'

  return (
    <header
      className="border-border sticky top-0 z-50 flex h-14 shrink-0 items-center gap-4 border-b px-6"
      style={{
        background: 'color-mix(in oklch, var(--background) 68%, transparent)',
        backdropFilter: 'saturate(1.5) blur(16px)',
        WebkitBackdropFilter: 'saturate(1.5) blur(16px)',
        fontFamily: 'var(--zk-font)',
      }}
    >
      <Link
        to="/dashboard/applications"
        className="text-foreground text-sm font-semibold tracking-tight"
      >
        Zopkit
      </Link>
      <nav
        className="text-muted-foreground flex items-center gap-1.5 text-sm"
        aria-label="Workspace navigation"
      >
        <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
        <ChevronRight className="h-3 w-3 opacity-50" aria-hidden="true" />
        <Link
          to={workspaceTo}
          className="text-foreground hover:text-primary font-medium transition-colors"
        >
          Workspace
        </Link>
      </nav>
      <div className="ml-auto">
        <ThemeToggle />
      </div>
    </header>
  )
}
