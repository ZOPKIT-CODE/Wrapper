/**
 * Shared cache with async interface.
 *
 * Currently backed by in-process Maps (single-instance / dev setups).
 * To enable Redis for horizontal scaling: install `ioredis`, set REDIS_URL,
 * and uncomment the Redis branch in getRedisClient() below.
 *
 * The public API is fully async so the call-sites are forward-compatible —
 * swapping in Redis requires no changes outside this file.
 */

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

  /** Returns all non-expired keys (for prefix-scan invalidation patterns). */
  keys(): IterableIterator<string> {
    const now = Date.now();
    const live = new Map<string, CacheEntry<T>>();
    for (const [k, v] of this.store) {
      if (now <= v.expiresAt) live.set(k, v);
    }
    return live.keys();
  }
}

// ── Redis client (optional) ────────────────────────────────────────────────
// Uncomment and install `ioredis` to enable Redis-backed shared cache.
//
// let redisClient: {
//   get: (k: string) => Promise<string | null>;
//   set: (k: string, v: string, opts: { EX: number }) => Promise<unknown>;
//   del: (k: string) => Promise<unknown>;
// } | null = null;
//
// async function getRedisClient() {
//   if (redisClient) return redisClient;
//   const url = process.env.REDIS_URL;
//   if (!url) return null;
//   try {
//     const { default: Redis } = await import('ioredis');
//     const client = new Redis(url, { lazyConnect: true, enableOfflineQueue: false, maxRetriesPerRequest: 1 });
//     await client.connect().catch(() => null);
//     redisClient = {
//       get: (k) => client.get(k),
//       set: (k, v, { EX }) => client.set(k, v, 'EX', EX),
//       del: (k) => client.del(k),
//     };
//     return redisClient;
//   } catch {
//     return null;
//   }
// }
// ──────────────────────────────────────────────────────────────────────────

export class SharedCache<T> {
  private fallback: InProcessCache<T>;

  constructor(
    /** Namespace prefix — used as a Redis key prefix when Redis is enabled. */
    readonly namespace: string,
  ) {
    this.fallback = new InProcessCache<T>();
  }

  async get(key: string): Promise<T | undefined> {
    // Redis branch (future):
    // const redis = await getRedisClient();
    // if (redis) {
    //   const raw = await redis.get(`${this.namespace}:${key}`).catch(() => null);
    //   if (raw === null) return undefined;
    //   try { return JSON.parse(raw) as T; } catch { return undefined; }
    // }
    return this.fallback.get(key);
  }

  async set(key: string, value: T, ttlMs: number): Promise<void> {
    // Redis branch (future):
    // const redis = await getRedisClient();
    // if (redis) {
    //   await redis.set(`${this.namespace}:${key}`, JSON.stringify(value), { EX: Math.ceil(ttlMs / 1000) }).catch(() => null);
    //   return;
    // }
    this.fallback.set(key, value, ttlMs);
  }

  async delete(key: string): Promise<void> {
    // Redis branch (future):
    // const redis = await getRedisClient();
    // if (redis) { await redis.del(`${this.namespace}:${key}`).catch(() => null); }
    this.fallback.delete(key);
  }

  /**
   * Returns all live (non-expired) keys in the in-process fallback store.
   * Used for prefix-scan invalidation (e.g. deleting all keys for a user).
   * When Redis is active this should be replaced with a SCAN pattern call.
   */
  keys(): IterableIterator<string> {
    return this.fallback.keys();
  }
}
