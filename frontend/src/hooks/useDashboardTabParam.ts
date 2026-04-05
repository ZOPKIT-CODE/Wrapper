import { useMemo, useCallback } from 'react'
import { useNavigate, useLocation, useSearch } from '@tanstack/react-router'

export interface UseDashboardTabParamOptions<T extends string> {
  /** Valid tab ids for this route (include default) */
  allowed: readonly T[]
  defaultTab: T
}

/**
 * Syncs a UI tab with `?tab=<id>` on the current path. Survives refresh; omits the param when it equals `defaultTab`.
 * Each dashboard route validates `tab` against its own `allowed` list so stale values from other pages are ignored.
 */
export function useDashboardTabParam<T extends string>({
  allowed,
  defaultTab,
}: UseDashboardTabParamOptions<T>) {
  const location = useLocation()
  const navigate = useNavigate()
  const urlSearch = useSearch({ strict: false }) as Record<string, string | undefined>

  const allowedSet = useMemo(() => new Set<string>(allowed), [allowed])

  const activeTab = useMemo(() => {
    const raw = urlSearch.tab
    if (raw && allowedSet.has(raw)) return raw as T
    return defaultTab
  }, [urlSearch.tab, allowedSet, defaultTab])

  const setActiveTab = useCallback(
    (value: string) => {
      if (!allowedSet.has(value)) return
      const next = value as T
      navigate({
        to: location.pathname,
        search: (prev: Record<string, unknown>) => {
          const p = { ...(prev ?? {}) }
          if (next === defaultTab) {
            delete p.tab
          } else {
            p.tab = next
          }
          return p
        },
        replace: true,
      })
    },
    [navigate, location.pathname, allowedSet, defaultTab],
  )

  return [activeTab, setActiveTab] as const
}
