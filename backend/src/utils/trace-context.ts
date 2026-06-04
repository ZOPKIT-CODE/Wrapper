import { trace } from '@opentelemetry/api';

/**
 * Returns the active span's `trace_id`/`span_id` for log↔trace correlation,
 * or an empty object when there is no recording span (or telemetry is off).
 *
 * Used by the Winston loggers (as a format) and the Fastify pino logger (as a
 * mixin) so every log line can be joined to its trace in Sentry/Tempo and in
 * CloudWatch.
 */
export function getTraceFields(): { trace_id?: string; span_id?: string } {
  const span = trace.getActiveSpan();
  if (!span) return {};
  const ctx = span.spanContext();
  // All-zero trace id means "no valid span context".
  if (!ctx?.traceId || ctx.traceId === '00000000000000000000000000000000') return {};
  return { trace_id: ctx.traceId, span_id: ctx.spanId };
}
