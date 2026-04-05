import { useRouterState } from '@tanstack/react-router'

/**
 * Resolves `roleId` from the current router matches (walks leaf → root).
 * The dashboard layout wraps `<Outlet />`; `useParams()` without `from` can resolve
 * against the layout match and omit `roleId` for `/dashboard/roles/:roleId`.
 */
export function useRoleIdParam(): string | undefined {
  return useRouterState({
    select: (state) => {
      for (let i = state.matches.length - 1; i >= 0; i--) {
        const p = state.matches[i]?.params as Record<string, string | undefined> | undefined
        const id = p?.roleId
        if (id && id.length > 0) return id
      }
      return undefined
    },
  })
}
