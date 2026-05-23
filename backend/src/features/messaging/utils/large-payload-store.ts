import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import * as Sentry from '@sentry/node';
import Logger from '../../../utils/logger.js';

/**
 * S3 Claim-Check for large SNS/SQS payloads.
 *
 * SQS has a hard 256 KB message limit.  When an event payload (e.g. tenant.onboarded
 * with hundreds of users) would exceed that, we:
 *   1. Upload the full eventData to S3
 *   2. Replace eventData in the SNS message with a tiny pointer: { _s3Ref: { bucket, key } }
 *   3. On the consumer side, transparently resolve the pointer back to the full payload
 *      before handing it to the handler
 *
 * Backward compatible: if _s3Ref is absent the payload passes through unchanged.
 * Existing events that never hit the limit are unaffected.
 */

// Use messaging-specific credentials if provided, otherwise fall back to
// the general AWS credentials (which may be scoped to Route 53 only).
const _msgAccessKeyId =
  process.env.AWS_MESSAGING_ACCESS_KEY_ID ?? process.env.AWS_ACCESS_KEY_ID;
const _msgSecretAccessKey =
  process.env.AWS_MESSAGING_SECRET_ACCESS_KEY ?? process.env.AWS_SECRET_ACCESS_KEY;

const s3 = new S3Client({
  region: process.env.AWS_REGION ?? 'us-east-1',
  ...(_msgAccessKeyId && _msgSecretAccessKey
    ? { credentials: { accessKeyId: _msgAccessKeyId, secretAccessKey: _msgSecretAccessKey } }
    : {}),
});

/** Leave 56 KB headroom from the 256 KB SQS limit (SNS envelope + message attributes add overhead). */
const OFFLOAD_THRESHOLD_BYTES = 200_000;

const BUCKET = process.env.SNS_LARGE_PAYLOAD_BUCKET ?? '';

// ---------------------------------------------------------------------------
// Publisher side
// ---------------------------------------------------------------------------

/**
 * Call this before building the SNS PublishCommand.
 *
 * - If payload is under threshold OR bucket is not configured → returns payload as-is
 * - If payload is over threshold → uploads to S3, returns the pointer object
 *
 * @param eventId  Stable ID used as the S3 key (e.g. outbox eventId)
 * @param eventData  The eventData object you were going to embed in the message
 * @returns { eventData: object, offloaded: boolean }
 */
export async function maybeOffloadToS3(
  eventId: string,
  eventData: Record<string, unknown>,
): Promise<{ eventData: Record<string, unknown>; offloaded: boolean }> {
  const json = JSON.stringify(eventData);

  if (!BUCKET || json.length < OFFLOAD_THRESHOLD_BYTES) {
    return { eventData, offloaded: false };
  }

  const key = `events/${eventId}.json`;

  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: json,
        ContentType: 'application/json',
        // SSE is inherited from bucket default encryption — no extra config needed
      }),
    );
  } catch (err: unknown) {
    const error = err as Error;
    Sentry.withScope((scope) => {
      scope.setTag('messaging.transport', 'sqs');
      scope.setTag('messaging.large_payload', 'offload');
      scope.setContext('s3_offload_failure', {
        eventId,
        bucket: BUCKET,
        key,
        payloadBytes: json.length,
      });
      Sentry.captureException(error);
    });
    throw error;
  }

  Logger.log('info', 'general', 'maybeOffloadToS3', 'Event payload offloaded to S3', { eventId, bucket: BUCKET, key, payloadBytes: json.length });

  Sentry.addBreadcrumb({
    category: 'messaging.large_payload',
    message: 'Event payload offloaded to S3',
    level: 'info',
    data: { eventId, bucket: BUCKET, key, payloadBytes: json.length },
  });

  return {
    eventData: {
      _s3Ref: { bucket: BUCKET, key },
    },
    offloaded: true,
  };
}

// ---------------------------------------------------------------------------
// Consumer side
// ---------------------------------------------------------------------------

/**
 * Call this after parsing the SNS/SQS message, before passing eventData to your handler.
 *
 * - If eventData has no _s3Ref → returns eventData unchanged (fast path)
 * - If eventData has _s3Ref → fetches from S3 and returns the full payload
 *
 * @param eventData  The eventData field from the parsed event envelope
 * @returns Resolved eventData (same shape whether inline or fetched from S3)
 */
export async function resolvePayload(
  eventData: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (!eventData._s3Ref) {
    // Common path — inline payload, nothing to do
    return eventData;
  }

  const { bucket, key } = eventData._s3Ref as { bucket: string; key: string };

  let response;
  try {
    response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  } catch (err: unknown) {
    const error = err as Error;
    Sentry.withScope((scope) => {
      scope.setTag('messaging.transport', 'sqs');
      scope.setTag('messaging.large_payload', 'resolve');
      scope.setContext('s3_resolve_failure', { bucket, key });
      Sentry.captureException(error);
    });
    throw error;
  }

  const body = await response.Body?.transformToString('utf-8');
  if (!body) {
    const emptyBodyError = new Error(`[LargePayloadStore] Empty S3 body at s3://${bucket}/${key}`);
    Sentry.withScope((scope) => {
      scope.setTag('messaging.transport', 'sqs');
      scope.setTag('messaging.large_payload', 'resolve');
      scope.setContext('s3_resolve_failure', { bucket, key, reason: 'empty_body' });
      Sentry.captureException(emptyBodyError);
    });
    throw emptyBodyError;
  }

  Logger.log('info', 'general', 'resolvePayload', 'Large payload resolved from S3', { bucket, key });
  Sentry.addBreadcrumb({
    category: 'messaging.large_payload',
    message: 'Large payload resolved from S3',
    level: 'info',
    data: { bucket, key },
  });

  return JSON.parse(body) as Record<string, unknown>;
}
