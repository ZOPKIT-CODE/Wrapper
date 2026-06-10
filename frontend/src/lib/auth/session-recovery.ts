const SESSION_RECOVERY_REASON_KEY = 'auth_session_recovery_reason'

const explicitSensitiveKeys = new Set([
  'kinde_backup_token',
  'idp_token',
  'idp_refresh_token',
  'authToken',
  'auth_token',
])

const shouldRemoveAuthKey = (key: string): boolean => {
  if (explicitSensitiveKeys.has(key)) return true
  if (/^refreshToken\d+$/i.test(key)) return true
  if (/kinde|oauth|auth/i.test(key) && /(token|refresh|state|code|session)/i.test(key)) return true
  if (/(access.?token|refresh.?token|id.?token)/i.test(key)) return true
  return false
}

const clearStorage = (storage: Storage) => {
  for (let i = storage.length - 1; i >= 0; i -= 1) {
    const key = storage.key(i)
    if (!key) continue
    if (shouldRemoveAuthKey(key)) {
      storage.removeItem(key)
    }
  }
}

export const clearStaleAuthStorage = (): void => {
  try {
    clearStorage(localStorage)
    clearStorage(sessionStorage)
  } catch {
    // Ignore storage access issues in private/restricted modes
  }
}

export const isInvalidGrantError = (error: unknown): boolean => {
  const e = error as any
  const message = String(
    e?.message ||
      e?.error_description ||
      e?.response?.data?.error_description ||
      e?.response?.data?.message ||
      ''
  ).toLowerCase()
  const code = String(e?.error || e?.response?.data?.error || '').toLowerCase()

  return (
    code === 'invalid_grant' ||
    message.includes('invalid_grant') ||
    message.includes('refresh token') ||
    message.includes('authorization code') ||
    message.includes('malformed')
  )
}

export const markSessionRecoveryReason = (reason: string): void => {
  try {
    sessionStorage.setItem(SESSION_RECOVERY_REASON_KEY, reason)
  } catch {
    // Ignore storage access errors
  }
}

export const consumeSessionRecoveryReason = (): string | null => {
  try {
    const reason = sessionStorage.getItem(SESSION_RECOVERY_REASON_KEY)
    if (reason) {
      sessionStorage.removeItem(SESSION_RECOVERY_REASON_KEY)
    }
    return reason
  } catch {
    return null
  }
}

// ── Post-login return path ────────────────────────────────────────────────────
// When a session expires on a protected page we send the user to /login and
// remember where they were, so the auth callback can bring them right back
// (e.g. /company-admin) instead of dumping everyone on the default dashboard.
const POST_LOGIN_REDIRECT_KEY = 'post_login_redirect'

/** Only allow returning to a same-origin internal path — never to /login,
 *  the auth callback, or an absolute/protocol-relative URL (open-redirect guard). */
const isSafeReturnPath = (path: string): boolean =>
  typeof path === 'string' &&
  path.startsWith('/') &&
  !path.startsWith('//') &&
  !path.startsWith('/login') &&
  !path.startsWith('/auth/callback')

export const rememberPostLoginRedirect = (path: string): void => {
  try {
    if (isSafeReturnPath(path)) sessionStorage.setItem(POST_LOGIN_REDIRECT_KEY, path)
  } catch {
    // Ignore storage access errors
  }
}

export const consumePostLoginRedirect = (): string | null => {
  try {
    const path = sessionStorage.getItem(POST_LOGIN_REDIRECT_KEY)
    if (path) sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY)
    return path && isSafeReturnPath(path) ? path : null
  } catch {
    return null
  }
}

