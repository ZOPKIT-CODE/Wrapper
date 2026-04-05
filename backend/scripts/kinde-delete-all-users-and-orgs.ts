/**
 * Irreversibly deletes all organizations and users in your Kinde tenant via the Management API.
 *
 * Prerequisites:
 * - backend/.env (or cwd) with KINDE_DOMAIN, KINDE_M2M_CLIENT_ID, KINDE_M2M_CLIENT_SECRET,
 *   KINDE_MANAGEMENT_AUDIENCE (e.g. https://<subdomain>.kinde.com/api)
 * - M2M application in Kinde with scopes at least:
 *   read:organizations delete:organizations read:users delete:users
 *   (Optionally set KINDE_MANAGEMENT_SCOPES to include these.)
 *
 * Usage:
 *   cd backend && npx tsx scripts/kinde-delete-all-users-and-orgs.ts           # dry-run (default)
 *   npx tsx scripts/kinde-delete-all-users-and-orgs.ts --execute               # still requires env confirm
 *   KINDE_NUKE_CONFIRM=I_UNDERSTAND npx tsx scripts/kinde-delete-all-users-and-orgs.ts --execute
 *
 * Order: organizations first (clears memberships), then users. Default org deletion may fail; errors are logged.
 */

import { config as loadEnv } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(__dirname, '../.env') });
loadEnv();

const BASE = (process.env.KINDE_DOMAIN || '').replace(/\/$/, '');
const M2M_ID = process.env.KINDE_M2M_CLIENT_ID;
const M2M_SECRET = process.env.KINDE_M2M_CLIENT_SECRET;
const AUDIENCE =
  process.env.KINDE_MANAGEMENT_AUDIENCE ||
  (BASE ? `${BASE}/api` : '');

const NUKE_SCOPES =
  process.env.KINDE_MANAGEMENT_SCOPES?.trim() ||
  'read:organizations delete:organizations read:users delete:users';

const PAGE_SIZE = Math.min(100, Number(process.env.KINDE_PAGE_SIZE || 100) || 100);
const DRY_RUN = !process.argv.includes('--execute');
const CONFIRM = process.env.KINDE_NUKE_CONFIRM === 'I_UNDERSTAND';

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function getM2MToken(): Promise<string> {
  if (!BASE || !M2M_ID || !M2M_SECRET || !AUDIENCE) {
    throw new Error(
      'Missing KINDE_DOMAIN, KINDE_M2M_CLIENT_ID, KINDE_M2M_CLIENT_SECRET, or KINDE_MANAGEMENT_AUDIENCE'
    );
  }
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: M2M_ID,
    client_secret: M2M_SECRET,
    audience: AUDIENCE,
    scope: NUKE_SCOPES.replace(/,/g, ' '),
  });
  const res = await fetch(`${BASE}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`M2M token failed ${res.status}: ${text}`);
  }
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error('No access_token in token response');
  return data.access_token;
}

async function api(
  token: string,
  method: string,
  pathWithQuery: string,
  retries = 4
): Promise<Response> {
  const url = pathWithQuery.startsWith('http') ? pathWithQuery : `${BASE}${pathWithQuery}`;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });
    if (res.status === 429 && attempt < retries) {
      const retryAfter = Number(res.headers.get('retry-after')) || 2 ** attempt;
      await sleep(Math.min(30_000, retryAfter * 1000));
      continue;
    }
    return res;
  }
  return fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
}

type OrgRow = { code?: string; name?: string; is_default?: boolean };
type UserRow = { id?: string; email?: string };

async function listAllOrganizations(token: string): Promise<OrgRow[]> {
  const out: OrgRow[] = [];
  let nextToken: string | undefined;
  do {
    const q = new URLSearchParams({ page_size: String(PAGE_SIZE) });
    if (nextToken) q.set('next_token', nextToken);
    const res = await api(token, 'GET', `/api/v1/organizations?${q}`);
    if (!res.ok) throw new Error(`List organizations ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as {
      organizations?: OrgRow[];
      next_token?: string;
    };
    out.push(...(data.organizations || []));
    nextToken = data.next_token || undefined;
  } while (nextToken);
  return out;
}

async function listAllUsers(token: string): Promise<UserRow[]> {
  const out: UserRow[] = [];
  let nextToken: string | undefined;
  do {
    const q = new URLSearchParams({ page_size: String(PAGE_SIZE) });
    if (nextToken) q.set('next_token', nextToken);
    const res = await api(token, 'GET', `/api/v1/users?${q}`);
    if (!res.ok) throw new Error(`List users ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { users?: UserRow[]; next_token?: string };
    out.push(...(data.users || []));
    nextToken = data.next_token || undefined;
  } while (nextToken);
  return out;
}

async function deleteOrganization(token: string, orgCode: string): Promise<void> {
  const res = await api(token, 'DELETE', `/api/v1/organization/${encodeURIComponent(orgCode)}`);
  if (!res.ok && res.status !== 404) {
    throw new Error(`Delete org ${orgCode}: ${res.status} ${await res.text()}`);
  }
}

async function deleteUser(token: string, userId: string): Promise<void> {
  const q = new URLSearchParams({ id: userId, is_delete_profile: 'true' });
  const res = await api(token, 'DELETE', `/api/v1/user?${q}`);
  if (!res.ok && res.status !== 404) {
    throw new Error(`Delete user ${userId}: ${res.status} ${await res.text()}`);
  }
}

async function main(): Promise<void> {
  if (!DRY_RUN && !CONFIRM) {
    console.error(
      'Refusing to run without confirmation. This permanently deletes data in Kinde.\n' +
        'Re-run with: KINDE_NUKE_CONFIRM=I_UNDERSTAND ... --execute'
    );
    process.exit(1);
  }

  console.log(`Mode: ${DRY_RUN ? 'DRY-RUN (no changes)' : 'EXECUTE (deleting)'}`);
  console.log(`Kinde: ${BASE || '(missing KINDE_DOMAIN)'}`);

  const token = await getM2MToken();
  const orgs = await listAllOrganizations(token);
  const users = await listAllUsers(token);

  console.log(`Found ${orgs.length} organization(s), ${users.length} user(s).`);

  for (const o of orgs) {
    const code = o.code;
    if (!code) continue;
    const label = `${code}${o.name ? ` (${o.name})` : ''}${o.is_default ? ' [default]' : ''}`;
    if (DRY_RUN) {
      console.log(`[dry-run] would DELETE organization ${label}`);
    } else {
      try {
        await deleteOrganization(token, code);
        console.log(`Deleted organization ${label}`);
      } catch (e) {
        console.error(`Failed organization ${label}:`, e instanceof Error ? e.message : e);
      }
    }
  }

  for (const u of users) {
    const id = u.id;
    if (!id) continue;
    const label = `${id}${u.email ? ` <${u.email}>` : ''}`;
    if (DRY_RUN) {
      console.log(`[dry-run] would DELETE user ${label}`);
    } else {
      try {
        await deleteUser(token, id);
        console.log(`Deleted user ${label}`);
      } catch (e) {
        console.error(`Failed user ${label}:`, e instanceof Error ? e.message : e);
      }
    }
  }

  if (DRY_RUN) {
    console.log('\nDry-run complete. Pass --execute and KINDE_NUKE_CONFIRM=I_UNDERSTAND to delete.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
