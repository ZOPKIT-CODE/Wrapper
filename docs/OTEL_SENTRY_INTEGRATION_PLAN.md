# OpenTelemetry + Sentry Integration Plan — Zopkit Suite (wrapper, b2b-crm, finance-accounting)

## 1. Executive Summary

`@sentry/node` v10 **is built on OpenTelemetry**: `Sentry.init()` internally calls `initOpenTelemetry()`, which registers a Sentry-managed `BasicTracerProvider`, `SentrySpanProcessor`, `SentryPropagator`, and `SentryContextManager` as the OTel globals. There is therefore exactly one correct architecture decision and we make it once for the whole fleet.

Both wrapper and FA **declare** `@sentry/node ^10.46.0` in `package.json` (10.53.1 is merely the resolved lockfile version in wrapper; there is no real version divergence to manage between them — both float on the same range).

**Chosen mode: Mode B — Custom-OTel-with-Sentry (Sentry owns one provider; we attach a second OTLP span processor to it).**

- Call `Sentry.init({ ..., skipOpenTelemetrySetup: true })`, then build **one** `NodeTracerProvider` with `sampler: new SentrySampler(client)` and `spanProcessors: [new SentrySpanProcessor(), new BatchSpanProcessor(new OTLPTraceExporter(...))]`, register it with a `CompositePropagator([SentryPropagator, W3CTraceContextPropagator, W3CBaggagePropagator])` + `SentryContextManager`, then `registerInstrumentations([...])`. Spans flow to **both** Sentry and the OTLP backend through a single provider — no dual-registration conflict, one sampling decision, intact W3C + sentry-trace propagation.
- We choose Mode B over Mode A (Sentry-owns-everything) **only because we want a second OTLP egress** (Collector → Tempo/Sentry-OTLP) for retention/fan-out. Services that never need OTLP fall back to Mode A semantics automatically (no OTLP processor added when `OTEL_EXPORTER_OTLP_ENDPOINT` is unset). **Sampling consequence is explicit: because `SentrySampler` makes one head decision honored by both processors, Tempo receives the *same* sampled subset as Sentry — Tempo is NOT a 100% retention sink under this wiring (see §9).**
- **The whole `initTelemetry` body is gated on `SENTRY_DSN || OTEL_EXPORTER_OTLP_ENDPOINT`.** With neither set, no provider/propagator/context-manager is registered at all — a true global no-op kill-switch, not merely "no OTLP processor."
- **Wrapper's `instrument.ts` MUST be reconciled first.** Today it does `await import('@opentelemetry/sdk-node')` → `new NodeSDK().start()` (which calls `trace.setGlobalTracerProvider()` and `propagation.setGlobalPropagator()`) and *then* calls `Sentry.init()`. Last-writer-wins means the two providers/propagators stomp each other: Sentry's `SentrySpanProcessor` ends up on a provider whose OTLP exporter is on a different (replaced) provider, so the OTLP backend gets **zero** spans and SentryPropagator is overwritten by W3C-only, severing distributed traces. The standalone `NodeSDK` block is deleted and replaced with the Mode-B single-provider wiring above.
- The fleet shares one bootstrap module (`@zopkit/platform-sdk/telemetry`) consumed by CRM + FA; **wrapper copies the same logic** into its own `instrument.ts` because wrapper does not depend on platform-sdk.

**Scope of this plan:** distributed **traces**, **errors**, and **logs (with trace correlation)**. **OTel metrics and continuous profiling (`@sentry/profiling-node`) are explicitly OUT of scope for this iteration** (deferred — see §10 "Deferred / out of scope"); the collector pipeline is laid out so a metrics pipeline can be added later without re-architecting.

---

## 2. Target Architecture (ASCII)

> **Frontend dev ports are assumptions pending verification** — none of the three `vite.config.ts` files have been confirmed to set these. The Phase 5 acceptance step (§5) includes "grep each vite.config.ts `server.port`" as a hard gate, because a `tracePropagationTargets` regex that does not match the real dev origin **silently disables FE→BE trace continuation** (no error, just broken traces). The values below are placeholders to be replaced with verified ports before merge.

```
                          BROWSERS (3 SPAs, @sentry/react v8)
   wrapper FE (verify port)  b2b-crm FE (verify port)  finance-accounting FE (verify port)
   (TanStack Router)         (react-router v6)          (TanStack Router)
        |                       |                        |
        |  sentry-trace + baggage headers on fetch/XHR (tracePropagationTargets = VERIFIED dev origin + prod host)
        |  envelopes via /tunnel (ad-blocker bypass; tunnel does NOT need the CORS header fix)
        v                       v                        v
 ┌──────────────────────────────────────────────────────────────────────────┐
 │  BACKENDS  — @sentry/node ^10 (Mode B: skipOpenTelemetrySetup) + 1 provider │
 │  Single pinned OTel minor across @sentry/* + auto-instrumentations (see §4) │
 │                                                                            │
 │  wrapper-backend          b2b-crm/server          finance-accounting/server│
 │  Fastify 4 (ESM)          Fastify 5 (CJS-ish/tsx)  Fastify 4 (CJS)          │
 │  + Temporal worker (tsx)  + crm-worker             + fa-worker              │
 │  + cron/outbox            + orchestration-worker   + orchestration-worker   │
 │                           + SQS consumer (proc)    + SQS consumer (proc)    │
 │       \                          |                        /                 │
 │        \  SentrySpanProcessor ───┼─── BatchSpanProcessor(OTLPTraceExporter) │
 │           (one NodeTracerProvider; SentrySampler = single head decision)    │
 └──────────────────────────────────────────────────────────────────────────┘
        |   sentry-trace+baggage + W3C traceparent (CompositePropagator)      |
        |   manual W3C inject/extract on ALL async seams (SNS/SQS/EventBridge) |   OTLP/http
        |                                                                      v
        v                                          ┌──────────────────────────────────┐
        |                                          │ OTel Collector — TWO TIER         │
        |                                          │ DaemonSet AGENT (node-local :4318) │
        |                                          │   → batch → OTLP to gateway        │
        |                                          │ Gateway: LB tier (routing_key=     │
        |                                          │   traceID) → tail_sampling tier    │
        |                                          │   (separate Deployment) → redaction│
        |                                          │   → otlphttp/sentry + otlp/tempo   │
        |                                          └───────────────┬────────────────────┘
        v                                                          v
  ┌─────────────────────────────┐                       ┌──────────────────────┐
  │  SENTRY (SaaS)              │ <──── SDK direct ──────┤  (SDK egress path)    │
  │  region per data residency  │ <── Collector OTLP ────┤  Grafana Tempo (self) │
  │  projects: wrapper/crm/fa   │      (§9 EU vs US)      │  (same sampled subset)│
  └─────────────────────────────┘                       └──────────────────────┘

  Apps' OTEL_EXPORTER_OTLP_ENDPOINT → node-local DaemonSet AGENT (NOT the gateway svc).
  Agent forwards to the gateway svc; only the gateway holds egress credentials + does tail sampling.

  CROSS-SERVICE ASYNC TRACE PROPAGATION (W3C traceparent + tracestate carriers — ALWAYS manual)
  ──────────────────────────────────────────────────────────────────────────────────────────
  wrapper ──SNS Publish (MessageAttributes: traceparent)──► SQS ──► CRM consumer  [raw delivery!]
  wrapper ──SNS Publish (MessageAttributes: traceparent)──► SQS ──► FA  consumer  [raw delivery!]
  CRM/FA  ──EventBridge PutEvents (event._otel.traceparent)──► bus ──► SQS(body.detail._otel) ──► consumers
  wrapper outbox row stores message_attributes JSON (incl. traceparent) → poller adds a LINK (not naive re-parent)
  HTTP: OTel http/undici instrumentation auto-injects on FA→wrapper (axios), CRM→FA (fetch), CRM→wrapper
```

---

## 3. Per-Service Current-State Table

| | **wrapper-backend** | **b2b-crm/server** | **finance-accounting/server** |
|---|---|---|---|
| **Sentry** | ✅ `@sentry/node` (declares `^10.46.0`; resolves 10.53.1), init in `src/instrument.ts`, `_experiments.enableLogs`, beforeSend strips auth/cookie. No `setupFastifyErrorHandler`. | ❌ none (no `@sentry/*` dep, no init) | ✅ `@sentry/node ^10.46.0`, `server/instrument.ts`. **Already has** `enabled: !!process.env.SENTRY_DSN` AND `sendDefaultPii: false` AND `requestDataIntegration` (everything but `query_string` off). **No missing `enabled`/PII gate to add.** |
| **OTel** | ⚠️ `sdk-node` 0.218.x etc. installed but **dual-init conflict** (standalone NodeSDK + Sentry). Gated on `OTEL_EXPORTER_OTLP_ENDPOINT`. | ❌ none | ⚠️ only Sentry-bundled OTel; **no direct `@opentelemetry/*` deps**, no NodeSDK, no OTLP exporter |
| **Logging** | Two Winston loggers (`logger.ts` + `logger-enhanced.ts` w/ Elasticsearch) + Fastify pino. **No trace correlation.** | bare pino + AsyncLocalStorage; SQS/workers use `console.*`; **no shared pino logger module** (pino transitive via fastify@5) | pino 8.17.2 + pino-pretty; `logMethod` hook in `server/utils/logger.ts` forwards to `Sentry.logger.*`. **No trace_id/span_id injection.** |
| **Where Sentry is wired (FA)** | — | — | `Sentry.init` lives in `instrument.ts`; `setupFastifyErrorHandler` is in **`server/index.ts:52`** (NOT instrument.ts); pino→Sentry bridge is in **`server/utils/logger.ts`** (logMethod hook), NOT instrument.ts; consumer flush `Sentry.flush(3000/2000)` in `accounting-sqs-consumer-runner.ts:48/52/147`. |
| **Entry points** | `src/bootstrap.ts` imports `./instrument.js` then dynamically `import()`s `app.js`; `temporal/worker.js` launched via **`tsx temporal/worker.js`** (script `temporal:worker`) — documented to FAIL under bare `node` (relies on tsx `.js`→`.ts` mapping); **never compiled to dist**; crons in-process | `src/server.ts`; `scripts/crm-worker.ts`; `scripts/orchestration-worker.ts`; `scheduled/sqs-consumer.ts` (all `console.*`) | `server/index.ts`; `scripts/fa-worker.ts`; `scripts/orchestration-worker.ts`; `scripts/accounting-sqs-consumer-runner.ts` |
| **Module system** | ESM (`"type":"module"`, **top-level `await import()` in instrument.ts** — must be removed) | TS via tsx, ESM-ish | CJS (esbuild→dist; `tsconfig module:CommonJS`) |
| **SQS consumer trace-readiness** | reads `MessageAttributes` | `handleMessage` does NOT read `MessageAttributes` | `ReceiveMessageCommand` requests only `AttributeNames:['ApproximateReceiveCount']`; `handleMessage` typed param has **NO `MessageAttributes` field** — type must be widened |
| **Key changes** | Rewrite `instrument.ts` to Mode B; delete NodeSDK block; remove no-op `overrides`; **pin OTel minor**; add `setupFastifyErrorHandler`; wire workers (via tsx) /crons/seams; coordinated single shutdown | Create `instrument.ts`; add deps; init Sentry+OTel; **create shared pino logger module**; replace `console.*`; wire workers + SQS extract | Add direct `@opentelemetry/*` deps; extend `instrument.ts` to Mode B; **widen SQS message type**; import instrument in workers; reconcile flush with existing consumer flushes; fix `ecosystem.config.cjs` |

---

## 4. Shared Telemetry Module

**Decision:** Build `@zopkit/platform-sdk/telemetry`. CRM and FA both already depend on `@zopkit/platform-sdk`. **Wrapper does NOT depend on platform-sdk** → wrapper copies the same code inline in its `instrument.ts` (do not introduce a new dependency edge for one file). Keep the two copies behaviourally identical.

**Location:** `/Users/zopkit/Downloads/packages/platform-sdk/src/telemetry/index.ts`, exported via a new `./telemetry` entry in `package.json#exports`.

**platform-sdk module-system caveat (validate, do not assume):** platform-sdk is **CommonJS** (`tsconfig module:CommonJS`, `dist/index.js` is CJS) with **no `@sentry/*` or `@opentelemetry/*` deps today**. Adding them is fine, but **`initTelemetry` must be import-ordered before any instrumented module (`http`, `pg`, `undici`) loads in the consumer.** This holds only if (a) the consumer imports `@zopkit/platform-sdk/telemetry` as the literal first import in its `instrument.ts`, AND (b) **the `./telemetry` subpath entry does NOT transitively pull platform-sdk's own top-level barrel** (`dist/index.js`) — which may import `http`/`pg` first. **Hard requirement:** `./telemetry` must be a leaf module with no import of the package barrel; verify the built `dist/telemetry/index.js` has no `require('../index')`/sibling-barrel edge before Phase 2/3.

### 4.1 OTel version-pinning strategy (MANDATORY — do this before any phase)

`@sentry/node ^10.46.0` (resolving ~10.53.x) **hard-pins** `@opentelemetry/instrumentation-http@0.214.0`, `@opentelemetry/instrumentation@0.214.0`, and `@opentelemetry/sdk-trace-base@^2.6.1`. The wrapper's `@opentelemetry/auto-instrumentations-node@0.76` pulls `instrumentation-http@0.218.x` and `instrumentation-undici@0.28.x`. **Mixing the 0.214 and 0.218 instrumentation lines against one `SentrySpanProcessor` is exactly the drift that silently drops spans or throws on `register()`.** The single coherent OTel graph is the precondition for everything else.

- **`@opentelemetry/core` `overrides:{'^2.0.0'}` in wrapper is a NO-OP today** (core resolves to 2.7.1; `sdk-node@0.218` already depends on core 2.7.1). Removing it changes nothing. The earlier framing that removal is "risky" was **backwards** — there is no risk in removing it, and re-adding it fixes nothing.
- **The real risk is the instrumentation-line mismatch.** Add a workspace-root (and per-app, since these are separate repos) `pnpm.overrides` / `resolutions` block that pins the **entire OTel instrumentation surface to the line Sentry expects (0.214.x)**, OR conversely pin `@sentry/opentelemetry` + `@sentry/node` to a 10.x that ships 0.218 — whichever yields **one** minor across: `@opentelemetry/instrumentation`, `@opentelemetry/instrumentation-http`, `@opentelemetry/instrumentation-undici`, and the `auto-instrumentations-node` set. Concretely (verify exact numbers against the lockfile at pin time):
  ```jsonc
  // each app package.json (wrapper, fa, crm) — separate repos, so repeat per repo
  "pnpm": { "overrides": {
    "@opentelemetry/instrumentation": "0.214.0",
    "@opentelemetry/instrumentation-http": "0.214.0",
    "@opentelemetry/instrumentation-undici": "<the 0.214-line version>",
    "@opentelemetry/sdk-trace-base": "2.6.1",
    "@opentelemetry/sdk-trace-node": "<matching 2.x>",
    "@opentelemetry/core": "2.7.1"
  }}
  ```
- **Acceptance gate (CI):** add a check that `pnpm why @opentelemetry/instrumentation-http` returns exactly **one** version across the tree. A second version fails the build.

**Other peer deps to add to platform-sdk** (matching the pinned line): `@sentry/node@^10.46.0`, `@sentry/opentelemetry@^10` (install explicitly — it is NOT a transitive re-export), `@opentelemetry/api@^1.9`, `@opentelemetry/core`, `@opentelemetry/sdk-trace-node`, `@opentelemetry/sdk-trace-base`, `@opentelemetry/exporter-trace-otlp-http`, `@opentelemetry/auto-instrumentations-node`, `@opentelemetry/instrumentation`.

### 4.2 Module API

```ts
// @zopkit/platform-sdk/telemetry
export interface TelemetryOptions {
  serviceName: string;          // 'crm-backend' | 'fa-backend' | ...
  runtime?: string;             // 'api' | 'sqs-consumer' | 'temporal-worker'
  release?: string;             // SENTRY_RELEASE ?? npm_package_version
}

/** Mode-B bootstrap. NO-OP if neither SENTRY_DSN nor OTEL_EXPORTER_OTLP_ENDPOINT set.
 *  Sentry.init(skipOpenTelemetrySetup) + one NodeTracerProvider with SentrySpanProcessor
 *  + optional BatchSpanProcessor(OTLP). MUST complete registerInstrumentations() SYNCHRONOUSLY
 *  (no top-level await) before the first import of http/pg. Call FIRST. */
export function initTelemetry(opts: TelemetryOptions): { client: ReturnType<typeof Sentry.init> | undefined; shutdown(): Promise<void> };

/** Inject active OTel + Sentry context into an SQS/SNS MessageAttributes map. */
export function injectTraceContext(attrs: Record<string, { DataType: string; StringValue: string }>): void;

/** Extract parent Context from an SQS message's MessageAttributes. */
export function extractTraceContext(attrs: Record<string, { StringValue?: string; Value?: string }> | undefined): Context;

/** Embed active context INTO the business-event object as `_otel` (EventBridge has no native carrier). */
export function injectIntoEventObject<T extends Record<string, unknown>>(event: T): T & { _otel: Record<string,string> };

/** Extract parent Context from the EB envelope as delivered to SQS: pass `body.detail` (the EB Detail object). */
export function extractFromEventBridgeDetail(detail: Record<string, unknown> | undefined): Context;

/** Create an OTel Link to a stored carrier (for outbox replay — link, do NOT naive-reparent). */
export function linkFromCarrier(carrier: Record<string,string> | undefined): Link | undefined;

/** Register process-level Sentry.captureException handlers ONLY (no SIGTERM/flush here — see coordinated shutdown). */
export function installProcessErrorHandlers(): void;

/** Tag the active Sentry scope with tenant_id (multi-tenant filtering, non-PII). */
export function tagTenant(tenantId: string): void;

/** pino mixin: returns { trace_id, span_id } from the active span for log<->trace correlation. */
export function pinoTraceMixin(): Record<string, string>;
```

### 4.3 Core implementation sketch (identical in wrapper's `instrument.ts`)

```ts
import * as Sentry from '@sentry/node';
import { SentrySpanProcessor, SentryPropagator, SentrySampler } from '@sentry/opentelemetry';
import { SentryContextManager } from '@sentry/node';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { CompositePropagator, W3CTraceContextPropagator, W3CBaggagePropagator } from '@opentelemetry/core';
import { trace } from '@opentelemetry/api';

export function initTelemetry({ serviceName, runtime = 'api', release }: TelemetryOptions) {
  const hasDsn = !!process.env.SENTRY_DSN;
  const otlp = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  // HARD KILL-SWITCH: with neither, register NOTHING (no provider, no propagator, no context manager).
  if (!hasDsn && !otlp) return { client: undefined, shutdown: async () => {} };

  const client = Sentry.init({
    dsn: process.env.SENTRY_DSN,
    enabled: hasDsn,
    environment: process.env.NODE_ENV ?? 'development',
    release: process.env.SENTRY_RELEASE ?? release ?? process.env.npm_package_version ?? '1.0.0',
    skipOpenTelemetrySetup: true,                 // ← WE own the provider
    sendDefaultPii: false,
    enableLogs: true,                             // top-level (v10), replaces _experiments
    shutdownTimeout: 3000,
    tracesSampleRate: process.env.NODE_ENV === 'production'
      ? Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1) : 1.0,
    // Path-based drop of probe noise. SentrySampler wraps this tracesSampler; keep ONLY one of
    // tracesSampler / tracesSampleRate semantics — here tracesSampler returns inherit/decision.
    tracesSampler: (ctx) => {
      const path = (ctx.attributes?.['http.target'] ?? ctx.attributes?.['url.path'] ?? '') as string;
      if (/^\/(health|healthz|ready|readyz|livez|metrics)\b/.test(path)) return 0;
      if (ctx.parentSampled !== undefined) return ctx.parentSampled;  // honor edge decision
      return process.env.NODE_ENV === 'production' ? Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1) : 1.0;
    },
    integrations: [
      Sentry.httpIntegration({ spans: false }),   // OTel http instrumentation makes the spans
      // NOTE: do NOT add fastifyIntegration — OTel owns spans; Fastify route spans come from
      // @opentelemetry/instrumentation-fastify in the auto set. setupFastifyErrorHandler stays (errors only).
    ],
    beforeSend(e) { if (e.request?.headers) { delete e.request.headers.authorization; delete e.request.headers.cookie; } return e; },
  });
  if (client) { Sentry.setTag('service', serviceName); Sentry.setTag('runtime', runtime); }

  const spanProcessors: any[] = [];
  if (client) spanProcessors.push(new SentrySpanProcessor());
  if (otlp) spanProcessors.push(new BatchSpanProcessor(
    new OTLPTraceExporter({ url: `${otlp}/v1/traces` }),
    { scheduledDelayMillis: 2000, exportTimeoutMillis: 5000, maxQueueSize: 4096, maxExportBatchSize: 512 },
  ));

  const provider = new NodeTracerProvider({
    sampler: client ? new SentrySampler(client) : undefined,
    spanProcessors,
  });
  // CompositePropagator so inbound peers sending ONLY W3C traceparent are continued,
  // and outbound emits BOTH sentry-trace/baggage AND traceparent.
  provider.register({
    propagator: new CompositePropagator({ propagators: [new SentryPropagator(), new W3CTraceContextPropagator(), new W3CBaggagePropagator()] }),
    contextManager: new SentryContextManager(),
  });

  registerInstrumentations({
    instrumentations: [getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },
      '@opentelemetry/instrumentation-dns': { enabled: false },
      // DECISION: aws-sdk instrumentation does NOT own queue context propagation (we do it manually
      // because SNS uses RAW delivery — see §6). Disable its payload-based SQS extraction to avoid
      // colliding with / duplicating our manual inject/extract and Sentry queue spans.
      '@opentelemetry/instrumentation-aws-sdk': {
        sqsExtractContextPropagationFromPayload: false,
        suppressInternalInstrumentation: false,
      },
    })],
  });

  if (client) Sentry.validateOpenTelemetrySetup();   // dev/staging warns if misconfigured
  // NOTE: NO SIGTERM/SIGINT registration here — shutdown is coordinated by the app (see §8).
  const shutdown = async () => {
    await provider.forceFlush().catch(() => {});      // flush in-flight OTLP batch
    if (client) await Sentry.flush(2000).catch(() => {});
    await provider.shutdown().catch(() => {});
  };
  return { client, shutdown };
}
```

> **ESM/CJS top-level-await hazard (hard requirement):** the rewritten `instrument.ts` uses **static** imports only and `registerInstrumentations()` runs **synchronously** before `initTelemetry` returns. Wrapper's `bootstrap.ts` imports `./instrument.js` synchronously, *then* dynamically `import()`s `app.js` — so as long as instrument has **no remaining top-level `await`**, instrumentation is registered before `http`/`pg` are first loaded by `app.js`. Removing the existing `await import('@opentelemetry/sdk-node')` is therefore mandatory, not cosmetic.

> **W3C emission:** the `CompositePropagator` above emits `traceparent` on outbound HTTP unconditionally, so we do **not** rely on Sentry's `propagateTraceparent` flag. Async seams (SNS/SQS/EventBridge) use explicit `propagation.inject` (§6) regardless of HTTP propagators.

---

## 5. Phased Rollout (dependency order)

### Phase 0 — Prep / version pinning / shared module
- **Pin the OTel graph first (§4.1)** in all three repos; add the CI single-version gate. **Nothing else proceeds until `pnpm why @opentelemetry/instrumentation-http` is one version per repo.**
- **Create** `/Users/zopkit/Downloads/packages/platform-sdk/src/telemetry/index.ts` (API in §4.2). Ensure it is a **leaf module** (no import of the package barrel) and emits trace/baggage context-helpers.
- **Edit** `/Users/zopkit/Downloads/packages/platform-sdk/package.json`: add `./telemetry` to `exports`; add deps from §4.1.
- **Acceptance:** `pnpm --filter @zopkit/platform-sdk build` produces `dist/telemetry/index.js`; `node -e "require('@zopkit/platform-sdk/telemetry')"` resolves WITHOUT pulling `dist/index.js` (verify with `--cpu-prof`/`require` trace or by grepping the built file for sibling-barrel requires).

### Phase 1 — Wrapper reconciliation (fixes the live bug; highest priority)
**Files:**
- **Rewrite** `/Users/zopkit/Downloads/wrapper/backend/src/instrument.ts` → Mode-B single-provider (§4.3 sketch). Delete the `await import('@opentelemetry/sdk-node')` NodeSDK block **and its SIGTERM/SIGINT hooks** (shutdown is centralized in `gracefulShutdown`, §8). Replace `_experiments:{enableLogs:true}` with top-level `enableLogs:true`. Gate the whole body on DSN-or-OTLP.
- **Edit** `/Users/zopkit/Downloads/wrapper/backend/src/app-fastify.ts`: `import { setupFastifyErrorHandler } from '@sentry/node'`; call `setupFastifyErrorHandler(fastify)` right after the Fastify instance is created and **before** route registration. In the `unhandledRejection`/`uncaughtException` handlers (~lines 659/665), call `Sentry.captureException(err)` + `await Sentry.flush(2000)` before `gracefulShutdown()`. **Add `sentry-trace, baggage` to the `allowedHeaders` allowlist (app-fastify.ts:270+)** — it is an explicit allowlist that currently omits them (with `credentials:true` a wildcard is illegal, so they MUST be added explicitly).
- **Edit `gracefulShutdown()`** to the single coordinated sequence (§8): stop intake (close server / stop poller / stop crons) → drain in-flight → end spans → `telemetry.shutdown()` (forceFlush OTLP → Sentry.flush → provider.shutdown) → exit. Pass the `shutdown` handle returned by `initTelemetry` into `gracefulShutdown`.
- **Edit** `/Users/zopkit/Downloads/wrapper/backend/package.json`: add `@sentry/opentelemetry@^10`, `@opentelemetry/sdk-trace-node`, `@opentelemetry/sdk-trace-base`, `@opentelemetry/instrumentation`, `@opentelemetry/core`; **remove the no-op `"overrides": { "@opentelemetry/core": "^2.0.0" }`** (it is already satisfied; removal changes nothing); add the §4.1 `pnpm.overrides` pin block instead.
- **Edit** `/Users/zopkit/Downloads/wrapper/backend/temporal/worker.js`: this worker runs via **`tsx temporal/worker.js`** and is **never compiled to dist**, so `--import ./dist/instrument.js` is impossible and a sibling `.mjs` will not resolve the TS instrument the same way. Instead: make the **first line** of `worker.js` an `import './../src/instrument.js'` (resolved by tsx's `.js`→`.ts` mapping, same as the rest of the worker) OR launch via `tsx --import ../src/instrument.ts temporal/worker.js`. **`initTelemetry()` (hence OTel auto-instrumentation registration) MUST run before `@temporalio/worker` is imported** — enforce by putting the instrument import strictly above the `@temporalio/*` imports. Wrap activity/workflow failures with `Sentry.captureException`; flush via the coordinated shutdown before `worker.shutdown()`.
- **Temporal context across workflow/activity boundary (wrapper):** `@temporalio/worker@1.8` is old; the `@temporalio/interceptors-opentelemetry` version must be matched to 1.8 (verify compat before adding — do not assume latest works). If a compatible interceptor version cannot be confirmed, fall back to manual context carry via workflow memo/headers and a span LINK. Document the chosen path; do not leave it implicit.
- **Edit** crons `src/utils/credit-expiry-manager.ts` (3 schedules) + `src/utils/trial-manager.ts` (4 schedules): wrap each callback in `Sentry.withScope(s => { s.setTag('cron', name); ... })`, `Sentry.captureException(err)` in catch.
- **Edit** `src/features/messaging/services/outbox-poller.ts` + `outbox-replay-worker.ts`: wrap `tick()` in `Sentry.startSpan({ name:'outbox-poller.tick', op:'queue.process' })`, `captureException` in catch. **Outbox replay correctness:** when republishing a stored row, do NOT `context.with(storedContext)` (the captured trace ended long ago / may be unsampled — you'd orphan or mis-parent). Instead start a fresh poller span and attach an **OTel Link** to the stored carrier via `linkFromCarrier(row.message_attributes)` (§4.2). The republished SNS message re-injects the *current* poller span's context as its `traceparent`.
- **Logging trace-correlation (wrapper):** add a pino mixin (`pinoTraceMixin`) to the Fastify pino logger so every line carries `trace_id`/`span_id`; for the two Winston loggers add a format that reads `trace.getActiveSpan()?.spanContext()` and injects `trace_id`/`span_id`. Without this, CloudWatch logs cannot be joined to Tempo/Sentry traces.

**Env:** `OTEL_EXPORTER_OTLP_ENDPOINT`, `SENTRY_TRACES_SAMPLE_RATE`, `SENTRY_RELEASE`.
**Acceptance:** start dev; `Sentry.validateOpenTelemetrySetup()` prints no warnings; `pnpm why @opentelemetry/instrumentation-http` = one version; one HTTP request produces ONE trace in Sentry **and** (if OTLP set) the same trace in Tempo; no "duplicate registration of API"; **Fastify route span present exactly once (no double HTTP span AND no double Fastify route span)**; a log line emitted during the request carries the request's `trace_id`.

### Phase 2 — FA: add OTel to existing Sentry
**Files:**
- **Edit** `/Users/zopkit/Downloads/finance-accounting/server/package.json`: add direct `@opentelemetry/*` deps + `@sentry/opentelemetry@^10` (mirror wrapper set) + the §4.1 pin block.
- **Rewrite** `/Users/zopkit/Downloads/finance-accounting/server/instrument.ts` to Mode B (or call `initTelemetry`). Add `skipOpenTelemetrySetup:true`; set `release`; make `tracesSampleRate` env-driven (was hardcoded `1.0`); add `Sentry.setTag('service','fa-backend')`; add `tracePropagationTargets`. **Do NOT add a missing `enabled`/PII gate — FA already has `enabled: !!SENTRY_DSN`, `sendDefaultPii:false`, and the `requestDataIntegration` (query_string only).** Keep them. **`setupFastifyErrorHandler` is NOT in instrument.ts — it lives in `server/index.ts:52`; the pino→Sentry bridge is in `server/utils/logger.ts`. Do not move or duplicate them.**
- **Edit `server/utils/logger.ts`:** add `trace_id`/`span_id` injection to the pino base/mixin (the logMethod→Sentry bridge stays; correlation is additive).
- **Edit** `server/index.ts`: confirm `import './instrument'` is the first import; add `unhandledRejection`→`captureException`.
- **Edit** `server/scripts/fa-worker.ts` and `scripts/orchestration-worker.ts`: add `import '../instrument';` as the **very first** line; add unhandledRejection/uncaughtException → `captureException` + coordinated flush.
- **Edit** `server/scripts/accounting-sqs-consumer-runner.ts`: it already imports `./instrument` and already calls `Sentry.flush(3000/2000)` at lines 48/52/147. **Reconcile, do not duplicate:** route those existing flushes through the single coordinated shutdown so they don't race independently-registered handlers (§8).

**Env:** `OTEL_EXPORTER_OTLP_ENDPOINT`, `SENTRY_DSN`, `SENTRY_RELEASE`, `SENTRY_TRACES_SAMPLE_RATE`, `OTEL_SERVICE_NAME=fa-backend`.
**Acceptance:** HTTP request → trace in Sentry with pg/http child spans; `fa-worker` appears as a service; no double HTTP/Fastify spans; consumer shutdown flushes once (no double-flush race); FA pino lines carry `trace_id`.

### Phase 3 — CRM: greenfield
**Files:**
- **Edit** `/Users/zopkit/Downloads/b2b-crm/server/package.json`: add `@sentry/node@^10.46.0`, `@sentry/opentelemetry@^10`, all `@opentelemetry/*` (sdk-trace-node, sdk-trace-base, exporter-trace-otlp-http, auto-instrumentations-node, instrumentation, core, api), `@temporalio/interceptors-opentelemetry` (**version matched to CRM's temporal version — verify**), **`pino` as a direct dep**, and the §4.1 pin block.
- **Create** `/Users/zopkit/Downloads/b2b-crm/server/src/lib/logger.ts`: a shared pino instance with the `pinoTraceMixin` (`trace_id`/`span_id`). This module does not exist today; the SQS consumer and workers will import it.
- **Create** `/Users/zopkit/Downloads/b2b-crm/server/src/instrument.ts`: `initTelemetry({ serviceName:'crm-backend' })` from `@zopkit/platform-sdk/telemetry`.
- **Edit** `/Users/zopkit/Downloads/b2b-crm/server/src/server.ts`: `import './instrument'` as **first line** (before `dotenv/config`); add `process.on` handlers → `captureException`; route shutdown through coordinated sequence.
- **Edit** `/Users/zopkit/Downloads/b2b-crm/server/src/app.ts`: change `Fastify({ logger: true })` → use the shared pino logger; call `Sentry.setupFastifyErrorHandler(app)`; in `setErrorHandler`, `Sentry.captureException(err)` for 5xx only (skip 4xx AppError/ZodError). **Add `sentry-trace, baggage` to the CORS `allowedHeaders` registered in `app.ts:85`** (explicit list today; with `credentials:true` they must be added explicitly).
- **Edit** `scripts/crm-worker.ts` + `scripts/orchestration-worker.ts`: `import '../instrument'` first; wire Temporal OTel interceptors (version-matched); replace `console.*` with the shared pino logger.
- **Edit** `src/scheduled/sqs-consumer.ts`: replace `console.*` with the shared pino logger; widen `handleMessage` to read `MessageAttributes`; trace-extract (Phase 4).

**Env:** `SENTRY_DSN`, `SENTRY_RELEASE`, `SENTRY_TRACES_SAMPLE_RATE`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_SERVICE_NAME=crm-backend`.
**Acceptance:** CRM HTTP request in Sentry; uncaught rejection captured; worker processes report; consumer/worker logs are pino with `trace_id`.

### Phase 4 — Cross-service propagation (depends on 1–3)
**Files (publish/inject):**
- `/Users/zopkit/Downloads/wrapper/backend/src/features/messaging/utils/sns-sqs-publisher.ts` — in `enqueueEvent()` call `injectTraceContext(messageAttributes)` **before** both the `PublishCommand` and the outbox `INSERT` (so the stored `message_attributes` JSON carries `traceparent`). Repeat in `publishBroadcast()` and `publishOutboxRow()`. (Outbox poller uses LINK semantics on replay — Phase 1.)
- `/Users/zopkit/Downloads/packages/platform-sdk/src/events/publisher.ts` — `publishDirect()` does `Detail: JSON.stringify(event)` on a typed `BusinessEvent<T>` (there is **no separate `detail` arg**). Use **`injectIntoEventObject(event)`** to attach `event._otel` before `JSON.stringify`. Because this pollutes the typed payload, add `_otel?: Record<string,string>` to the `BusinessEvent<T>` envelope type (NOT to the inner `payload`/`data`), so the schema stays valid and consumers can strip it.

**Files (consume/extract):**
- wrapper `src/features/messaging/services/sqs-consumer.ts` `processMessage()` — `const ctx = extractTraceContext(msg.MessageAttributes); context.with(ctx, () => handleEventByType(...))`.
- CRM `src/scheduled/sqs-consumer.ts` `handleMessage()` — widen type to include `MessageAttributes`; same extract → `context.with` around dispatch.
- FA `server/features/messaging/services/sqs-consumer-service.ts` `handleMessage()` — **widen the typed message param to carry `MessageAttributes`** (it has no such field today); add `MessageAttributeNames` to `ReceiveMessageCommand`. **Request `['All']` ONLY** (do not also list specific names — in some SDK versions `'All'` is mutually exclusive with named attributes). Also add `traceparent`/`tracestate` are covered by `'All'`. Extract → wrap `dbCircuitBreaker.execute`. Covers both queue instances.
- **EventBridge extract point (corrected):** EventBridge→SQS delivers the **full EB envelope** as the SQS body, so the carrier is at **`JSON.parse(msg.Body).detail._otel`**, NOT `body._otel` and NOT `event.detail._otel` after the business parser. The FA/CRM consumers run `parseMessage(msg.Body)`/`parseEventPayload` which return the **inner business event** (likely stripping `_otel`). **Extract MUST run on the raw `msg.Body` BEFORE the business parser:** `const ebDetail = JSON.parse(msg.Body).detail; const ctx = extractFromEventBridgeDetail(ebDetail); context.with(ctx, () => parseAndHandle(...))`. Confirm whether EB delivery here is raw or enveloped per target config; the inject side embeds `_otel` in the event regardless so both shapes are covered.
- FA `server/features/integrations/routes/wrapper-sync.routes.ts` DLQ replay `SendMessageCommand` — `injectTraceContext` (link semantics if replaying old rows).

**SNS delivery reality (corrected — this changes the whole rationale):** the IaC at `/Users/zopkit/Downloads/wrapper/deploy/terraform/messaging.tf` (lines 85 & 100) sets **`raw_message_delivery = true`** on both subscriptions. With **raw** delivery there is **no SNS JSON envelope** in the SQS body — so `sqsExtractContextPropagationFromPayload` would parse nothing (it is **dead config**, which is why it's disabled in §4.3) and there is **no auto-extraction safety net**. **Manual inject→MessageAttributes on publish + manual extract from MessageAttributes on consume is MANDATORY, not optional.** SNS *does* forward MessageAttributes to SQS under raw delivery, so `traceparent` in MessageAttributes survives; the body does not carry it.

**HTTP:** Auto-instrumentation handles FA→wrapper axios (`wrapper-api-service.ts`), CRM→FA fetch (`fa-client.ts`), CRM→wrapper (`reconcile-wrapper-credits.ts`) once each service's OTel is live AND the peer origin is in `tracePropagationTargets`. No manual injection needed.
**Acceptance:** publish from wrapper → consume in CRM and FA shows a single connected trace (parent span = wrapper publish); EB event → downstream consumer linked via `body.detail._otel`; round-trip unit test of `injectTraceContext`/`extractTraceContext` (§10 testing).

### Phase 5 — Frontends
**First step (hard gate):** `grep -n "server.*port\|port:" */vite.config.ts` in all three FE repos and record the **actual** dev ports + the real prod origins. The §2 placeholder ports (and the contradictory `3000/4000/3002` values from the earlier draft — note `3002` is the **FA backend** port per project memory, NOT a FE) are **not authoritative**. `tracePropagationTargets` regexes are built from the **verified** origins only.

For each FE: add `@sentry/react@^8` (dep) + `@sentry/vite-plugin@^3` (devDep); create/extend `instrument.ts` imported first in `main.tsx`; set `dsn: import.meta.env.VITE_SENTRY_DSN`, router integration, `replayIntegration`, `tracePropagationTargets` (verified origins), `tunnel:'/tunnel'`; `vite.config.ts` → `build.sourcemap:'hidden'` + `sentryVitePlugin(...)` **last** in plugins; add `VITE_SENTRY_DSN` to `.env.example`.
- **wrapper** `frontend/src/main.tsx` + `frontend/src/errors/ErrorBoundary.tsx` (`Sentry.captureException` in `componentDidCatch`) + `frontend/vite.config.ts`. `Sentry.tanstackRouterBrowserTracingIntegration(router)`.
- **b2b-crm** `src/main.tsx` (add `Sentry.ErrorBoundary` — none today) + `src/App.tsx` (`reactRouterV6BrowserTracingIntegration`) + `vite.config.ts`.
- **finance-accounting** `src/main.tsx` (add `Sentry.ErrorBoundary`) + `src/routes/__root.tsx` + `vite.config.ts` (`sourcemap`→`'hidden'`). `tanstackRouterBrowserTracingIntegration(router)`.

**Backend support — two DISTINCT mechanisms (do not conflate):**
1. **`/tunnel` route** (one per backend): receives the raw Sentry **envelope** body. It (a) **streams the raw body without JSON-parsing** (the envelope is newline-delimited, not JSON — parsing corrupts it), (b) **preserves `Content-Type`** (`application/x-sentry-envelope`), (c) parses ONLY the envelope header's `dsn` to validate `host === <your-sentry-host>` AND project id ∈ allowlist (**strict** host check — a loose check + `@fastify/cors credentials:true` makes this an open relay / SSRF vector), (d) **rate-limits** per-IP, (e) forwards to the real Sentry ingest URL. The tunnel **bypasses CORS entirely** (same-origin POST), so the `sentry-trace`/`baggage` CORS-header fix is **NOT** for the tunnel.
2. **CORS `allowedHeaders` fix** is **only** for the **direct** FE→BE API calls that carry `sentry-trace`/`baggage` for trace continuation. Add `sentry-trace, baggage` to each backend's explicit allowlist (wrapper app-fastify.ts:270+; CRM app.ts:85; **FA's CORS is in `registerCorePlugins`, not `index.ts` — locate its actual `allowedHeaders` there**). With `credentials:true` a wildcard is illegal → add explicitly.

**Acceptance:** a FE error → Sentry issue with mapped sourcemaps; a FE→backend direct API call → one trace spanning browser pageload + backend (proves the verified `tracePropagationTargets` and the CORS header fix); envelopes flow through `/tunnel` even with an ad-blocker active; tunnel rejects a forged DSN host.

### Phase 6 — Collector / infra
**Files:**
- **Create** the **two-tier** collector (§8): a **DaemonSet agent** (node-local, `:4318`, batch only, forwards to gateway) and a **Gateway** split into an **LB tier** (`loadbalancingexporter routing_key: traceID`) → a **separate tail-sampling Deployment** (so traceID affinity actually holds) → `redaction` → `otlphttp/sentry-*` + `otlp/tempo`.
- **Edit** `/Users/zopkit/Downloads/wrapper/deploy/terraform/secrets.tf`: add `SENTRY_DSN` to crm + fa secret key lists; add `SENTRY_TRACES_SAMPLE_RATE`, `SENTRY_RELEASE` to all three. **`OTEL_EXPORTER_OTLP_ENDPOINT` points apps at the node-local AGENT (e.g. `http://$(NODE_IP):4318`), NOT the gateway svc** (the agent tier is pointless if apps skip it).
- **Edit** `/Users/zopkit/Downloads/wrapper/deploy/terraform/outputs.tf`: ConfigMap per-app `OTEL_SERVICE_NAME`, `OTEL_RESOURCE_ATTRIBUTES`; inject `NODE_IP` via downward API for the agent endpoint.
- **Edit** `/Users/zopkit/Downloads/wrapper/deploy/.github/workflows/deploy.yml`: `--set env.SENTRY_RELEASE=$GITHUB_SHA` and `OTEL_RESOURCE_ATTRIBUTES=service.version=$GITHUB_SHA,deployment.environment=production`.
- **Worker `--import` ordering:** FA/CRM **compiled** workers that bypass the web entry must prepend `--import ./dist/instrument.js`. **The wrapper Temporal worker is the exception — it runs under `tsx` and is never compiled to dist (§3), so it uses the in-file `import '../src/instrument.js'` (tsx-resolved) or `tsx --import`, NOT `--import ./dist/...`.**
- **Edit** `/Users/zopkit/Downloads/wrapper/deploy/helm/zopkit-backend/values-fa.yaml`: `workers[0].command` → `['node','--import','./dist/instrument.js','dist/scripts/accounting-sqs-consumer-runner.js']`.
- **Edit** `/Users/zopkit/Downloads/finance-accounting/ecosystem.config.cjs`: add `NODE_OPTIONS:'--import=./server/dist/instrument.js'` to both apps; **fix stale path** `accounting-amazon-mq-consumer-runner.js` → `scripts/accounting-sqs-consumer-runner.js`.
**Acceptance:** in EKS, all three services + all worker pods emit traces; agent→gateway→fan-out visible in collector logs; `pnpm why @opentelemetry/instrumentation-http` one version in the built image; `terminationGracePeriodSeconds: 60` lets spans flush on rollout.

---

## 6. Cross-Service Distributed Tracing

**Propagation model:** W3C `traceparent`/`tracestate` carriers on **every** async seam (manual inject/extract — never relying on transport auto-extraction); `sentry-trace`/`baggage` ride along via the `CompositePropagator`. Parent-child for single-origin queues; **span LINKS** for fan-in and for **outbox replay** (stored context is stale).

**SNS publish (wrapper) — inject (MANDATORY; raw delivery means no other path works):**
```ts
import { context, propagation } from '@opentelemetry/api';
function injectTraceContext(attrs: Record<string,{DataType:string;StringValue:string}>) {
  propagation.inject(context.active(), attrs, {
    set(c, k, v) { c[k] = { DataType: 'String', StringValue: v }; },  // writes traceparent + baggage
  });
}
// enqueueEvent(): build messageAttributes → injectTraceContext(messageAttributes) →
// PublishCommand AND store messageAttributes in inter_app_outbox.message_attributes.
```
> **SNS is `raw_message_delivery = true`** (`messaging.tf:85,100`). No SNS JSON envelope reaches SQS, so `sqsExtractContextPropagationFromPayload` finds nothing and is **disabled** (§4.3). SNS **does** forward `MessageAttributes` under raw delivery, so `traceparent` placed in MessageAttributes survives to the SQS consumer. Manual extract is the **only** working mechanism.

**SQS consume — extract:**
```ts
function extractTraceContext(attrs?: Record<string,{StringValue?:string;Value?:string}>) {
  return propagation.extract(context.active(), attrs ?? {}, {
    get: (c, k) => c?.[k]?.StringValue ?? c?.[k]?.Value,
    keys: (c) => Object.keys(c ?? {}),
  });
}
// per consumer: const ctx = extractTraceContext(msg.MessageAttributes);
//   await context.with(ctx, () => tracer.startActiveSpan(`${queue} process`, {kind:SpanKind.CONSUMER}, async s => { try{ await handle(...) } finally{ s.end() }}));
// ReceiveMessageCommand: request MessageAttributeNames:['All'] ONLY (no specific-name list alongside 'All').
// FA: also widen the typed message param to include MessageAttributes (absent today).
```

**EventBridge (no native carrier; X-Ray `TraceHeader` is mutated by the bus — do not use it):**
```ts
// publish (platform-sdk publishDirect — embeds in the typed envelope, NOT a separate detail arg):
const evtWithCtx = injectIntoEventObject(event);            // event._otel = { traceparent, baggage, ... }
// PutEventsCommand Entries[].Detail = JSON.stringify(evtWithCtx)
// consume — EB→SQS delivers the FULL envelope; carrier is at body.detail._otel, BEFORE the business parser:
const body = JSON.parse(msg.Body);                          // raw EB envelope (or the event if raw target)
const ebDetail = body.detail ?? body;                       // tolerate both shapes
const ctx = extractFromEventBridgeDetail(ebDetail);         // reads ebDetail._otel
context.with(ctx, () => { const businessEvent = parseEventPayload(body); handle(businessEvent); });
```
> The business parsers (`parseMessage`/`parseEventPayload`) return the inner event and may strip `_otel`; therefore **extract before parsing**. `_otel` is typed on the `BusinessEvent<T>` envelope (not the inner payload) so schema validation passes and the consumer can drop it post-extract.

**Outbox replay (LINK, not re-parent):**
```ts
// poller tick republishing a stored row:
const link = linkFromCarrier(row.message_attributes);       // Link to the original (ended) trace
tracer.startActiveSpan('outbox.republish', { links: link ? [link] : [] }, s => {
  const attrs = {}; injectTraceContext(attrs);              // inject the CURRENT span's context
  // ...PublishCommand with attrs...  (do NOT context.with(storedContext))
  s.end();
});
```

**HTTP:** auto-instrumentation injects on outbound axios/fetch once both ends have OTel live and the peer origin is in `tracePropagationTargets`. Inbound continuation works because the `CompositePropagator` registers **both** SentryPropagator and `W3CTraceContextPropagator` — a peer sending only `traceparent` is still continued.

**Frontend→backend CORS allowlist** (direct API calls only — NOT the tunnel): add `sentry-trace, baggage` to each backend's explicit `allowedHeaders` (wrapper app-fastify.ts:270+, CRM app.ts:85, FA `registerCorePlugins`). These are non-simple headers → preflight; if omitted, the browser aborts the request and FE→BE trace continuation silently breaks.

---

## 7. Env Var Contract

| Var | wrapper | crm | fa | Example / Notes |
|---|---|---|---|---|
| `SENTRY_DSN` | ✅ | ➕ add | ✅ | `https://<key>@oNNN.ingest.<REGION>.sentry.io/<proj>` (secret; REGION per §9 residency) |
| `SENTRY_RELEASE` | ➕ | ➕ | ➕ | `$GITHUB_SHA` injected at Helm deploy |
| `SENTRY_TRACES_SAMPLE_RATE` | ✅ | ➕ | ➕ | `0.1` prod / `1.0` dev (one head decision; also governs Tempo egress) |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | ✅ | ➕ | ➕ | **node-local agent**: `http://$(NODE_IP):4318` (downward-API), NOT the gateway svc |
| `OTEL_EXPORTER_OTLP_HEADERS` | opt | opt | opt | only if exporting direct to a managed backend (normally the gateway holds creds) |
| `OTEL_SERVICE_NAME` | `wrapper-backend` | `crm-backend` | `fa-backend` | ConfigMap (non-secret) |
| `OTEL_RESOURCE_ATTRIBUTES` | ➕ | ➕ | ➕ | `service.version=$SHA,deployment.environment=production` |
| `OTEL_PROPAGATORS` | opt | opt | opt | left default; propagators set in-code via CompositePropagator |
| `NODE_ENV` | ✅ | ✅ | ✅ | drives sample rate |
| `LOG_LEVEL` | ✅ | ✅ | ✅ | `info` prod |
| `RUNTIME` | opt | opt | opt | `api`/`sqs-consumer`/`temporal-worker` → Sentry tag |
| **Frontends** | | | | |
| `VITE_SENTRY_DSN` | ➕ | ➕ | ➕ | separate FE project DSN |
| `SENTRY_AUTH_TOKEN` | ➕ CI | ➕ CI | ➕ CI | sourcemap upload (CI secret, never committed) |
| `SENTRY_ORG` / `SENTRY_PROJECT` | ➕ CI | ➕ CI | ➕ CI | vite plugin |
| `VITE_APP_VERSION` | ✅ exists | ➕ | ➕ | release = git SHA; must match plugin release |

---

## 8. Infra / Deploy

**Collector decision: two-tier OTel Collector — DaemonSet AGENT (node-local) → Gateway, and the Gateway is itself split LB-tier → tail-sampling-tier.** Chosen over SDK-direct because we need batching, retry, **tail sampling**, **PII redaction at the edge**, fan-out (Sentry + Tempo), and centralized egress credentials.

- **Agent (DaemonSet):** OTLP receiver `:4318`, `batch`, OTLP exporter → gateway LB svc. Resource limits e.g. `requests: {cpu:100m, mem:128Mi}`, `limits:{cpu:500m, mem:256Mi}`. Apps point `OTEL_EXPORTER_OTLP_ENDPOINT` at this node-local agent (downward-API `NODE_IP`).
- **Gateway LB tier (Deployment):** `loadbalancingexporter` with `routing_key: traceID`, fanning to the tail-sampling tier by trace. **This separate tier is REQUIRED for traceID affinity** — a single 2-replica tail-sampling Deployment without an LB tier in front does NOT achieve affinity (spans of one trace land on different replicas, breaking tail decisions).
- **Gateway tail-sampling tier (separate Deployment, 2+ replicas + HPA):**
```yaml
processors:
  tail_sampling:
    decision_wait: 120s          # raised from 30s: SQS consumers can emit child spans MINUTES later;
                                 # late spans after decision_wait are dropped → incomplete traces.
                                 # 120s is a compromise; truly long async flows accept some incompleteness.
    policies:
      - { name: errors,  type: status_code, status_code: { status_codes: [ERROR] } }
      - { name: slow,    type: latency,     latency: { threshold_ms: 2000 } }
      - { name: sample,  type: probabilistic, probabilistic: { sampling_percentage: 10 } }
  redaction: { allow_all_keys: true, blocked_key_patterns: [".*[Aa]uthorization.*",".*[Cc]ookie.*",".*[Tt]oken.*",".*[Pp]assword.*",".*[Ss]ecret.*"] }
  batch: { send_batch_size: 1000, timeout: 5s }
exporters:
  otlphttp/sentry-wrapper: { traces_endpoint: "https://oNNN.ingest.<REGION>.sentry.io/api/<PROJ>/integration/otlp/v1/traces", headers: { x-sentry-auth: "sentry sentry_key=${KEY}" }, compression: gzip }
  otlp/tempo: { endpoint: "http://tempo.observability.svc:4317", tls: { insecure: true } }
connectors:
  routing: { default_pipelines: [traces/sentry-wrapper], table: [ { statement: 'route() where attributes["service.name"] == "fa-backend"', pipelines: [traces/sentry-fa] } ] }
```
> **Late-span caveat:** even at `decision_wait: 120s`, async flows whose consumer spans arrive after the window will produce **incomplete traces** in the tail-sampled output. Document this; the SDK-direct Sentry egress (not tail-sampled) still captures the full per-service spans, so cross-referencing remains possible.

**`--import`/`--require` ordering (critical):**
- wrapper web (`node dist/bootstrap.js`): bootstrap statically imports `./instrument.js` first → OK.
- **wrapper Temporal worker: `tsx temporal/worker.js`; NOT compiled to dist** → instrument via in-file first-line `import '../src/instrument.js'` (tsx-resolved) or `tsx --import ../src/instrument.ts`. **`--import ./dist/instrument.js` is impossible here.**
- FA web (`node dist/index.js`): index.ts imports `./instrument` first → OK.
- CRM web (`node dist/server.js`): server.ts imports `./instrument` first → OK.
- **Compiled worker processes that bypass the web entry** (FA SQS consumer worker, FA/CRM workers, ecosystem.config.cjs apps) → prepend `--import ./dist/instrument.js`.

**Single coordinated shutdown (replaces all independently-registered handlers):** the app — NOT `initTelemetry` — owns ONE `SIGTERM`/`SIGINT` handler that runs the sequence **in order**: **(1) stop intake** (close HTTP server, stop SQS polling, stop crons/poller) → **(2) drain in-flight** (await active handlers) → **(3) end open spans** → **(4) `provider.forceFlush()`** (await; BatchSpanProcessor default 5s delay means recent spans won't export otherwise — `scheduledDelayMillis:2000` set in §4.3) → **(5) `Sentry.flush(2000)`** (await) → **(6) `provider.shutdown()`** (await) → exit. `initTelemetry` returns the `shutdown` handle and registers **no** signal handlers itself. This eliminates the race between the old NodeSDK hooks, wrapper's `gracefulShutdown`, and FA's three existing `Sentry.flush()` calls (which are rewired to call the shared shutdown). Reconcile timings: `flush(2000)` < `shutdownTimeout:3000` < `preStop: sleep 5` < `terminationGracePeriodSeconds: 60`.

**Secrets/ESO:** add `SENTRY_DSN` to CRM + FA key lists; add `OTEL_EXPORTER_OTLP_ENDPOINT` (agent) to all three. Fluent Bit DaemonSet remains the stdout→CloudWatch path; with the pino/Winston `trace_id` mixin (§5), CloudWatch logs join to traces by `trace_id`.

---

## 9. Sampling, PII Scrubbing, Multi-tenancy, Data Residency

**Sampling (ONE decision point — `SentrySampler`):** prod head rate `0.1` via `SENTRY_TRACES_SAMPLE_RATE`; dev `1.0`. The `SentrySampler` governs **both** the SentrySpanProcessor and the OTLP BatchSpanProcessor — **a span dropped for Sentry is dropped for Tempo too.** **Therefore Tempo is NOT a 100%-retention sink under this wiring; it receives the SAME ~10% as Sentry.** This resolves the §2 "retention/fan-out" wording: Tempo's value here is longer *retention of the sampled subset* + queryability, not full capture. If true 100% Tempo capture is later required, run `tracesSampleRate:1` + suppress un-sampled transactions for the Sentry egress server-side (`beforeSendTransaction`) — explicitly deferred. Tail sampling (errors-always, latency>2s, 10% baseline) runs in the gateway. Probe noise (`/health`, `/healthz`, `/ready`, `/readyz`, `/livez`, `/metrics`) is dropped in the `tracesSampler` (§4.3) which `SentrySampler` wraps; `parentSampled` is honored so the fleet respects the edge decision.

**SQS empty-receive poll-span suppression (cost):** `getNodeAutoInstrumentations` + aws-sdk instrumentation will create a span for **every** `ReceiveMessage` poll, including empty long-poll returns — across 3 services × N workers polling every few seconds this **dominates** baseline volume. Suppress: set the consumer poll wrapped in `context.with(suppressTracing(context.active()), …)` for the `ReceiveMessage` call, or filter `messaging.operation == receive` with empty result in the collector. Enable **Spike Protection** per project as a backstop. (Rough order-of-magnitude: a 2s poll loop = ~43k spans/day/worker if unsuppressed — must be suppressed.)

**PII scrubbing — three layers:**
1. **SDK** `beforeSend`: strip `authorization`, `cookie`, `x-api-key`; `sendDefaultPii:false` everywhere (FA already does this; replicate FA's `requestDataIntegration` with bodies/headers/cookies off, query_string only, in wrapper + CRM for financial-grade safety).
2. **Collector** `redaction` (traces) + `attributes/delete` (for any future logs/metrics, since `redaction` is traces-only) with the §8 key patterns.
3. **Sentry server-side** Advanced Data Scrubbing on `$request.headers.Authorization`, `$request.cookies`, `$user.ip_address`.

**Multi-tenancy:** `tagTenant(tenantId)` (= `Sentry.setTag('tenant_id', tenantId)`) in each service's auth/context middleware and per-message in each SQS consumer scope. `tenant_id` is a **tag** (filterable) — never a PII carrier. Per-namespace Sentry **Environments** isolate quotas.

**Data residency (financial — FA especially):** the DSN/collector region MUST be chosen deliberately. If any FA tenant is EU-regulated, use the **EU Sentry region** (`ingest.de.sentry.io`) for the FA project (and possibly wrapper), NOT US, and point the collector `otlphttp/sentry-fa` exporter at the EU ingest host. **`query_string` capture is enabled in FA's `requestDataIntegration` — audit that query strings cannot carry regulated identifiers (account numbers, tax IDs); if they can, disable `query_string` too.** `tenant_id` tagging must use opaque UUIDs, never names/emails. Document the chosen region per project before go-live.

---

## 10. Risks, Rollback, Verification, and Deferred Scope

**Risks & mitigations:**
| Risk | Mitigation |
|---|---|
| **OTel instrumentation version drift (0.214 vs 0.218) silently drops spans / throws on register** | §4.1 pin block in all three repos + CI `pnpm why @opentelemetry/instrumentation-http` = one-version gate (the real version risk) |
| Mode-B mis-wiring → "duplicate registration of API" / lost spans | `Sentry.validateOpenTelemetrySetup()` gates dev/staging; Phase 1 isolated & reversible |
| Removing wrapper `overrides` | **No risk** — it is a no-op (core already 2.7.1); removal changes nothing |
| Duplicate HTTP **and Fastify route** spans | `httpIntegration({spans:false})`, do NOT add `fastifyIntegration`; rely on OTel `instrumentation-fastify`; acceptance checks both layers |
| SNS raw delivery → no auto trace extraction | Manual inject/extract is MANDATORY (§6); aws-sdk payload extraction disabled |
| EventBridge extract at wrong level | Extract from raw `body.detail._otel` BEFORE the business parser (§6) |
| Temporal worker can't load dist instrument (tsx-only) | In-file `import '../src/instrument.js'` before `@temporalio/*`; never `--import ./dist` |
| Temporal 1.8 + interceptor-opentelemetry version mismatch | Verify compat before adding; else manual memo/header carry + LINK |
| Outbox replay orphans stale trace | LINK from poller span to stored carrier; inject CURRENT context on republish (§6) |
| SQS empty-poll spans dominate volume/cost | Suppress `ReceiveMessage` tracing + Spike Protection (§9) |
| Independently-registered shutdown handlers race / premature `provider.shutdown()` | ONE app-owned coordinated shutdown sequence (§8); FA's 3 existing flushes rewired |
| `tracePropagationTargets` regex misses real FE origin → silent break | Verify each `vite.config.ts` port first (Phase 5 hard gate) |
| Tunnel as open relay / SSRF | Strict DSN host + project allowlist, per-IP rate-limit, stream raw body (§5) |
| CORS preflight aborts FE→BE | Add `sentry-trace, baggage` to each backend's explicit allowlist (§6) |
| platform-sdk `./telemetry` pulls barrel → http loaded before instrument | Leaf module; verify built output has no barrel require (§4) |
| FE sourcemaps exposed | `build.sourcemap:'hidden'` + `filesToDeleteAfterUpload` |
| Data residency leak (FA) | EU region for regulated tenants; audit `query_string` (§9) |

**Rollback:** every change is env-gated. **True kill-switch:** unset BOTH `SENTRY_DSN` and `OTEL_EXPORTER_OTLP_ENDPOINT` → `initTelemetry` registers **nothing** (no provider/propagator/context-manager) — full no-op. Unset only `OTEL_EXPORTER_OTLP_ENDPOINT` → Sentry-only (provider still registered for Sentry). Revert order is reverse of phases; Phase 1 is a self-contained commit revertible without touching CRM/FA.

**Coexistence window (phased multi-week rollout):** while wrapper is on Mode B but CRM/FA are not yet emitting OTel, cross-service traces will be **single-service / partial** — a wrapper publish span will have no child consumer span until that consumer ships. This is expected, not a bug. Dashboards must tolerate single-service traces during the window; do not alert on "missing downstream span" until all three are live. The `CompositePropagator` ensures that as each service comes online, continuation begins working without re-deploying the others.

**Testing strategy (beyond manual acceptance):**
- **Unit:** round-trip tests for `injectTraceContext`/`extractTraceContext` (SQS attrs), `injectIntoEventObject`/`extractFromEventBridgeDetail` (EB `body.detail._otel`), and `linkFromCarrier`.
- **PII unit:** assert `beforeSend` strips `authorization`/`cookie`/`x-api-key` and that no request body is present.
- **Contract (CI, localstack):** publish an inter-app event from wrapper → assert the SQS message carries `traceparent` in MessageAttributes and the consumer reconstructs the same trace id (connected trace). Optionally assert collector receives spans for the trace.
- **Version gate (CI):** `pnpm why @opentelemetry/instrumentation-http` returns exactly one version.

**Verification checklist (end-to-end):**
1. Wrapper boots with no "duplicate registration"; `validateOpenTelemetrySetup()` clean; one-version OTel gate passes.
2. One `GET /api/...` → exactly one trace in Sentry AND same trace id in Tempo (if collector configured); HTTP span has child pg span; **no duplicate HTTP span; no duplicate Fastify route span**.
3. Each of wrapper/crm/fa appears as its own `service` in Sentry with correct tag.
4. Killing a Temporal activity / throwing in an SQS handler → exception in Sentry with correct `runtime` tag.
5. Publish inter-app event from wrapper → CRM & FA consumer spans are children/links of the wrapper publish span (single trace id).
6. EB business event → downstream SQS consumer span linked via `body.detail._otel.traceparent`.
7. FA→wrapper axios → both ends share one trace id (verifies `tracePropagationTargets` + CompositePropagator inbound continuation).
8. FE direct API call → one trace spanning browser pageload + backend; route-change transaction named by route pattern.
9. FE error → Sentry issue with **mapped** stack frames (release matches vite plugin upload).
10. No `authorization`/`cookie` headers, no request bodies, in any Sentry event (beforeSend + collector redaction).
11. `kubectl rollout restart` → no lost spans for in-flight requests (coordinated shutdown + forceFlush).
12. Prod: ~10% transaction volume + 100% of error/slow traces via tail sampling; empty-poll spans absent (suppression working).
13. A log line during a request carries the request's `trace_id`/`span_id` (log↔trace join works in CloudWatch and Tempo).
14. Tunnel rejects a forged DSN host and is rate-limited; ad-blocker does not block envelopes.

**Deferred / out of scope (named explicitly so a follow-up can scope them):**
- **OTel metrics pipeline** and **continuous profiling (`@sentry/profiling-node`)** — not in this iteration; collector laid out to add a metrics pipeline later. RED/USE dashboards deferred with metrics.
- **SLOs & alerting:** Sentry alert rules, error-rate/latency SLOs, and tie-in to existing DLQ monitors (`dlq-monitor-service.ts` / `dlq-monitor.job.ts`) and queue-depth alerts — deferred; recommended as the immediate next iteration.
- **Sentry Cron Monitoring:** monitor slugs/schedules for wrapper crons and FA/CRM scheduled jobs (`billing-rollup.job.ts`, `quota-warning.job.ts`) — `captureCheckIn` wiring left as a follow-up (error capture for crons IS in scope, see Phase 1).
- **True 100% Tempo retention** (independent sampler for the OTLP egress) — deferred; current wiring is unified-sample by design (§9).

**Key files (absolute):** shared module `/Users/zopkit/Downloads/packages/platform-sdk/src/telemetry/index.ts`; wrapper `/Users/zopkit/Downloads/wrapper/backend/src/instrument.ts`, `/Users/zopkit/Downloads/wrapper/backend/src/app-fastify.ts`, `/Users/zopkit/Downloads/wrapper/backend/temporal/worker.js`, `/Users/zopkit/Downloads/wrapper/backend/src/features/messaging/utils/sns-sqs-publisher.ts`, `/Users/zopkit/Downloads/wrapper/backend/src/features/messaging/services/sqs-consumer.ts`, `/Users/zopkit/Downloads/wrapper/backend/src/features/messaging/services/outbox-poller.ts`; FA `/Users/zopkit/Downloads/finance-accounting/server/instrument.ts`, `/Users/zopkit/Downloads/finance-accounting/server/index.ts`, `/Users/zopkit/Downloads/finance-accounting/server/utils/logger.ts`, `/Users/zopkit/Downloads/finance-accounting/server/scripts/fa-worker.ts`, `/Users/zopkit/Downloads/finance-accounting/server/scripts/orchestration-worker.ts`, `/Users/zopkit/Downloads/finance-accounting/server/scripts/accounting-sqs-consumer-runner.ts`, `/Users/zopkit/Downloads/finance-accounting/server/features/messaging/services/sqs-consumer-service.ts`, `/Users/zopkit/Downloads/finance-accounting/ecosystem.config.cjs`; CRM `/Users/zopkit/Downloads/b2b-crm/server/src/instrument.ts` (new), `/Users/zopkit/Downloads/b2b-crm/server/src/lib/logger.ts` (new), `/Users/zopkit/Downloads/b2b-crm/server/src/server.ts`, `/Users/zopkit/Downloads/b2b-crm/server/src/app.ts`, `/Users/zopkit/Downloads/b2b-crm/server/src/scheduled/sqs-consumer.ts`, `/Users/zopkit/Downloads/b2b-crm/server/src/scripts/crm-worker.ts`; platform-sdk `/Users/zopkit/Downloads/packages/platform-sdk/src/events/publisher.ts`; FEs `/Users/zopkit/Downloads/wrapper/frontend/src/main.tsx`, `/Users/zopkit/Downloads/b2b-crm/src/main.tsx`, `/Users/zopkit/Downloads/finance-accounting/src/main.tsx` (+ each `vite.config.ts`); infra `/Users/zopkit/Downloads/wrapper/deploy/terraform/secrets.tf`, `/Users/zopkit/Downloads/wrapper/deploy/terraform/outputs.tf`, `/Users/zopkit/Downloads/wrapper/deploy/.github/workflows/deploy.yml`, `/Users/zopkit/Downloads/wrapper/deploy/helm/zopkit-backend/values-fa.yaml`, `/Users/zopkit/Downloads/wrapper/deploy/terraform/messaging.tf` (raw_message_delivery reference).