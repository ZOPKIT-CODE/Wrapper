/**
 * Distributed SSO Cache
 *
 * Caches SSO auth / permissions / roles used by the internal cross-app access
 * routes (/api/internal/user-permissions, service-auth).
 *
 * Single-tier design: when Valkey/Redis is enabled and connected (shared client
 * in ./valkey-client), every read/write/invalidation goes to Valkey so the cache
 * is shared across horizontally-scaled instances — an invalidation on one
 * instance is visible to all. Falls back to in-process Maps when Valkey is
 * disabled or unreachable (single instance / dev), so the app still works.
 *
 * Keys are namespaced under `sso:` so they never collide with the auth
 * middleware's SharedCache (`auth:*`) entries in the same Valkey.
 */
import { getValkey, isValkeyReady } from './valkey-client.js';

interface CacheEntry<T> {
  value: T;
  expiresAt?: number;
}

const AUTH_PREFIX = 'sso:auth:';
const PERM_PREFIX = 'sso:perm:';
const ROLES_PREFIX = 'sso:roles:';

// Escape redis glob metacharacters in user-supplied identifiers so a `*`/`?`/`[`
// in an id can't widen a SCAN MATCH pattern.
function escapeGlob(s: string): string {
  return s.replace(/[*?[\]\\^-]/g, '\\$&');
}

class DistributedSSOCache {
  // In-process fallback stores (used only when Valkey is disabled/unreachable).
  private userAuth: Map<string, CacheEntry<unknown>>;
  private userPermissions: Map<string, CacheEntry<unknown>>;
  private userRoles: Map<string, CacheEntry<unknown>>;

  constructor() {
    this.userAuth = new Map();
    this.userPermissions = new Map();
    this.userRoles = new Map();

    // Periodically evict expired fallback entries (Valkey handles its own TTLs).
    const timer = setInterval(() => this._cleanupExpired(), 3600000); // hourly
    // Don't keep the process alive just for cache cleanup.
    (timer as { unref?: () => void }).unref?.();
  }

  // ── Key builders ──────────────────────────────────────────────────────────
  _getAuthKey(idpSub: string, orgCode: string): string {
    return `${AUTH_PREFIX}${idpSub}:${orgCode}`;
  }
  _getPermissionsKey(userId: string, tenantId: string, app: string): string {
    return `${PERM_PREFIX}${userId}:${tenantId}:${app}`;
  }
  _getRolesKey(userId: string, tenantId: string): string {
    return `${ROLES_PREFIX}${userId}:${tenantId}`;
  }

  // ── Valkey helpers ────────────────────────────────────────────────────────
  private async _scanDel(pattern: string): Promise<boolean> {
    const vk = getValkey();
    if (!vk || !isValkeyReady()) return false;
    try {
      let cursor = '0';
      do {
        const [next, batch] = await vk.scan(cursor, 'MATCH', pattern, 'COUNT', 250);
        cursor = next;
        if (batch.length) await vk.del(...batch);
      } while (cursor !== '0');
      return true;
    } catch {
      return false; // caller falls back to the in-process Map
    }
  }

  private async _scanCount(pattern: string): Promise<number> {
    const vk = getValkey();
    if (!vk || !isValkeyReady()) return 0;
    let cursor = '0';
    let n = 0;
    try {
      do {
        const [next, batch] = await vk.scan(cursor, 'MATCH', pattern, 'COUNT', 250);
        cursor = next;
        n += batch.length;
      } while (cursor !== '0');
    } catch {
      /* best-effort count — return what we have so far */
    }
    return n;
  }

  private _mapGet(store: Map<string, CacheEntry<unknown>>, key: string): unknown {
    const entry = store.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      store.delete(key);
      return null;
    }
    return entry.value;
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  async getUserAuth(idpSub: string, orgCode: string): Promise<unknown> {
    const key = this._getAuthKey(idpSub, orgCode);
    const vk = getValkey();
    if (vk && isValkeyReady()) {
      try {
        const raw = await vk.get(key);
        if (raw !== null) {
          try { return JSON.parse(raw); } catch { return null; }
        }
        return null;
      } catch {
        /* fall through to map */
      }
    }
    return this._mapGet(this.userAuth, key);
  }

  async cacheUserAuth(idpSub: string, orgCode: string, authData: unknown, ttl = 3600): Promise<void> {
    const key = this._getAuthKey(idpSub, orgCode);
    const vk = getValkey();
    if (vk && isValkeyReady()) {
      try { await vk.set(key, JSON.stringify(authData), 'EX', ttl); return; } catch { /* fall through */ }
    }
    this.userAuth.set(key, { value: authData, expiresAt: Date.now() + ttl * 1000 });
  }

  // ── Permissions ─────────────────────────────────────────────────────────��─
  async getUserPermissions(userId: string, tenantId: string, app: string): Promise<unknown> {
    const key = this._getPermissionsKey(userId, tenantId, app);
    const vk = getValkey();
    if (vk && isValkeyReady()) {
      try {
        const raw = await vk.get(key);
        if (raw !== null) {
          try { return JSON.parse(raw); } catch { return null; }
        }
        return null;
      } catch {
        /* fall through to map */
      }
    }
    return this._mapGet(this.userPermissions, key);
  }

  async cacheUserPermissions(userId: string, tenantId: string, app: string, permissions: unknown, ttl = 3600): Promise<void> {
    const key = this._getPermissionsKey(userId, tenantId, app);
    const vk = getValkey();
    if (vk && isValkeyReady()) {
      try { await vk.set(key, JSON.stringify(permissions), 'EX', ttl); return; } catch { /* fall through */ }
    }
    this.userPermissions.set(key, { value: permissions, expiresAt: Date.now() + ttl * 1000 });
  }

  // ── Roles ───────────────────────────────────────────────────────────────��─
  async cacheUserRoles(userId: string, tenantId: string, roles: unknown, ttl = 3600): Promise<void> {
    const key = this._getRolesKey(userId, tenantId);
    const vk = getValkey();
    if (vk && isValkeyReady()) {
      try { await vk.set(key, JSON.stringify(roles), 'EX', ttl); return; } catch { /* fall through */ }
    }
    this.userRoles.set(key, { value: roles, expiresAt: Date.now() + ttl * 1000 });
  }

  // ── Stats ───────────────────────────────────────────────────────────────��─
  async getCacheStats(): Promise<{ userAuth: number; userPermissions: number; userRoles: number; total: number }> {
    if (getValkey() && isValkeyReady()) {
      try {
        const [a, p, r] = await Promise.all([
          this._scanCount(`${AUTH_PREFIX}*`),
          this._scanCount(`${PERM_PREFIX}*`),
          this._scanCount(`${ROLES_PREFIX}*`),
        ]);
        return { userAuth: a, userPermissions: p, userRoles: r, total: a + p + r };
      } catch {
        /* fall through to map sizes */
      }
    }
    return {
      userAuth: this.userAuth.size,
      userPermissions: this.userPermissions.size,
      userRoles: this.userRoles.size,
      total: this.userAuth.size + this.userPermissions.size + this.userRoles.size,
    };
  }

  // ── Invalidation ────────────────────────────────────────────────────────��─
  /** Remove every cached entry (auth/permissions/roles) whose key contains `identifier`. */
  async invalidateUserCache(identifier: string, _tenantId?: string): Promise<void> {
    if (getValkey() && isValkeyReady()) {
      // Valkey is the store. _scanDel is best-effort — any key missed on a
      // transient error expires via its TTL. The in-process Map is not consulted
      // in Valkey mode (it is empty), so we return without touching it.
      const needle = escapeGlob(identifier);
      await Promise.all([
        this._scanDel(`${AUTH_PREFIX}*${needle}*`),
        this._scanDel(`${PERM_PREFIX}*${needle}*`),
        this._scanDel(`${ROLES_PREFIX}*${needle}*`),
      ]);
      return;
    }
    for (const store of [this.userAuth, this.userPermissions, this.userRoles]) {
      for (const key of store.keys()) {
        if (key.includes(identifier)) store.delete(key);
      }
    }
  }

  /** Remove permissions + roles entries scoped to a tenant. */
  async invalidateTenantCache(tenantId: string): Promise<void> {
    if (getValkey() && isValkeyReady()) {
      const needle = escapeGlob(tenantId);
      await Promise.all([
        this._scanDel(`${PERM_PREFIX}*${needle}*`),
        this._scanDel(`${ROLES_PREFIX}*${needle}*`),
      ]);
      return;
    }
    for (const store of [this.userPermissions, this.userRoles]) {
      for (const key of store.keys()) {
        if (key.includes(tenantId)) store.delete(key);
      }
    }
  }

  /** Remove permission entries for a given app (across all users/tenants). */
  async invalidateAppCache(app: string): Promise<void> {
    if (getValkey() && isValkeyReady()) {
      await this._scanDel(`${PERM_PREFIX}*:${escapeGlob(app)}*`);
      return;
    }
    for (const key of this.userPermissions.keys()) {
      if (key.includes(`:${app}`)) this.userPermissions.delete(key);
    }
  }

  /** Remove a single user's cached permissions for one app (exact key, no scan). */
  async invalidateUserAppPermissions(userId: string, tenantId: string, app: string): Promise<void> {
    const key = this._getPermissionsKey(userId, tenantId, app);
    const vk = getValkey();
    if (vk && isValkeyReady()) {
      try { await vk.del(key); return; } catch { /* fall through to map */ }
    }
    this.userPermissions.delete(key);
  }

  // ── Fallback cleanup ─────────────────────────────────────────────────────��
  _cleanupExpired() {
    const now = Date.now();
    for (const store of [this.userAuth, this.userPermissions, this.userRoles]) {
      for (const [key, entry] of store.entries()) {
        if (entry.expiresAt && now > entry.expiresAt) store.delete(key);
      }
    }
  }
}

// Cache TTL constants (seconds)
export const CacheTTL = {
  USER_AUTH: 3600,
  USER_PERMISSIONS: 3600,
  USER_ROLES: 3600,
};

// Cache key constants
export const CacheKeys = {
  USER_AUTH: 'auth',
  USER_PERMISSIONS: 'permissions',
  USER_ROLES: 'roles',
};

// Export singleton instance
const distributedSSOCache = new DistributedSSOCache();
export default distributedSSOCache;
export { DistributedSSOCache };
