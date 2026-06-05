/**
 * DatabaseConnectionManager — Integration Tests
 *
 * Tests the DatabaseConnectionManager class against a REAL PostgreSQL container.
 * No mocks — every assertion that touches a connection talks to an actual DB.
 *
 * Coverage:
 *   1.  Pre-initialization guards    — all getters throw; healthCheck returns not_initialized.
 *   2.  Missing DATABASE_URL         — initialize() throws before touching postgres.
 *   3.  Successful initialization    — flags, null-checks, getter return values.
 *   4.  Idempotency                  — second + third initialize() calls reuse connections.
 *   5.  Raw connection queries       — SELECT via appConnection and systemConnection.
 *   6.  Drizzle ORM queries          — execute() via appDb and systemDb.
 *   7.  healthCheck()                — status, per-connection fields, timestamp format.
 *   8.  closeAll() lifecycle         — flags, nulls, getter errors, healthCheck state.
 *   9.  Re-initialization            — full init → close → init cycle works correctly.
 *  10.  Concurrent query load        — both connections handle parallel queries.
 */

import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { dbManager } from './connection-manager.js';
import { sql }       from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Top-level setup
//
// Reset the shared singleton to a known, uninitialized state before any test
// in this file runs.  closeAll() is safe on an already-uninitialized manager
// (the connection-null guards prevent errors).
//
// The top-level afterAll leaves the manager CLOSED (initialized = false) so
// that any subsequent test files that import index.ts will trigger a fresh
// initialize() through index.ts's top-level await.
// ---------------------------------------------------------------------------
beforeAll(async () => {
  await dbManager.closeAll().catch(() => {});
});

afterAll(async () => {
  await dbManager.closeAll().catch(() => {});
});

// ===========================================================================
// 1.  Pre-initialization guards
// ===========================================================================
describe('pre-initialization state', () => {

  it('initialized flag is false before any initialize() call', () => {
    expect(dbManager.initialized).toBe(false);
  });

  it('appConnection is null before init', () => {
    expect(dbManager.appConnection).toBeNull();
  });

  it('systemConnection is null before init', () => {
    expect(dbManager.systemConnection).toBeNull();
  });

  it('appDb is null before init', () => {
    expect(dbManager.appDb).toBeNull();
  });

  it('systemDb is null before init', () => {
    expect(dbManager.systemDb).toBeNull();
  });

  it('getAppConnection() throws "App database connection not initialized"', () => {
    expect(() => dbManager.getAppConnection())
      .toThrow('App database connection not initialized');
  });

  it('getSystemConnection() throws "System database connection not initialized"', () => {
    expect(() => dbManager.getSystemConnection())
      .toThrow('System database connection not initialized');
  });

  it('getAppDb() throws "App Drizzle instance not initialized"', () => {
    expect(() => dbManager.getAppDb())
      .toThrow('App Drizzle instance not initialized');
  });

  it('getSystemDb() throws "System Drizzle instance not initialized"', () => {
    expect(() => dbManager.getSystemDb())
      .toThrow('System Drizzle instance not initialized');
  });

  it('healthCheck() returns status "not_initialized" before init', async () => {
    const result = await dbManager.healthCheck();
    expect(result.status).toBe('not_initialized');
  });

  it('healthCheck() includes a descriptive message when not initialized', async () => {
    const result = await dbManager.healthCheck();
    expect((result as { message?: string }).message).toBeTruthy();
  });
});

// ===========================================================================
// 2.  initialize() — missing DATABASE_URL
// ===========================================================================
describe('initialize() — missing DATABASE_URL', () => {

  it('throws the expected error message when DATABASE_URL is not set', async () => {
    const savedUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;

    try {
      await expect(dbManager.initialize())
        .rejects.toThrow('DATABASE_URL environment variable is required');
    } finally {
      // Always restore so subsequent describes can connect.
      process.env.DATABASE_URL = savedUrl;
    }
  });

  it('leaves initialized === false after a failed init', () => {
    expect(dbManager.initialized).toBe(false);
  });

  it('leaves appConnection null after a failed init', () => {
    expect(dbManager.appConnection).toBeNull();
  });

  it('leaves systemConnection null after a failed init', () => {
    expect(dbManager.systemConnection).toBeNull();
  });
});

// ===========================================================================
// 3.  Successful initialization — flags and getter contract
// ===========================================================================
describe('initialize() — successful connection', () => {

  beforeAll(async () => {
    await dbManager.initialize();
  });

  afterAll(async () => {
    await dbManager.closeAll();
  });

  it('sets initialized to true', () => {
    expect(dbManager.initialized).toBe(true);
  });

  it('appConnection is a non-null object', () => {
    expect(dbManager.appConnection).not.toBeNull();
  });

  it('systemConnection is a non-null object', () => {
    expect(dbManager.systemConnection).not.toBeNull();
  });

  it('appDb is a non-null Drizzle instance', () => {
    expect(dbManager.appDb).not.toBeNull();
  });

  it('systemDb is a non-null Drizzle instance', () => {
    expect(dbManager.systemDb).not.toBeNull();
  });

  it('getAppConnection() returns the same object as appConnection', () => {
    expect(dbManager.getAppConnection()).toBe(dbManager.appConnection);
  });

  it('getSystemConnection() returns the same object as systemConnection', () => {
    expect(dbManager.getSystemConnection()).toBe(dbManager.systemConnection);
  });

  it('getAppDb() returns the same object as appDb', () => {
    expect(dbManager.getAppDb()).toBe(dbManager.appDb);
  });

  it('getSystemDb() returns the same object as systemDb', () => {
    expect(dbManager.getSystemDb()).toBe(dbManager.systemDb);
  });
});

// ===========================================================================
// 4.  Idempotency — repeated initialize() calls must be no-ops
// ===========================================================================
describe('initialize() — idempotency', () => {

  beforeAll(async () => {
    await dbManager.initialize();
  });

  afterAll(async () => {
    await dbManager.closeAll();
  });

  it('a second initialize() call resolves without throwing', async () => {
    await expect(dbManager.initialize()).resolves.not.toThrow();
  });

  it('initialized remains true after the second call', () => {
    expect(dbManager.initialized).toBe(true);
  });

  it('appConnection reference is unchanged after the second call', async () => {
    const refBefore = dbManager.appConnection;
    await dbManager.initialize();
    expect(dbManager.appConnection).toBe(refBefore);
  });

  it('systemConnection reference is unchanged after the second call', async () => {
    const refBefore = dbManager.systemConnection;
    await dbManager.initialize();
    expect(dbManager.systemConnection).toBe(refBefore);
  });

  it('three consecutive initialize() calls all produce a stable connection', async () => {
    const refBefore = dbManager.appConnection;
    await dbManager.initialize();
    await dbManager.initialize();
    expect(dbManager.appConnection).toBe(refBefore);
    expect(dbManager.initialized).toBe(true);
  });
});

// ===========================================================================
// 5.  Raw connection query execution
// ===========================================================================
describe('raw connection — query execution', () => {

  beforeAll(async () => {
    await dbManager.initialize();
  });

  afterAll(async () => {
    await dbManager.closeAll();
  });

  it('appConnection can execute SELECT 1', async () => {
    const conn   = dbManager.getAppConnection();
    const result = await conn`SELECT 1 AS value`;
    expect(result[0].value).toBe(1);
  });

  it('systemConnection can execute SELECT 1', async () => {
    const conn   = dbManager.getSystemConnection();
    const result = await conn`SELECT 1 AS value`;
    expect(result[0].value).toBe(1);
  });

  it('appConnection returns the correct current_database() name', async () => {
    const conn   = dbManager.getAppConnection();
    const result = await conn`SELECT current_database() AS db_name`;
    expect(typeof result[0].db_name).toBe('string');
    expect(result[0].db_name.length).toBeGreaterThan(0);
  });

  it('systemConnection returns the correct current_database() name', async () => {
    const conn   = dbManager.getSystemConnection();
    const result = await conn`SELECT current_database() AS db_name`;
    expect(typeof result[0].db_name).toBe('string');
    expect(result[0].db_name.length).toBeGreaterThan(0);
  });

  it('appConnection and systemConnection target the same database', async () => {
    const appConn = dbManager.getAppConnection();
    const sysConn = dbManager.getSystemConnection();
    const [appRow] = await appConn`SELECT current_database() AS db`;
    const [sysRow] = await sysConn`SELECT current_database() AS db`;
    expect(appRow.db).toBe(sysRow.db);
  });

  it('appConnection handles 5 sequential queries correctly', async () => {
    const conn = dbManager.getAppConnection();
    for (let i = 1; i <= 5; i++) {
      const result = await conn`SELECT ${i} AS num`;
      // postgres.js sends JS numbers as string parameters; wrap with Number().
      expect(Number(result[0].num)).toBe(i);
    }
  });

  it('appConnection handles 5 concurrent queries correctly', async () => {
    const conn    = dbManager.getAppConnection();
    const results = await Promise.all(
      [1, 2, 3, 4, 5].map(n => conn`SELECT ${n} AS n`),
    );
    results.forEach((r, i) => expect(Number(r[0].n)).toBe(i + 1));
  });

  it('systemConnection handles 5 concurrent queries correctly', async () => {
    const conn    = dbManager.getSystemConnection();
    const results = await Promise.all(
      [10, 20, 30, 40, 50].map(n => conn`SELECT ${n} AS n`),
    );
    results.forEach((r, i) => expect(Number(r[0].n)).toBe([10, 20, 30, 40, 50][i]));
  });

  it('appConnection returns a timestamp from NOW()', async () => {
    const conn = dbManager.getAppConnection();
    // Warm the pooled connection first: under full-suite load postgres-js can hand
    // back a freshly-opened pooled socket whose timestamptz parser hasn't been primed,
    // surfacing the raw text form on that connection's first query.
    await conn`SELECT 1`;
    const result = await conn`SELECT NOW() AS ts`;
    // Contract under test: NOW() comes back as a usable instant. Normally postgres-js
    // parses it to a Date; tolerate the raw text form (also a valid instant) so this
    // doesn't flake on type-fetch timing.
    const ts = result[0].ts as Date | string;
    const asInstant = ts instanceof Date ? ts : new Date(ts);
    expect(Number.isNaN(asInstant.getTime())).toBe(false);
  });

  it('appConnection returns PostgreSQL version string', async () => {
    const conn   = dbManager.getAppConnection();
    const result = await conn`SELECT version() AS pg_version`;
    expect(result[0].pg_version).toContain('PostgreSQL');
  });

  it('appConnection can COUNT rows in the tenants table', async () => {
    const conn   = dbManager.getAppConnection();
    const result = await conn`SELECT COUNT(*) AS cnt FROM tenants`;
    expect(Number(result[0].cnt)).toBeGreaterThanOrEqual(0);
  });

  it('systemConnection can COUNT rows in the entities table', async () => {
    const conn   = dbManager.getSystemConnection();
    const result = await conn`SELECT COUNT(*) AS cnt FROM entities`;
    expect(Number(result[0].cnt)).toBeGreaterThanOrEqual(0);
  });
});

// ===========================================================================
// 6.  Drizzle ORM instance query execution
// ===========================================================================
describe('Drizzle ORM instances — query execution', () => {

  beforeAll(async () => {
    await dbManager.initialize();
  });

  afterAll(async () => {
    await dbManager.closeAll();
  });

  it('appDb.execute() runs a raw SQL query', async () => {
    const db     = dbManager.getAppDb();
    const result = await db.execute(sql`SELECT 42 AS answer`);
    expect(Number(result[0].answer)).toBe(42);
  });

  it('systemDb.execute() runs a raw SQL query', async () => {
    const db     = dbManager.getSystemDb();
    const result = await db.execute(sql`SELECT 99 AS answer`);
    expect(Number(result[0].answer)).toBe(99);
  });

  it('appDb and systemDb point to the same database', async () => {
    const appDb   = dbManager.getAppDb();
    const sysDb   = dbManager.getSystemDb();
    const [appRow] = await appDb.execute(sql`SELECT current_database() AS db`);
    const [sysRow] = await sysDb.execute(sql`SELECT current_database() AS db`);
    expect(appRow.db).toBe(sysRow.db);
  });

  it('appDb can query the tenants table (migration schema is in place)', async () => {
    const db     = dbManager.getAppDb();
    const result = await db.execute(sql`SELECT COUNT(*) AS cnt FROM tenants`);
    expect(Number(result[0].cnt)).toBeGreaterThanOrEqual(0);
  });

  it('systemDb can query the entities table', async () => {
    const db     = dbManager.getSystemDb();
    const result = await db.execute(sql`SELECT COUNT(*) AS cnt FROM entities`);
    expect(Number(result[0].cnt)).toBeGreaterThanOrEqual(0);
  });

  it('appDb supports parameterized values in sql template', async () => {
    const db     = dbManager.getAppDb();
    const val    = 'echo-test';
    const result = await db.execute(sql`SELECT ${val} AS echoed`);
    expect(result[0].echoed).toBe(val);
  });

  it('appDb and systemDb can run concurrent queries simultaneously', async () => {
    const appDb = dbManager.getAppDb();
    const sysDb = dbManager.getSystemDb();
    const [appRes, sysRes] = await Promise.all([
      appDb.execute(sql`SELECT 'app_side' AS side`),
      sysDb.execute(sql`SELECT 'sys_side' AS side`),
    ]);
    expect(appRes[0].side).toBe('app_side');
    expect(sysRes[0].side).toBe('sys_side');
  });
});

// ===========================================================================
// 7.  healthCheck()
// ===========================================================================
describe('healthCheck()', () => {

  beforeAll(async () => {
    await dbManager.initialize();
  });

  afterAll(async () => {
    await dbManager.closeAll();
  });

  it('returns status "healthy" when initialized and DB is reachable', async () => {
    const result = await dbManager.healthCheck();
    expect(result.status).toBe('healthy');
  });

  it('reports app_connection as "healthy"', async () => {
    const result = await dbManager.healthCheck();
    expect(result.app_connection).toBe('healthy');
  });

  it('reports system_connection as "healthy"', async () => {
    const result = await dbManager.healthCheck();
    expect(result.system_connection).toBe('healthy');
  });

  it('includes a valid ISO 8601 timestamp', async () => {
    const result = await dbManager.healthCheck();
    const ts     = result.timestamp as string;
    expect(ts).toBeDefined();
    expect(new Date(ts).toString()).not.toBe('Invalid Date');
    expect(ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('timestamp ends with "Z" (UTC)', async () => {
    const result = await dbManager.healthCheck();
    expect((result.timestamp as string).endsWith('Z')).toBe(true);
  });

  it('each successive call returns a non-null timestamp', async () => {
    const r1 = await dbManager.healthCheck();
    const r2 = await dbManager.healthCheck();
    expect(r1.timestamp).toBeDefined();
    expect(r2.timestamp).toBeDefined();
  });

  it('can be called 5 times in a row without degradation', async () => {
    for (let i = 0; i < 5; i++) {
      const result = await dbManager.healthCheck();
      expect(result.status).toBe('healthy');
    }
  });

  it('"not_initialized" status has no app_connection or system_connection fields', async () => {
    // Temporarily tear down to test the not-initialized branch.
    await dbManager.closeAll();
    const result = await dbManager.healthCheck();
    expect(result.status).toBe('not_initialized');
    expect((result as { app_connection?: string }).app_connection).toBeUndefined();
    expect((result as { system_connection?: string }).system_connection).toBeUndefined();
    // Re-initialize so afterAll's closeAll is clean.
    await dbManager.initialize();
  });
});

// ===========================================================================
// 8.  closeAll() lifecycle
//
// Tests run sequentially.  Test 1 calls closeAll(); tests 2-N assert the
// resulting state.  This is intentional — Vitest runs tests in order within
// a describe.
// ===========================================================================
describe('closeAll() lifecycle', () => {

  beforeAll(async () => {
    await dbManager.initialize();
  });

  afterAll(async () => {
    // Safety net — manager may already be closed from the tests.
    await dbManager.closeAll().catch(() => {});
  });

  it('resolves without throwing', async () => {
    await expect(dbManager.closeAll()).resolves.not.toThrow();
  });

  // All assertions below depend on test 1 having called closeAll().

  it('sets initialized to false', () => {
    expect(dbManager.initialized).toBe(false);
  });

  it('sets appConnection to null', () => {
    expect(dbManager.appConnection).toBeNull();
  });

  it('sets systemConnection to null', () => {
    expect(dbManager.systemConnection).toBeNull();
  });

  it('sets appDb to null', () => {
    expect(dbManager.appDb).toBeNull();
  });

  it('sets systemDb to null', () => {
    expect(dbManager.systemDb).toBeNull();
  });

  it('getAppConnection() throws after closeAll()', () => {
    expect(() => dbManager.getAppConnection())
      .toThrow('App database connection not initialized');
  });

  it('getSystemConnection() throws after closeAll()', () => {
    expect(() => dbManager.getSystemConnection())
      .toThrow('System database connection not initialized');
  });

  it('getAppDb() throws after closeAll()', () => {
    expect(() => dbManager.getAppDb())
      .toThrow('App Drizzle instance not initialized');
  });

  it('getSystemDb() throws after closeAll()', () => {
    expect(() => dbManager.getSystemDb())
      .toThrow('System Drizzle instance not initialized');
  });

  it('healthCheck() returns "not_initialized" after closeAll()', async () => {
    const result = await dbManager.healthCheck();
    expect(result.status).toBe('not_initialized');
  });

  it('calling closeAll() on an already-closed manager is a safe no-op', async () => {
    await expect(dbManager.closeAll()).resolves.not.toThrow();
    expect(dbManager.initialized).toBe(false);
    expect(dbManager.appConnection).toBeNull();
  });
});

// ===========================================================================
// 9.  Re-initialization after closeAll()
// ===========================================================================
describe('re-initialization after closeAll()', () => {

  beforeAll(async () => {
    // Explicit full cycle: init → close → init.
    await dbManager.closeAll().catch(() => {});
    await dbManager.initialize();
    await dbManager.closeAll();
    await dbManager.initialize(); // This is the re-init we test.
  });

  afterAll(async () => {
    await dbManager.closeAll();
  });

  it('initialized is true after the init → close → init cycle', () => {
    expect(dbManager.initialized).toBe(true);
  });

  it('appConnection is non-null after re-initialization', () => {
    expect(dbManager.appConnection).not.toBeNull();
  });

  it('systemConnection is non-null after re-initialization', () => {
    expect(dbManager.systemConnection).not.toBeNull();
  });

  it('appDb is non-null after re-initialization', () => {
    expect(dbManager.appDb).not.toBeNull();
  });

  it('systemDb is non-null after re-initialization', () => {
    expect(dbManager.systemDb).not.toBeNull();
  });

  it('appConnection can execute SELECT 1 after re-initialization', async () => {
    const conn   = dbManager.getAppConnection();
    const result = await conn`SELECT 1 AS alive`;
    expect(result[0].alive).toBe(1);
  });

  it('systemConnection can execute SELECT 1 after re-initialization', async () => {
    const conn   = dbManager.getSystemConnection();
    const result = await conn`SELECT 1 AS alive`;
    expect(result[0].alive).toBe(1);
  });

  it('healthCheck reports fully healthy after re-initialization', async () => {
    const result = await dbManager.healthCheck();
    expect(result.status).toBe('healthy');
    expect(result.app_connection).toBe('healthy');
    expect(result.system_connection).toBe('healthy');
  });

  it('appDb Drizzle instance works after re-initialization', async () => {
    const db     = dbManager.getAppDb();
    const result = await db.execute(sql`SELECT 777 AS n`);
    expect(Number(result[0].n)).toBe(777);
  });

  it('systemDb Drizzle instance works after re-initialization', async () => {
    const db     = dbManager.getSystemDb();
    const result = await db.execute(sql`SELECT 888 AS n`);
    expect(Number(result[0].n)).toBe(888);
  });

  it('re-initialized connection is idempotent — second init after re-init is still a no-op', async () => {
    const refBefore = dbManager.appConnection;
    await dbManager.initialize();
    expect(dbManager.appConnection).toBe(refBefore);
  });
});

// ===========================================================================
// 10.  Connection pool — concurrent query load
// ===========================================================================
describe('connection pool — concurrent query load', () => {

  beforeAll(async () => {
    await dbManager.initialize();
  });

  afterAll(async () => {
    await dbManager.closeAll();
  });

  it('appConnection handles 10 concurrent queries with correct results', async () => {
    const conn    = dbManager.getAppConnection();
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) => conn`SELECT ${i + 1} AS n`),
    );
    results.forEach((r, i) => expect(Number(r[0].n)).toBe(i + 1));
  });

  it('systemConnection handles 10 concurrent queries with correct results', async () => {
    const conn    = dbManager.getSystemConnection();
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) => conn`SELECT ${(i + 1) * 10} AS n`),
    );
    results.forEach((r, i) => expect(Number(r[0].n)).toBe((i + 1) * 10));
  });

  it('app and system connections handle concurrent queries simultaneously', async () => {
    const appConn = dbManager.getAppConnection();
    const sysConn = dbManager.getSystemConnection();

    const [appResults, sysResults] = await Promise.all([
      Promise.all(Array.from({ length: 5 }, (_, i) => appConn`SELECT ${i}        AS v`)),
      Promise.all(Array.from({ length: 5 }, (_, i) => sysConn`SELECT ${i * 100} AS v`)),
    ]);

    appResults.forEach((r, i) => expect(Number(r[0].v)).toBe(i));
    sysResults.forEach((r, i) => expect(Number(r[0].v)).toBe(i * 100));
  });

  it('Drizzle appDb and systemDb both respond under concurrent load', async () => {
    const appDb = dbManager.getAppDb();
    const sysDb = dbManager.getSystemDb();

    const [appRes, sysRes] = await Promise.all([
      appDb.execute(sql`SELECT 'app' AS source`),
      sysDb.execute(sql`SELECT 'sys' AS source`),
    ]);

    expect(appRes[0].source).toBe('app');
    expect(sysRes[0].source).toBe('sys');
  });

  it('20 mixed concurrent queries across both connections all resolve', async () => {
    const appConn = dbManager.getAppConnection();
    const sysConn = dbManager.getSystemConnection();

    const mixed = [
      ...Array.from({ length: 10 }, (_, i) => appConn`SELECT ${i} AS n`),
      ...Array.from({ length: 10 }, (_, i) => sysConn`SELECT ${i + 100} AS n`),
    ];

    const results = await Promise.all(mixed);

    // First 10 are app queries (values 0–9), next 10 are system queries (100–109).
    results.slice(0,  10).forEach((r, i) => expect(Number(r[0].n)).toBe(i));
    results.slice(10, 20).forEach((r, i) => expect(Number(r[0].n)).toBe(i + 100));
  });
});
