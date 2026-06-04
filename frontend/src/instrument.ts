import * as Sentry from '@sentry/react';

/**
 * Browser telemetry — imported first in main.tsx. No-op unless VITE_SENTRY_DSN
 * is set. Sentry's global handlers capture unhandled errors + rejections;
 * browserTracingIntegration captures pageload/navigation transactions and (via
 * tracePropagationTargets) attaches sentry-trace/baggage to API calls so the
 * browser trace connects to the backend trace. Replay is sampled.
 */
const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;

if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: (import.meta.env.VITE_APP_VERSION as string | undefined) || undefined,
    sendDefaultPii: false,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
    ],
    tracesSampleRate: import.meta.env.PROD
      ? Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? 0.1)
      : 1.0,
    // Propagate trace headers to same-origin, localhost, and the API origin so
    // frontend traces continue into the backend (backends allow these CORS headers).
    tracePropagationTargets: [
      /^\//,
      /localhost(:\d+)?$/,
      import.meta.env.VITE_API_BASE_URL as string,
    ].filter(Boolean),
    replaysSessionSampleRate: import.meta.env.PROD ? 0.1 : 0,
    replaysOnErrorSampleRate: 1.0,
  });
}
