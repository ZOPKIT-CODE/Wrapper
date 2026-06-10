/**
 * Cross-app silent SSO (prompt=none) for already-open, logged-out tabs.
 *
 * All suite apps share one Cognito Hosted-UI session. When a logged-out wrapper tab
 * on /login becomes visible (e.g. you just signed into crm/fa in another tab), it
 * does a top-level prompt=none login: session present → logged in with no password;
 * absent → Cognito returns error=login_required, which AuthCallback swallows quietly.
 * A short cooldown prevents redirect loops. Reuses the existing backend OAuth flow —
 * no Cognito config change.
 */
import { useEffect } from 'react'

import { useAuth } from '@/lib/auth/cognito-auth'

const SILENT_FLAG_KEY = 'wrapper:cognito:silent_attempt'
const SILENT_LAST_KEY = 'wrapper:cognito:silent_last'
const SILENT_COOLDOWN_MS = 10_000

/** Cognito prompt=none "no interactive session" outcomes — expected, not real errors. */
export const SILENT_SSO_ERROR_CODES = [
  'login_required',
  'interaction_required',
  'consent_required',
]

export function silentSsoOnCooldown(): boolean {
  try {
    const last = Number(sessionStorage.getItem(SILENT_LAST_KEY) || '0')
    return (
      Number.isFinite(last) &&
      last > 0 &&
      Date.now() - last < SILENT_COOLDOWN_MS
    )
  } catch {
    return false
  }
}

function markSilentAttempt(): void {
  try {
    sessionStorage.setItem(SILENT_FLAG_KEY, '1')
    sessionStorage.setItem(SILENT_LAST_KEY, String(Date.now()))
  } catch {
    /* sessionStorage unavailable — degrade silently */
  }
}

/** Read+clear the "this redirect was a silent probe" flag. */
export function consumeSilentAttempt(): boolean {
  try {
    const was = sessionStorage.getItem(SILENT_FLAG_KEY) === '1'
    if (was) sessionStorage.removeItem(SILENT_FLAG_KEY)
    return was
  } catch {
    return false
  }
}

/**
 * Mount on the /login screen. When the tab becomes visible and the user is logged
 * out, silently probe the shared Cognito session (prompt=none, top-level redirect).
 */
export function useSilentSsoOnFocus(): void {
  const { isAuthenticated, isLoading, login } = useAuth()

  useEffect(() => {
    if (isAuthenticated || isLoading) return

    const probe = () => {
      if (document.visibilityState !== 'visible') return
      if (window.location.pathname !== '/login') return
      const params = new URLSearchParams(window.location.search)
      if (params.has('code') || params.has('error')) return // a real callback is in flight
      if (silentSsoOnCooldown()) return
      markSilentAttempt()
      login({ prompt: 'none' }) // top-level redirect; AuthCallback handles the outcome
    }

    probe() // also on mount (fresh tab opened while already signed in elsewhere)
    document.addEventListener('visibilitychange', probe)
    window.addEventListener('focus', probe)
    return () => {
      document.removeEventListener('visibilitychange', probe)
      window.removeEventListener('focus', probe)
    }
  }, [isAuthenticated, isLoading, login])
}
