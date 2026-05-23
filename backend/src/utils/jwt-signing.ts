/**
 * JWT signing & verification helpers supporting both HS256 (legacy, shared
 * secret) and RS256 (asymmetric, public key distributed via JWKS).
 *
 * Defaults to HS256 so behavior is unchanged unless the operator opts in by
 * setting JWT_SIGNING_ALG=RS256 along with JWT_PRIVATE_KEY / JWT_PUBLIC_KEY.
 *
 * See backend/docs/JWT_MIGRATION.md for rollout details.
 */

import crypto from 'crypto';
import jwt from 'jsonwebtoken';

type SigningAlg = 'HS256' | 'RS256';

interface AsymmetricKeyMaterial {
  alg: 'RS256';
  kid: string;
  privateKey: string;
  publicKey: string;
  jwk: Record<string, unknown>; // cached JWK derived from publicKey at boot
}

interface SymmetricKeyMaterial {
  alg: 'HS256';
  secret: string;
}

let cachedAsymmetric: AsymmetricKeyMaterial | null | undefined = undefined;

/**
 * Read the configured signing algorithm. Default HS256.
 */
export function getConfiguredAlg(): SigningAlg {
  const raw = (process.env.JWT_SIGNING_ALG || 'HS256').toUpperCase();
  return raw === 'RS256' ? 'RS256' : 'HS256';
}

/**
 * Return asymmetric key material if (and only if) RS256 is fully configured.
 * Caches the JWK derivation across calls.
 * Returns null when RS256 is not configured.
 */
export function getAsymmetricKeyMaterial(): AsymmetricKeyMaterial | null {
  if (cachedAsymmetric !== undefined) return cachedAsymmetric;

  const alg = getConfiguredAlg();
  const privateKey = process.env.JWT_PRIVATE_KEY;
  const publicKey = process.env.JWT_PUBLIC_KEY;

  if (alg !== 'RS256') {
    cachedAsymmetric = null;
    return null;
  }

  if (!privateKey || !publicKey) {
    // Misconfiguration: RS256 declared but keys missing. Surface to logs but
    // fall back to HS256 so the service can still come up.
    // eslint-disable-next-line no-console
    console.warn(
      '[jwt-signing] JWT_SIGNING_ALG=RS256 but JWT_PRIVATE_KEY/JWT_PUBLIC_KEY are not both set; falling back to HS256.',
    );
    cachedAsymmetric = null;
    return null;
  }

  const kid = process.env.JWT_KEY_ID || 'wrapper-default';

  const normalizedPrivate = privateKey.replace(/\\n/g, '\n');
  const normalizedPublic = publicKey.replace(/\\n/g, '\n');

  let jwk: Record<string, unknown>;
  try {
    const keyObject = crypto.createPublicKey(normalizedPublic);
    jwk = keyObject.export({ format: 'jwk' }) as Record<string, unknown>;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[jwt-signing] Failed to derive JWK from JWT_PUBLIC_KEY; falling back to HS256.', err);
    cachedAsymmetric = null;
    return null;
  }

  jwk.kid = kid;
  jwk.use = 'sig';
  jwk.alg = 'RS256';

  cachedAsymmetric = {
    alg: 'RS256',
    kid,
    privateKey: normalizedPrivate,
    publicKey: normalizedPublic,
    jwk,
  };
  return cachedAsymmetric;
}

/**
 * Return the symmetric (HS256) secret used as the default / fallback signer.
 * Throws if no HS256 secret is configured.
 */
function getSymmetricSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  return secret;
}

/**
 * Sign a service JWT using the preferred algorithm:
 *  - RS256 with the configured private key + `kid` header, when fully configured.
 *  - HS256 with JWT_SECRET otherwise (legacy behavior).
 */
export function signServiceToken(
  payload: Record<string, unknown>,
  options: jwt.SignOptions = {},
): string {
  const asym = getAsymmetricKeyMaterial();
  if (asym) {
    return jwt.sign(payload, asym.privateKey, {
      ...options,
      algorithm: 'RS256',
      keyid: asym.kid,
    });
  }
  return jwt.sign(payload, getSymmetricSecret(), {
    ...options,
    algorithm: 'HS256',
  });
}

/**
 * Verify a service JWT, transparently accepting both RS256 (when configured)
 * and HS256 (legacy shared secret). Mirrors the dual-secret rotation the auth
 * middleware already supports for HS256.
 *
 * Returns the decoded payload.
 */
export function verifyServiceToken(token: string): Record<string, unknown> {
  let header: { alg?: string; kid?: string } = {};
  try {
    const decoded = jwt.decode(token, { complete: true });
    if (decoded && typeof decoded === 'object' && 'header' in decoded) {
      header = (decoded as { header: { alg?: string; kid?: string } }).header || {};
    }
  } catch {
    // fall through to try-verify below
  }

  const alg = header.alg;

  if (alg === 'RS256') {
    const asym = getAsymmetricKeyMaterial();
    if (!asym) {
      throw new Error('Token uses RS256 but wrapper is not configured with JWT_PUBLIC_KEY');
    }
    return jwt.verify(token, asym.publicKey, { algorithms: ['RS256'] }) as Record<string, unknown>;
  }

  // Default: HS256 path (legacy). Try JWT_SECRET, then optional previous secret
  // to mirror the rotation pattern already present in the codebase.
  const primary = process.env.JWT_SECRET;
  const previous = process.env.JWT_SECRET_PREVIOUS;
  if (!primary && !previous) {
    throw new Error('JWT_SECRET is not configured');
  }
  if (primary) {
    try {
      return jwt.verify(token, primary, { algorithms: ['HS256'] }) as Record<string, unknown>;
    } catch (err) {
      if (!previous) throw err;
    }
  }
  return jwt.verify(token, previous as string, { algorithms: ['HS256'] }) as Record<string, unknown>;
}

/**
 * Return the JWKS document to serve at /.well-known/jwks.json.
 * Empty `keys` array when RS256 is not configured — downstreams interpret that
 * as "fall back to the shared HS256 secret".
 */
export function getJwks(): { keys: Array<Record<string, unknown>> } {
  const asym = getAsymmetricKeyMaterial();
  if (!asym) return { keys: [] };
  return { keys: [asym.jwk] };
}

/**
 * Test hook: reset the cached JWK derivation. Not exported for production use.
 */
export function __resetJwtSigningCacheForTests(): void {
  cachedAsymmetric = undefined;
}
