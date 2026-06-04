# Auth Feature

OAuth2 login and session handling with **AWS Cognito**. Supports social login (Google, GitHub, Microsoft, Apple, LinkedIn) via Cognito Hosted UI federation, organization-scoped login by subdomain, cookie-based session management, token refresh, logout, and token validation (Cognito RS256 or Operations-issued HS256).

> The Wrapper is the platform's source of truth for tenancy, organizations, and roles — these live in the Wrapper DB (`organization_memberships` / `userRoleAssignments`), not in the identity provider. Cognito only handles user authentication and user lifecycle.

## Directory Structure

```
auth/
├── index.ts                       # Feature exports
├── routes/
│   └── auth.ts                    # All auth endpoints
└── services/
    ├── cognito-service.ts         # Cognito OAuth2 client: PKCE, token verify/exchange/refresh, logout
    └── cognito-admin-service.ts   # Cognito Admin user-lifecycle APIs (create/get/disable/enable/delete)
```

## Endpoints (`/api/auth`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/oauth/login` | Generic OAuth entry point (onboarding flow); optional `?provider=` skips the selector |
| GET | `/oauth/:provider` | Per-provider login (google, github, microsoft, apple, linkedin) — routes straight to that federated IdP |
| GET | `/login/:subdomain` | Org-specific login resolving the tenant from the subdomain |
| GET | `/callback` | OAuth2 callback — exchanges the code for tokens (PKCE), sets session cookies, redirects |
| GET | `/me` | Current authenticated user and organization context |
| GET | `/providers` | List of enabled social login providers with URLs |
| POST | `/logout` | Clear auth cookies and return the Cognito logout URL |
| POST | `/refresh` | Refresh the access token using the refresh cookie |
| POST | `/validate-token` | Validate a token (Cognito RS256 or Operations HS256) and return user context |

## Services

| Service | Description |
|---------|-------------|
| **CognitoService** (`cognito-service.ts`) | Cognito OAuth2/OIDC integration: PKCE generation and state handling, Hosted-UI authorize URL building, federated-provider mapping (`cognitoIdentityProviderFor`), authorization-code exchange, refresh, logout URL, and RS256 token verification against the pool JWKS (`verifyCognitoToken`). Exposes a `getUserInfo`-compatible shape so `/validate-token` can consume Cognito results through one code path. |
| **CognitoAdminService** (`cognito-admin-service.ts`) | Cognito Admin (user-lifecycle) APIs: `adminCreateUser`, `adminGetUserByEmail`, `adminDisableUser`, `adminEnableUser`, `adminDeleteUser`. Used for invited/admin-created users; idempotent on create. Org/role management is **not** here — that lives in the Wrapper DB. |

## Session & Identity Notes

- **Sessions are cookie-based.** The callback sets httpOnly `idp_token` / `idp_refresh_token` cookies; there is no JS-held bearer token.
- **Login uses Authorization Code + PKCE** against the Cognito Hosted UI. Passing a `provider` (e.g. `google`) federates straight to that IdP and skips the hosted selector.
- **`/validate-token` is dual-path:** it accepts Cognito RS256 tokens (ID or access, verified by issuer + signature) and Operations-issued HS256 service tokens, normalizing both into one user-context shape.
- **Identity columns** in the Wrapper DB are named `idp_*` (e.g. `idp_sub`) — provider-neutral after the Kinde→Cognito migration. Cross-app wire contracts (headers, message payloads) intentionally retain their legacy `kinde_*` names for backward compatibility and are unrelated to this feature's IdP.
