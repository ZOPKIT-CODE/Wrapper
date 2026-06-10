/**
 * Startup health summary — one clear banner on boot answering "is the DB live?
 * is Valkey connected? is SQS reachable? is SNS configured? are we healthy?"
 * instead of scattering it across noisy logs.
 *
 * DB is the only hard requirement (it gates overall status). Valkey / SQS / SNS
 * are reported but the app degrades gracefully without them.
 */
import { SQSClient, GetQueueAttributesCommand } from '@aws-sdk/client-sqs';
import { sql } from 'drizzle-orm';

import { globalDb } from './db/index.js';
import { getValkey } from './utils/valkey-client.js';

type Check = { ok: boolean; warn?: boolean; detail: string };

async function checkDb(): Promise<Check> {
  try {
    await globalDb.execute(sql`SELECT 1`);
    let label = 'connected & live';
    try {
      const host = new URL(process.env.DATABASE_URL ?? '').hostname;
      const target =
        host.includes('supabase') ? 'Supabase'
        : host === 'localhost' || host === '127.0.0.1' ? 'RDS (via SSM tunnel)'
        : host.includes('rds.amazonaws.com') ? 'RDS'
        : host;
      const name = (process.env.DATABASE_URL?.split('/').pop() ?? '').split('?')[0];
      if (target) label = `connected & live — ${name || 'db'} @ ${target}`;
    } catch {
      /* best-effort label only */
    }
    return { ok: true, detail: label };
  } catch (err) {
    return { ok: false, detail: `UNREACHABLE — ${(err as Error)?.message ?? err}` };
  }
}

async function checkValkey(): Promise<Check> {
  const client = getValkey();
  if (!client) return { ok: false, warn: true, detail: 'not configured (in-process fallback)' };
  try {
    // ioredis connects asynchronously; with enableOfflineQueue:false a ping before
    // the socket is 'ready' throws "Stream isn't writeable". Wait briefly for ready.
    const c = client as unknown as { status?: string; once(ev: string, cb: () => void): void };
    if (c.status && c.status !== 'ready') {
      await new Promise<void>((resolve) => {
        const t = setTimeout(resolve, 3000);
        c.once('ready', () => { clearTimeout(t); resolve(); });
      });
    }
    const pong = await client.ping();
    return pong === 'PONG'
      ? { ok: true, detail: 'connected' }
      : { ok: false, detail: `unexpected reply: ${pong}` };
  } catch (err) {
    return { ok: false, detail: `error — ${(err as Error)?.message ?? err}` };
  }
}

let _sqs: SQSClient | null = null;
async function checkSqs(): Promise<Check> {
  const queueUrl = process.env.SQS_WRAPPER_QUEUE_URL;
  if (!queueUrl) return { ok: false, warn: true, detail: 'not configured (no inbound queue URL)' };
  try {
    _sqs ??= new SQSClient({ region: process.env.AWS_REGION ?? 'us-east-1' });
    const res = await _sqs.send(
      new GetQueueAttributesCommand({ QueueUrl: queueUrl, AttributeNames: ['ApproximateNumberOfMessages'] })
    );
    const n = res.Attributes?.ApproximateNumberOfMessages ?? '?';
    return { ok: true, detail: `reachable — ${queueUrl.split('/').pop()} (~${n} msgs)` };
  } catch (err) {
    return { ok: false, detail: `error — ${(err as Error)?.message ?? err}` };
  }
}

function checkSns(): Check {
  // Publish-only via the platform-sdk SnsPublisher; no cheap network probe, so we
  // report config status (shares AWS creds/region with the probed SQS client).
  const arn = process.env.SNS_INTER_APP_TOPIC_ARN ?? process.env.SNS_TOPIC_ARN;
  if (!arn) return { ok: false, warn: true, detail: 'not configured (SNS topic ARN unset — publish disabled)' };
  return { ok: true, detail: `configured — topic ${arn.split(':').pop()} (publish-only)` };
}

/** Probe the critical dependencies and log a single, scannable health banner. */
export async function logStartupHealth(): Promise<void> {
  const [dbRes, vkRes, sqsRes] = await Promise.all([checkDb(), checkValkey(), checkSqs()]);
  const snsRes = checkSns();
  const healthy = dbRes.ok; // only the DB gates overall status
  const mark = (c: Check) => (c.ok ? '✓' : c.warn ? '⚠' : '✗');

  // console.log to match the adjacent startup banner (✅ Server listening …).
  console.log('──────────────── Startup health ────────────────');
  console.log(`  DB      ${mark(dbRes)}  ${dbRes.detail}`);
  console.log(`  Valkey  ${mark(vkRes)}  ${vkRes.detail}`);
  console.log(`  SQS     ${mark(sqsRes)}  ${sqsRes.detail}`);
  console.log(`  SNS     ${mark(snsRes)}  ${snsRes.detail}`);
  console.log(`  Status  ${healthy ? '✓  HEALTHY' : '✗  DEGRADED (DB unreachable)'}`);
  console.log('────────────────────────────────────────────────');
}
