/**
 * Smoke test for the AsyncLocalStorage-backed request DB scope.
 *
 * The risk we're guarding against: `enterWith` inside a Fastify `onRequest`
 * hook must stick across the rest of the hook chain (preHandler, the route
 * handler itself, and onResponse). If Fastify's internal scheduling broke the
 * async context — e.g. by detaching the request via `setImmediate` outside an
 * AsyncResource — `getRequestDb()` inside the handler would return undefined
 * and every RLS-protected query would silently fall back to the global pool.
 *
 * We use a fake "db" object so this test doesn't depend on a live database.
 */

import { describe, it, expect, afterAll } from 'vitest';
import Fastify from 'fastify';
import {
  enterRequestDbScope,
  getRequestDb,
  type RequestScopedDb,
} from './request-context.js';

// Build a value structurally compatible with RequestScopedDb without
// instantiating the real Drizzle client (which would require a live DB).
function makeFakeDb(tag: string): RequestScopedDb {
  return { __fakeTag: tag } as unknown as RequestScopedDb;
}

describe('request-context: AsyncLocalStorage ↔ Fastify', () => {
  it('returns undefined outside any request scope', () => {
    expect(getRequestDb()).toBeUndefined();
  });

  it('propagates the entered store from onRequest → handler → onResponse', async () => {
    const app = Fastify();
    const fake = makeFakeDb('req-1');

    let seenInPreHandler: RequestScopedDb | undefined;
    let seenInHandler: RequestScopedDb | undefined;
    let seenInOnResponse: RequestScopedDb | undefined;

    app.addHook('onRequest', async () => {
      enterRequestDbScope(fake);
    });

    app.addHook('preHandler', async () => {
      seenInPreHandler = getRequestDb();
    });

    app.get('/probe', async () => {
      seenInHandler = getRequestDb();
      return { ok: true };
    });

    app.addHook('onResponse', async () => {
      seenInOnResponse = getRequestDb();
    });

    const res = await app.inject({ method: 'GET', url: '/probe' });

    expect(res.statusCode).toBe(200);
    expect(seenInPreHandler).toBe(fake);
    expect(seenInHandler).toBe(fake);
    expect(seenInOnResponse).toBe(fake);

    await app.close();
  });

  it('isolates stores between concurrent requests', async () => {
    const app = Fastify();
    const observed: Array<{ id: string; saw: string | undefined }> = [];

    app.addHook('onRequest', async (req) => {
      const id = String(req.query as { id?: string }).valueOf();
      const qid = (req.query as { id?: string }).id ?? 'none';
      enterRequestDbScope(makeFakeDb(`store-${qid}`));
      // silence unused var if any
      void id;
    });

    app.get('/probe', async (req) => {
      const tag = (getRequestDb() as unknown as { __fakeTag?: string } | undefined)?.__fakeTag;
      const qid = (req.query as { id?: string }).id ?? 'none';
      observed.push({ id: qid, saw: tag });
      // Yield to the event loop so concurrent requests are interleaved.
      await new Promise((r) => setImmediate(r));
      const tag2 = (getRequestDb() as unknown as { __fakeTag?: string } | undefined)?.__fakeTag;
      observed.push({ id: qid + ':after-yield', saw: tag2 });
      return { ok: true };
    });

    // Fire several requests in parallel; each must observe its own store
    // before AND after a forced async yield.
    await Promise.all([
      app.inject({ method: 'GET', url: '/probe?id=A' }),
      app.inject({ method: 'GET', url: '/probe?id=B' }),
      app.inject({ method: 'GET', url: '/probe?id=C' }),
    ]);

    const byId = (id: string) => observed.filter((o) => o.id === id || o.id === id + ':after-yield');
    expect(byId('A').every((o) => o.saw === 'store-A')).toBe(true);
    expect(byId('B').every((o) => o.saw === 'store-B')).toBe(true);
    expect(byId('C').every((o) => o.saw === 'store-C')).toBe(true);

    await app.close();
  });

  it('leaves the store undefined after the response (no leak to the next caller)', async () => {
    const app = Fastify();

    app.addHook('onRequest', async () => {
      enterRequestDbScope(makeFakeDb('leak-probe'));
    });

    app.get('/probe', async () => ({ ok: true }));

    await app.inject({ method: 'GET', url: '/probe' });

    // Outside the request's async context, the store is gone.
    expect(getRequestDb()).toBeUndefined();

    await app.close();
  });
});

afterAll(() => {
  // No cleanup needed — vitest will exit. This keeps the file
  // explicitly free of process-leak failure modes from leftover Fastify
  // instances if a test threw before close().
});
