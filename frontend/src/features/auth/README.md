# Auth Feature

Handles authentication flows including OAuth callback processing, login, and invitation acceptance. Authentication is powered by Kinde.

## Directory Structure

```
auth/
└── pages/
    ├── AuthCallback.tsx    # OAuth callback handler (token exchange, CRM redirect)
    ├── InviteAccept.tsx    # Accept team invitation and join organization
    └── Login.tsx           # Login page with Google sign-in via Kinde
```

## Pages

### AuthCallback

Processes the OAuth callback after Kinde authentication:
- Reads `code`/`state` from URL parameters
- Handles Kinde-specific errors (`invalid_grant`, `server_error`)
- Supports CRM flow — when state contains `app_code`/`redirect_url`, validates the token and generates an app-specific token before redirecting
- Redirects to dashboard, invite acceptance, or CRM based on context

### Login

Login page with Google social sign-in:
- Integrates with Kinde SDK for authentication
- Supports CRM entry points (`returnTo`, `source`, `crmRedirect` query params)
- Checks onboarding status post-login and redirects accordingly
- CRM redirect / `returnTo` validation lives in `Login.tsx` (same module as the page)

### InviteAccept

Invitation acceptance flow:
- Loads invitation by token (new flow) or legacy `org`/`email` params
- Shows sign-in prompt or "Join Team" button
- Accepts invitation and redirects to dashboard

## Key APIs

| Page | Endpoints |
|------|-----------|
| AuthCallback | `POST /auth/validate`, `POST /auth/generate-app-token` |
| InviteAccept | `GET /invitations/details-by-token`, `POST /invitations/accept-by-token`, `POST /invitations/accept` |
| Login | `GET /onboarding/status` (post-login check) |

## Dependencies

- `@kinde-oss/kinde-auth-react` — Authentication SDK (`useKindeAuth`, `getToken`, `login`)
- `@/lib/config` — `WRAPPER_DOMAIN`, `LOGO_URL`, `CRM_DOMAIN`
- `framer-motion` — Login page animations
