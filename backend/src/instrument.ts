/* eslint-disable no-console */
import 'dotenv/config';
import * as Sentry from '@sentry/node';

// ─── OpenTelemetry ────────────────────────────────────────────────────────────
// Must be initialised before any other imports so the auto-instrumentations
// can patch Node.js built-ins (http, pg, etc.) before they are first required.
// Set OTEL_EXPORTER_OTLP_ENDPOINT to send traces to any OTLP-compatible backend
// (Jaeger, Grafana Tempo, Honeycomb, Lightstep, etc.).
const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
if (otlpEndpoint) {
  const { NodeSDK } = await import('@opentelemetry/sdk-node');
  const { getNodeAutoInstrumentations } = await import('@opentelemetry/auto-instrumentations-node');
  const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-http');

  // service.version and deployment.environment can be passed via
  // OTEL_RESOURCE_ATTRIBUTES=service.version=1.0.0,deployment.environment=production
  const sdk = new NodeSDK({
    serviceName: process.env.SERVICE_NAME || 'wrapper-backend',
    traceExporter: new OTLPTraceExporter({
      url: `${otlpEndpoint}/v1/traces`,
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        // fs instrumentation is extremely noisy and rarely useful
        '@opentelemetry/instrumentation-fs': { enabled: false },
        // DNS spans add noise without actionable info in most setups
        '@opentelemetry/instrumentation-dns': { enabled: false },
      }),
    ],
  });

  sdk.start();
  console.log(`✅ OpenTelemetry tracing initialised (exporting to ${otlpEndpoint})`);

  // Flush spans on graceful shutdown
  process.on('SIGTERM', () => { void sdk.shutdown(); });
  process.on('SIGINT',  () => { void sdk.shutdown(); });
} else {
  if (process.env.NODE_ENV === 'production') {
    console.warn('⚠️  OTEL_EXPORTER_OTLP_ENDPOINT not set — distributed tracing is disabled');
  }
}

// ─── Sentry ───────────────────────────────────────────────────────────────────
const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.npm_package_version || '1.0.0',
    tracesSampleRate: process.env.NODE_ENV === 'production'
      ? Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1)
      : 1.0, // 100% sampling in dev/test — capture everything during testing
    _experiments: { enableLogs: true },
    beforeSend(event) {
      // Strip sensitive headers
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
      }
      return event;
    },
  });
  console.log('✅ Sentry initialized');
} else {
  console.warn('⚠️ SENTRY_DSN not set — Sentry error tracking is disabled');
}
