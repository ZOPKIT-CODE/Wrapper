import * as React from 'react'
import { cn } from '@/lib/utils'

/** Primary page title — tenant dashboard shell (`/dashboard/*`). */
export const DASHBOARD_PAGE_TITLE_CLASS =
  'text-3xl font-bold tracking-tight text-[#1B2E5A] dark:text-slate-100'

/** Lead / subtitle under the page title. */
export const DASHBOARD_PAGE_DESCRIPTION_CLASS = 'text-base text-muted-foreground'

/**
 * Section heading inside a page (card headers, tab panels, timeline).
 * Smaller than the page title; same brand color.
 */
export const DASHBOARD_SECTION_TITLE_CLASS =
  'text-xl font-semibold tracking-tight text-[#1B2E5A] dark:text-slate-100'

/**
 * Shared TabsList styles for tenant dashboard modules (Team, Organization, etc.).
 * Keeps tab chrome aligned with shadcn defaults + slate rail used on Organization.
 */
export const DASHBOARD_TABS_LIST_CLASS =
  'inline-flex h-auto min-h-9 flex-wrap gap-1 rounded-lg bg-slate-100 p-1 text-muted-foreground dark:bg-slate-800'

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
        'flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        <h1 className={DASHBOARD_PAGE_TITLE_CLASS}>{title}</h1>
        {description != null && description !== false ? (
          <p className={DASHBOARD_PAGE_DESCRIPTION_CLASS}>{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>
      ) : null}
    </div>
  )
}
