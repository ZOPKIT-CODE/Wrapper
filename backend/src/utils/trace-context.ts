import { context, propagation, trace, type Context } from '@opentelemetry/api';

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

/** SQS/SNS MessageAttribute carrier shape (SQS returns StringValue/DataType). */
type MessageAttributeMap = Record<
  string,
  { DataType?: string; StringValue?: string; Value?: string; Type?: string }
>;

/**
 * Inject the active trace context (sentry-trace + baggage, via the global
 * SentryPropagator) into an SNS/SQS MessageAttributes map so the trace survives
 * the async hop. Mutates and returns the map. Call while the producer's span is
 * the active context (i.e. at publish time). No-op when telemetry is off.
 *
 * SNS subscriptions use raw_message_delivery=true, so MessageAttributes — not a
 * JSON envelope — are how trace context reaches the SQS consumer.
 */
export function injectTraceContext<
  T extends Record<string, { DataType: string; StringValue: string }>,
>(attrs: T): T {
  propagation.inject(context.active(), attrs, {
    set(carrier, key, value) {
      (carrier as MessageAttributeMap)[key] = { DataType: 'String', StringValue: String(value) };
    },
  });
  return attrs;
}

/**
 * Extract a parent Context from an SQS message's MessageAttributes. Run the
 * consumer's handler inside `context.with(extractTraceContext(msg.MessageAttributes), ...)`
 * so its spans continue the producer's trace.
 */
export function extractTraceContext(attrs: MessageAttributeMap | undefined): Context {
  return propagation.extract(context.active(), attrs ?? {}, {
    get(carrier, key) {
      const v = (carrier as MessageAttributeMap | undefined)?.[key];
      return v?.StringValue ?? v?.Value;
    },
    keys(carrier) {
      return carrier ? Object.keys(carrier as MessageAttributeMap) : [];
    },
  });
}
