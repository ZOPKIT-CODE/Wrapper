import { Navigate } from '@tanstack/react-router'

/** Dev tooling routes — not registered in production builds. */
export function DevOnlyRoute({ children }: { children: React.ReactNode }) {
  if (import.meta.env.PROD) {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}
