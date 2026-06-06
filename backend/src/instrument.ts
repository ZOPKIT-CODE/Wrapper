/* eslint-disable no-console */
import 'dotenv/config';
import * as Sentry from '@sentry/node';
import { BatchSpanProcessor, type SpanProcessor } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';
import { AwsInstrumentation } from '@opentelemetry/instrumentation-aws-sdk';

/**
 * Telemetry bootstrap. MUST be the first import in every entry point
 * (see bootstrap.ts) so OpenTelemetry can patch http/pg/ioredis/etc. before
 * they are first required.
 *
 * Architecture (decided against the standalone-NodeSDK approach that used to
 * live here): `@sentry/node` v10 is *built on* OpenTelemetry — `Sentry.init()`
 * already registers the global TracerProvider, SentrySampler, SentryPropagator
 * and SentryContextManager, and auto-instruments http/express/fastify/pg/etc.
 * Running a second, standalone `@opentelemetry/sdk-node` alongside it (as the
 * previous version did) double-registered the global provider/propagator and
 * silently severed trace propagation + dropped spans.
 *
 * Instead we let Sentry own the single provider and attach our own OTLP exporter
 * to it via the supported `openTelemetrySpanProcessors` option. The result:
 * every span goes to BOTH Sentry AND (when configured) an OTLP backend
 * (collector → Tempo/etc.) through one provider, one sampling decision, intact
 * propagation. `Sentry.flush()` flushes the OTLP processor too (they share the
 * provider), so shutdown is a single coordinated flush in app-fastify.ts.
 *
 * Enabled when EITHER SENTRY_DSN or OTEL_EXPORTER_OTLP_ENDPOINT is set. With
 * neither set this is a complete no-op (no provider/propagator registered) —
 * the kill-switch for local/test runs.
 */
const dsn = process.env.SENTRY_DSN;
const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
const serviceName = process.env.OTEL_SERVICE_NAME || process.env.SERVICE_NAME || 'wrapper-backend';
const isProd = process.env.NODE_ENV === 'production';

// Health/readiness/metrics probes are high-volume and trace-noise; never sample them.
const isProbePath = (urlPath: string): boolean =>
  /^\/(health|healthz|ready|readyz|livez|liveness|readiness|metrics)\b/.test(urlPath);

if (dsn || otlpEndpoint) {
  // Extra span processor: export the same Sentry-sampled spans to an OTLP
  // backend (e.g. the node-local OTel Collector agent). Only added when an
  // endpoint is configured; otherwise spans go to Sentry only.
  const spanProcessors: SpanProcessor[] = [];
  if (otlpEndpoint) {
    spanProcessors.push(
      new BatchSpanProcessor(
        new OTLPTraceExporter({ url: `${otlpEndpoint.replace(/\/+$/, '')}/v1/traces` }),
        {
          scheduledDelayMillis: 2000,
          exportTimeoutMillis: 5000,
          maxQueueSize: 4096,
          maxExportBatchSize: 512,
        },
      ),
    );
  }

  Sentry.init({
    dsn,
    // A client is still created when DSN is absent (OTLP-only mode); `enabled`
    // keeps it from trying to ship events to Sentry in that case.
    enabled: !!dsn,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.SENTRY_RELEASE || process.env.npm_package_version || '1.0.0',
    // Financial-grade default: never auto-attach IPs, cookies, request bodies.
    sendDefaultPii: false,
    // v10 top-level logs (replaces the deprecated `_experiments.enableLogs`).
    enableLogs: true,
    // Emit W3C `traceparent` alongside `sentry-trace`/`baggage` so non-Sentry
    // peers and the OTLP backend can continue traces.
    propagateTraceparent: true,
    // 100% in dev/test to capture everything; env-driven (default 10%) in prod.
    // SentrySampler honors this for BOTH the Sentry and OTLP egress.
    tracesSampleRate: isProd ? Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1) : 1.0,
    // Attach our OTLP exporter to the provider Sentry sets up.
    openTelemetrySpanProcessors: spanProcessors,
    // Sentry bundles http/express/fastify/pg/mysql/mongo/graphql instrumentation.
    // ioredis is not bundled — add it for Valkey/Redis cache spans.
    openTelemetryInstrumentations: [
      new IORedisInstrumentation(),
      // AWS SDK v3 semantic spans: `SNS Publish <topic>`, `SQS ReceiveMessage/
      // DeleteMessage <queue>`, `S3 <op> <bucket>`, Secrets Manager, etc. — with
      // messaging attributes + AWS request IDs. suppressInternalInstrumentation
      // emits ONE semantic span per call instead of that span PLUS a raw
      // `POST https://sns…amazonaws.com/` http.client child (dedup).
      // NOTE: cross-service SNS→SQS trace LINKING is carried by our own
      // inject/extract (trace-context.ts) and is proven working — this layer is
      // additive infra visibility, not the propagation mechanism. The aws-sdk
      // SQS `process` span coexists with our manual `consume <event>` span (same
      // trace, slight redundancy); we keep the manual span as authoritative.
      new AwsInstrumentation({ suppressInternalInstrumentation: true }),
    ],
    integrations: [
      Sentry.httpIntegration({
        // Drop incoming probe requests entirely (no span created).
        ignoreIncomingRequests: (urlPath: string) => isProbePath(urlPath),
      }),
    ],
    beforeSend(event) {
      // Strip sensitive headers from error events (defense in depth on top of
      // sendDefaultPii:false).
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
      }
      return event;
    },
    // With aws-sdk instrumentation on, every SQS long-poll ReceiveMessage that
    // returns no messages emits a `<queue> receive` root transaction (CONSUMER
    // span). At long-poll cadence that's constant, zero-value noise. Drop the
    // empty ones; keep receives that actually delivered messages (count > 0) and
    // every other transaction.
    beforeSendTransaction(event) {
      const d = event.contexts?.trace?.data as Record<string, unknown> | undefined;
      if (
        d &&
        d['messaging.system'] === 'aws_sqs' &&
        d['messaging.operation.type'] === 'receive' &&
        Number(d['messaging.batch.message_count'] ?? 0) === 0
      ) {
        return null;
      }
      return event;
    },
  });

  Sentry.setTag('service', serviceName);

  console.log(
    `✅ Telemetry initialised — Sentry: ${dsn ? 'on' : 'off'}, ` +
      `OTLP: ${otlpEndpoint ? `exporting to ${otlpEndpoint}` : 'off'} (service=${serviceName})`,
  );
} else {
  if (isProd) {
    console.warn(
      '⚠️  Neither SENTRY_DSN nor OTEL_EXPORTER_OTLP_ENDPOINT set — error tracking & distributed tracing are disabled',
    );
  }
}
