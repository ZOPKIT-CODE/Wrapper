/**
 * Shared cache with an async interface.
 *
 * Single-tier design: when Valkey/Redis is enabled and connected (see
 * ./valkey-client), every get/set/delete goes to Valkey ONLY — there is no
 * in-process L1 in front of it. That means an invalidation (delete) performed by
 * any one instance is immediately visible to all instances on their next read,
 * which is what makes this correct under horizontal scaling.
 *
 * When Valkey is disabled or unreachable, it falls back to an in-process Map so
 * single-instance / dev setups still work (just not shared across instances).
 *
 * The public API is fully async, so call-sites are agnostic to the backend.
 */
import { getValkey, isValkeyReady } from './valkey-client.js';

interface CacheEntry<T> { value: T; expiresAt: number }

class InProcessCache<T> {
  private store = new Map<string, CacheEntry<T>>();

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T, ttlMs: number): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  /** Returns all non-expired keys (for prefix-scan invalidation in fallback mode). */
  keys(): string[] {
    const now = Date.now();
    const live: string[] = [];
    for (const [k, v] of this.store) {
      if (now <= v.expiresAt) live.push(k);
    }
    return live;
  }
}

export class SharedCache<T> {
  private fallback: InProcessCache<T>;

  constructor(
    /** Namespace prefix — used as the Valkey key prefix when Valkey is enabled. */
    readonly namespace: string,
  ) {
    this.fallback = new InProcessCache<T>();
  }

  private redisKey(key: string): string {
    return `${this.namespace}:${key}`;
  }

  async get(key: string): Promise<T | undefined> {
    const vk = getValkey();
    if (vk && isValkeyReady()) {
      try {
        const raw = await vk.get(this.redisKey(key));
        if (raw === null) return undefined;
        try {
          return JSON.parse(raw) as T;
        } catch {
          return undefined; // corrupt entry — treat as miss
        }
      } catch {
        // Transient Valkey error — fall back to in-process so we don't hammer the DB.
      }
    }
    return this.fallback.get(key);
  }

  async set(key: string, value: T, ttlMs: number): Promise<void> {
    const vk = getValkey();
    if (vk && isValkeyReady()) {
      try {
        await vk.set(this.redisKey(key), JSON.stringify(value), 'PX', ttlMs);
        return;
      } catch {
        // Fall through to in-process on transient errors.
      }
    }
    this.fallback.set(key, value, ttlMs);
  }

  async delete(key: string): Promise<void> {
    const vk = getValkey();
    if (vk && isValkeyReady()) {
      try {
        await vk.del(this.redisKey(key));
        return;
      } catch {
        // Fall through to in-process on transient errors.
      }
    }
    this.fallback.delete(key);
  }

  /**
   * Delete every key whose (un-namespaced) name starts with `prefix`.
   * Used for fan-out invalidation, e.g. dropping all tenant-scoped entries for a
   * user. Uses a non-blocking SCAN+DEL against Valkey, or a key scan in fallback.
   */
  async deleteByPrefix(prefix: string): Promise<void> {
    const vk = getValkey();
    if (vk && isValkeyReady()) {
      try {
        const match = `${this.namespace}:${prefix}*`;
        let cursor = '0';
        do {
          const [next, batch] = await vk.scan(cursor, 'MATCH', match, 'COUNT', 250);
          cursor = next;
          if (batch.length) await vk.del(...batch);
        } while (cursor !== '0');
        return;
      } catch {
        // Fall through to in-process on transient errors.
      }
    }
    for (const key of this.fallback.keys()) {
      if (key.startsWith(prefix)) this.fallback.delete(key);
    }
  }
}
