/**
 * Shared Valkey / Redis client (AWS ElastiCache Valkey compatible).
 *
 * A single process-wide ioredis connection, reused by every SharedCache
 * instance so that cache reads, writes, and — critically — invalidations are
 * SHARED across horizontally-scaled instances. This is what makes the cache a
 * single shared tier rather than per-instance islands: a `DEL` performed by the
 * one instance that consumed a role.* event invalidates the entry for the whole
 * fleet, instead of only flushing that instance's local Map.
 *
 * Enabled when REDIS_ENABLED=true AND a target is configured via:
 *   - REDIS_URL   (preferred; use rediss:// for TLS, e.g. ElastiCache in-transit
 *                  encryption), or
 *   - REDIS_HOST / REDIS_PORT / REDIS_PASSWORD / REDIS_DB (+ REDIS_TLS=true).
 *
 * If disabled or unreachable, SharedCache falls back to an in-process Map, so
 * the app still runs (single-instance / dev) — it just isn't shared.
 *
 * NOTE on cluster mode: this uses a single-endpoint client, which is correct for
 * ElastiCache Valkey with cluster-mode DISABLED (primary/reader endpoint). If you
 * enable cluster mode, switch to `new Redis.Cluster([...])` here.
 */
import { Redis, type RedisOptions } from 'ioredis';

let client: Redis | null = null;
let ready = false;
let initialized = false;

export function isValkeyEnabled(): boolean {
  return process.env.REDIS_ENABLED === 'true';
}

function baseOptions(): RedisOptions {
  const opts: RedisOptions = {
    // Connect eagerly so the pool is warm before the first request.
    lazyConnect: false,
    // Fail fast on the hot auth path instead of queueing commands while the
    // connection is down — SharedCache then falls back to the in-process Map.
    enableOfflineQueue: false,
    maxRetriesPerRequest: 2,
    connectTimeout: 10_000,
    keepAlive: 30_000,
    // Bounded reconnect backoff (cap 2s).
    retryStrategy: (times: number) => Math.min(times * 200, 2_000),
  };
  const url = process.env.REDIS_URL?.trim();
  if (process.env.REDIS_TLS === 'true' || url?.startsWith('rediss://')) {
    opts.tls = {};
  }
  return opts;
}

/**
 * Returns the shared client (creating it on first call) or null when Valkey is
 * disabled / unconfigured. Safe to call on every cache op — cheap after init.
 */
export function getValkey(): Redis | null {
  if (!isValkeyEnabled()) return null;
  if (initialized) return client;
  initialized = true;

  const opts = baseOptions();
  const url = process.env.REDIS_URL?.trim();
  const host = process.env.REDIS_HOST?.trim();

  if (!url && !host) {
    console.warn('⚠️ [valkey] REDIS_ENABLED=true but neither REDIS_URL nor REDIS_HOST is set — using in-process cache');
    return null;
  }

  try {
    client = url
      ? new Redis(url, opts)
      : new Redis({
          ...opts,
          host,
          port: Number(process.env.REDIS_PORT ?? 6379),
          password: process.env.REDIS_PASSWORD || undefined,
          db: Number(process.env.REDIS_DB ?? 0),
        });

    // An 'error' listener is mandatory: without one, ioredis re-emits connection
    // errors as uncaught exceptions and crashes the process.
    client.on('error', (e: Error) => {
      ready = false;
      console.warn('⚠️ [valkey] error:', e.message);
    });
    client.on('ready', () => {
      ready = true;
      console.log('✅ [valkey] connected — shared cache active');
    });
    client.on('reconnecting', () => console.log('🔄 [valkey] reconnecting...'));
    client.on('close', () => { ready = false; });
    client.on('end', () => { ready = false; });

    return client;
  } catch (e) {
    console.warn('⚠️ [valkey] failed to initialize — using in-process cache:', (e as Error).message);
    client = null;
    return null;
  }
}

/** True only when a client exists and the connection is established. */
export function isValkeyReady(): boolean {
  return ready && client !== null;
}

/** Close the shared connection during graceful shutdown. */
export async function closeValkey(): Promise<void> {
  if (!client) return;
  try {
    await client.quit();
  } catch {
    /* ignore — best-effort close */
  }
  client = null;
  ready = false;
  initialized = false; // allow re-init if the process survives the close (tests/reuse)
}
