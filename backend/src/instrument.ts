import 'dotenv/config';
import * as Sentry from '@sentry/node';

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
