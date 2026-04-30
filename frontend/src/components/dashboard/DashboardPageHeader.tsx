import * as React from 'react'
import { cn } from '@/lib/utils'

/** Primary page title — tenant dashboard shell (`/dashboard/*`). */
export const DASHBOARD_PAGE_TITLE_CLASS =
  'text-3xl font-semibold tracking-tight'

/** Lead / subtitle under the page title. */
export const DASHBOARD_PAGE_DESCRIPTION_CLASS = 'text-sm text-muted-foreground'

/**
 * Section heading inside a page (card headers, tab panels, timeline).
 * Smaller than the page title; same brand color.
 */
export const DASHBOARD_SECTION_TITLE_CLASS =
  'text-xl font-semibold tracking-tight'

/**
 * Shared TabsList styles for tenant dashboard modules (Team, Organization, etc.).
 */
export const DASHBOARD_TABS_LIST_CLASS =
  'inline-flex h-auto min-h-9 flex-wrap gap-1 rounded-lg bg-white/80 border border-[#e6e3d8] p-1 text-muted-foreground'

export interface DashboardPageHeaderProps {
  title: React.ReactNode
  description?: React.ReactNode
  /** Right-side actions (e.g. primary CTA, refresh). */
  actions?: React.ReactNode
  className?: string
}

/**
 * Consistent hero block for tenant dashboard routes: brand title, muted description, optional actions.
 */
export function DashboardPageHeader({
  title,
  description,
  actions,
  className,
}: DashboardPageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between pb-6 border-b',
        className,
      )}
      style={{ borderColor: 'var(--zk-line)' }}
    >
      <div className="min-w-0 space-y-1.5">
        <p style={{
          fontSize: 11,
          fontFamily: 'var(--zk-mono)',
          color: 'var(--zk-muted-2)',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          margin: 0,
        }}>Workspace</p>
        <h1
          className={DASHBOARD_PAGE_TITLE_CLASS}
          style={{ fontFamily: 'var(--zk-display)', color: 'var(--zk-ink)', letterSpacing: '-0.03em' }}
        >{title}</h1>
        {description != null && description !== false ? (
          <p className={DASHBOARD_PAGE_DESCRIPTION_CLASS} style={{ color: 'var(--zk-muted)' }}>{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>
      ) : null}
    </div>
  )
}
