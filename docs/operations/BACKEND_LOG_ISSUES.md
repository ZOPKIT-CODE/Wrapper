# Backend log issues (observed from terminal logs)

Summary of issues observed from backend server logs (e.g. terminal output lines 7–1026).

---

## 1. Excessive per-request logging (noise)

**What happens:** Every authenticated request produces many repeated lines:

- `🔐 Authenticating user...`
- `🔍 validateToken - Starting validation...`
- `🔑 Token validation - Token length / format`
- `🔍 getUserInfo - Starting with token validation...`
- `✅ getUserInfo - Success via user_profile endpoint`
- `✅ getEnhancedUserInfo - Success: { ... }`
- `✅ validateToken - Success: { ... }`
- `🔍 Looking up user: <kindeUserId>`
- `✅ Found user: <userId>`
- `✅ User authenticated: { ... }`
- `✅ Authentication successful`
- `🔓 Trial restriction: BYPASSED for local development`
- `🔍 Request Analysis: { path, method, ... }`
- `✅ CORS allowed origin: http://localhost:3001`

**Impact:** With many parallel requests (notifications, subscriptions, credits, activity, etc.), the same patterns repeat dozens of times and make it hard to see real errors or flow.

**Fix:** Verbose auth/CORS/request logs are gated behind `LOG_LEVEL=debug` (or `BACKEND_VERBOSE_LOGS=true`). Set `LOG_LEVEL=info` (default) to reduce noise; set `LOG_LEVEL=debug` when debugging auth.

---

## 2. Duplicate API calls from frontend

**What happens:** The same endpoints are hit many times in a short period, e.g.:

- `/api/activity/user?limit=100` – multiple times
- `/api/activity/stats?period=24h` – multiple times
- `/api/notifications/unread-count` – multiple times
- `/api/subscriptions/current` – multiple times

**Impact:** More load on the backend and even more log lines (each request runs full auth + request analysis).

**Cause:** Likely frontend: multiple components or hooks each calling the same APIs, or React Query (or similar) refetching too often.

**Fix:** Backend can’t fix this. On the frontend: deduplicate requests (e.g. single shared query, or disable refetch-on-window-focus for these), or reduce the number of components that fetch the same data.

---

## 3. “No form data found and no initial setup data available”

**What happens:** On onboarding status check, when the user is already onboarded and has no saved form/initial setup data, the backend logs:

`⚠️ No form data found and no initial setup data available`

**Impact:** Looks like a warning even though for an already-onboarded user this is expected (no form to restore).

**Fix:** This case is only logged when `LOG_LEVEL=debug`, or only when the user actually needs onboarding (e.g. `needsOnboarding === true`). In normal operation the warning no longer appears for completed users.

---

## 4. userType `INVITED_USER` for an onboarded user

**What happens:** For a user who completed onboarding (e.g. company “hello world”), the onboarding status response can show:

`userType: 'INVITED_USER'`

**Impact:** Logs and API responses suggest “invited user” even when the user may have gone through normal onboarding. Confusing when debugging.

**Cause:** Backend sets `userType` to `INVITED_USER` when `onboardingCompleted === true` and any of: `preferences.userType === 'INVITED_USER'`, `preferences.isInvitedUser === true`, `invitedBy !== null`, `invitedAt !== null`. So either the user was actually invited, or preferences/DB were set that way.

**Fix:** No code change required if the classification is correct. If you want “completed onboarding by form” to always show as `EXISTING_USER`, the logic in `status-management.js` can be tightened so that `INVITED_USER` is only set when there is an explicit invite (e.g. `invitedBy` / `invitedAt`), and not from preferences alone.

---

## 5. Trial restriction log on every request

**What happens:** For every authenticated request in development, the trial restriction middleware logs:

`🔓 Trial restriction: BYPASSED for local development`

**Impact:** Same line repeated many times.

**Fix:** This log is only emitted when `LOG_LEVEL=debug` or `BACKEND_VERBOSE_LOGS=true`.

---

## 6. CORS log on every request

**What happens:** For every request with an `Origin` header (e.g. from the frontend), the app logs:

`✅ CORS allowed origin: http://localhost:3001`

**Impact:** Same line repeated many times, adding noise.

**Fix:** CORS “allowed” is only logged when `LOG_LEVEL=debug`. CORS rejections are still logged so security issues remain visible.

---

## 7. No request-scoped auth cache

**What happens:** Each request runs the full auth pipeline: validate token → get user info (Kinde) → look up user in DB. There is no per-request cache, so the same token is validated and the same user fetched from the DB many times in one “page load” (many requests).

**Impact:** Extra Kinde and DB calls, and more log lines.

**Fix (optional):** Add a short-lived, request-scoped cache (e.g. in-memory by token or request id) so the same token validated in the same second reuses the result. Not implemented in the initial fix; verbose logging reduction already cuts log volume.

---

## Env vars for log level

- **`LOG_LEVEL=info`** (default): Normal operation. Only important events and errors; no per-request auth/CORS/request analysis.
- **`LOG_LEVEL=debug`**: Verbose. All auth steps, CORS, request analysis, and “No form data found” (when applicable) are logged.
- **`BACKEND_VERBOSE_LOGS=true`**: Same as `LOG_LEVEL=debug` for these verbose console logs (alternative if you don’t want to change pino’s LOG_LEVEL).

**Files changed:** `auth.js`, `kinde-service.js`, `app.js` (CORS), `request-analyzer.js`, `status-management.js` (“No form data found”), `trial-restriction.js`.

Set in `.env` or when starting the server, e.g.:

```bash
LOG_LEVEL=info   # less noise (default)
LOG_LEVEL=debug # full auth/CORS/request logs for debugging
```
