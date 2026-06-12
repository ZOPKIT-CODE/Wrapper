import { Navigate } from '@tanstack/react-router'

/** Non-canonical landing variants redirect to `/` (canonical home). */
export function LegacyLandingRedirect() {
  return <Navigate to="/" replace />
}
