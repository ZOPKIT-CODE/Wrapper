import { createHash } from 'crypto';

/**
 * Derive a deterministic outbox event ID from a domain operation.
 *
 * When a caller retries the same logical operation (same domainOpId), the
 * resulting eventId is identical and the outbox UNIQUE constraint on event_id
 * collapses duplicates instead of publishing the same event twice.
 *
 * Callers without a natural key should fall back to a random ID (see
 * `InterAppEventService.publishEvent`).
 */
export function deriveEventId(params: {
  eventType: string;
  tenantId: string;
  entityId?: string | null;
  domainOpId: string;
  /** Optional discriminator (e.g. target app) when one domain op fans out per app */
  targetApplication?: string;
}): string {
  const parts = [
    params.eventType,
    params.tenantId,
    params.entityId ?? '',
    params.domainOpId,
    params.targetApplication ?? '',
  ];
  const hash = createHash('sha256').update(parts.join('|')).digest('hex');
  // 20 hex chars = 80 bits — plenty for collision resistance within the outbox.
  return `outbox_${hash.slice(0, 20)}`;
}
