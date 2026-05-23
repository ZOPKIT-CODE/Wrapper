# JWT Signing Migration — HS256 → RS256

Wrapper currently signs service JWTs with **HS256** using the shared `JWT_SECRET`
that CRM and FA also know. This is a symmetric-key design: anyone who can
verify can also forge. The migration replaces signing with **RS256**
(asymmetric) while keeping HS256 as a verification fallback so CRM/FA continue
to work until their repos are updated to fetch the public key.

Default behavior with no new env vars set is **unchanged**: wrapper signs with
HS256/`JWT_SECRET` exactly as before.

## 1. Generate an RSA keypair

```bash
# 2048 bits is the minimum recommended for RS256 in production.
openssl genrsa -out private.pem 2048
openssl rsa -in private.pem -pubout -out public.pem
```

Store the private key as a secret. The public key may be distributed freely
(it is also served at `/.well-known/jwks.json`).

## 2. Configure wrapper

Set the following env vars on the wrapper backend:

| Var | Required for RS256 | Default | Notes |
| --- | --- | --- | --- |
| `JWT_SIGNING_ALG` | yes (`RS256`) | `HS256` | When set to `HS256` (or unset), wrapper continues to sign with `JWT_SECRET`. |
| `JWT_PRIVATE_KEY` | yes | unset | PEM body. Multi-line values must escape newlines as `\n` (Docker/K8s env). |
| `JWT_PUBLIC_KEY` | yes | unset | PEM body. Used to derive the JWK at boot. |
| `JWT_KEY_ID` | no | `wrapper-default` | Published as `kid` in JWKS and in the signed JWT header. |
| `JWT_SECRET` | yes (still) | — | Kept for HS256 verification of tokens minted by older builds and for fallback signing if RS256 is misconfigured. |
| `JWT_SECRET_PREVIOUS` | no | unset | Previous HS256 secret accepted during rotation. |

If `JWT_SIGNING_ALG=RS256` but the keys are missing or malformed, wrapper logs
a warning and falls back to HS256 — the service still boots.

## 3. CRM / FA migration (downstream TODO)

In the CRM and FA repos, replace the shared-secret verifier with a JWKS-aware
verifier. Recommended approach with `jose`:

```ts
import { createRemoteJWKSet, jwtVerify } from 'jose';

const JWKS = createRemoteJWKSet(
  new URL(`${process.env.WRAPPER_BASE_URL}/.well-known/jwks.json`),
  { cooldownDuration: 5 * 60_000 }, // cache 5 min, refetch on miss
);

export async function verifyServiceToken(token: string) {
  // Decode header to inspect alg without verifying.
  const headerB64 = token.split('.')[0];
  const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString());

  if (header.alg === 'RS256') {
    const { payload } = await jwtVerify(token, JWKS, { algorithms: ['RS256'] });
    return payload;
  }

  // Fallback: legacy HS256 path using the existing shared secret.
  const { payload } = await jwtVerify(
    token,
    new TextEncoder().encode(process.env.JWT_SECRET!),
    { algorithms: ['HS256'] },
  );
  return payload;
}
```

`createRemoteJWKSet` handles caching and refresh on unknown `kid`. If the JWKS
response is `{ keys: [] }` (wrapper still on HS256), downstreams fall through
to the HS256 path.

## 4. JWKS response shape

`GET /.well-known/jwks.json` (cached 5 min, public):

```json
{
  "keys": [
    {
      "kty": "RSA",
      "n": "0vx7…",
      "e": "AQAB",
      "kid": "wrapper-default",
      "use": "sig",
      "alg": "RS256"
    }
  ]
}
```

When RS256 is not configured the response is `{ "keys": [] }`.

## 5. Rotation

For a single active key (simple case):

1. Generate a new keypair.
2. Set `JWT_KEY_ID` to a new identifier (e.g. `wrapper-2026-05`).
3. Update `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY` and redeploy.

Downstreams using `createRemoteJWKSet` will refetch on the first `kid` miss.
Existing in-flight tokens signed with the old key will fail verification once
the old key is removed — drain or accept the brief auth blip.

For zero-downtime rotation, the JWKS endpoint currently serves a single key.
To overlap two keys during a rotation window, extend `getAsymmetricKeyMaterial`
in `backend/src/utils/jwt-signing.ts` to read a second `JWT_PUBLIC_KEY_PREVIOUS`
and include it in the `keys` array. Signing should always use the new key;
verification (downstream) accepts either.

## 6. What changed in this repo

- `backend/src/utils/jwt-signing.ts` — new central signer/verifier and JWK derivation.
- `backend/src/routes/jwks.ts` — new public route `GET /.well-known/jwks.json`.
- `backend/src/routes/internal/service-auth.ts` — now signs via `signServiceToken` (RS256 when configured, HS256 otherwise).
- `backend/src/features/app-sync/routes/sync-routes.ts` — service-token verifier accepts both algs.
- `backend/src/middleware/auth/auth.ts` — `/.well-known/jwks.json` added to `PUBLIC_ROUTES`.
- `backend/src/app-routes.ts` — registers `jwksRoutes`.
- `backend/src/types/env.d.ts`, `backend/.env.example` — new env vars documented.
