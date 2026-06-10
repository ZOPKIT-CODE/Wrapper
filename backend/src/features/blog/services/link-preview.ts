import dns from 'node:dns/promises';
import net from 'node:net';

/**
 * Server-side OpenGraph/meta fetcher for external link-preview cards.
 *
 * SSRF is the threat here (an authenticated author supplies a URL we fetch from
 * the server). Defences:
 *   • scheme allow-list (http/https only)
 *   • DNS-resolve the host and REJECT if ANY resolved IP is private/loopback/
 *     link-local/metadata/reserved (blocks 169.254.169.254, 127.0.0.1, 10/8, …)
 *   • redirects followed MANUALLY, re-validating each hop's host (max 3)
 *   • request timeout + response size cap + HTML content-type only
 *   • outputs are trimmed/length-capped; image URL must be http/https
 */

export interface LinkPreview {
  url: string;
  title: string;
  description: string;
  image: string;
  siteName: string;
}

const TIMEOUT_MS = 6000;
const MAX_BYTES = 768 * 1024;
const MAX_REDIRECTS = 3;
const MAX_FIELD = 300;

/** True if an IP literal is in a private/loopback/link-local/reserved range. */
function isBlockedIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const p = ip.split('.').map(Number);
    if (p[0] === 10) return true; // 10/8 private
    if (p[0] === 127) return true; // loopback
    if (p[0] === 0) return true; // "this" network
    if (p[0] === 169 && p[1] === 254) return true; // link-local + 169.254.169.254 metadata
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true; // 172.16/12
    if (p[0] === 192 && p[1] === 168) return true; // 192.168/16
    if (p[0] === 100 && p[1] >= 64 && p[1] <= 127) return true; // CGNAT 100.64/10
    if (p[0] >= 224) return true; // multicast/reserved
    return false;
  }
  if (net.isIPv6(ip)) {
    const x = ip.toLowerCase();
    if (x === '::1' || x === '::') return true; // loopback / unspecified
    if (x.startsWith('fe80') || x.startsWith('fc') || x.startsWith('fd')) return true; // link-local + ULA
    if (x.startsWith('::ffff:')) return isBlockedIp(x.slice(7)); // IPv4-mapped
    if (x.startsWith('fec0')) return true; // deprecated site-local
    return false;
  }
  return true; // not a parseable IP → reject
}

/** Resolve a host and assert every resolved address is publicly routable. */
async function assertHostAllowed(host: string): Promise<void> {
  // A bare IP literal in the URL is checked directly.
  if (net.isIP(host)) {
    if (isBlockedIp(host)) throw new Error('blocked address');
    return;
  }
  if (!/^[a-z0-9.-]+$/i.test(host) || host.endsWith('.localhost') || host === 'localhost') {
    throw new Error('blocked host');
  }
  const records = await dns.lookup(host, { all: true });
  if (!records.length) throw new Error('unresolvable host');
  for (const r of records) if (isBlockedIp(r.address)) throw new Error('blocked address');
}

function clean(s: string | undefined | null): string {
  if (!s) return '';
  return s.replace(/\s+/g, ' ').trim().slice(0, MAX_FIELD);
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
}

/** Extract a <meta property|name="key" content="…"> value (first match). */
function meta(html: string, keys: string[]): string {
  for (const key of keys) {
    const re = new RegExp(
      `<meta[^>]+(?:property|name)=["']${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>`,
      'i',
    );
    const tag = re.exec(html)?.[0];
    if (tag) {
      const c = /content=["']([^"']*)["']/i.exec(tag)?.[1];
      if (c) return decodeEntities(clean(c));
    }
  }
  return '';
}

export async function fetchLinkPreview(rawUrl: string): Promise<LinkPreview> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('invalid url');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('unsupported scheme');

  // Follow redirects manually, re-validating the host at every hop.
  let current = url;
  let html = '';
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertHostAllowed(current.hostname);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(current.toString(), {
        method: 'GET',
        redirect: 'manual',
        signal: ctrl.signal,
        headers: { 'user-agent': 'ZopkitBot/1.0 (+link-preview)', accept: 'text/html,application/xhtml+xml' },
      });
    } finally {
      clearTimeout(timer);
    }

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) throw new Error('redirect without location');
      current = new URL(loc, current); // resolve relative; re-validated next loop
      continue;
    }
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const ctype = res.headers.get('content-type') || '';
    if (!ctype.includes('html')) throw new Error('not html');

    // Read up to MAX_BYTES, then stop (don't slurp arbitrarily large bodies).
    const reader = res.body?.getReader();
    if (!reader) throw new Error('no body');
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.length;
        chunks.push(value);
        if (total >= MAX_BYTES) { await reader.cancel(); break; }
      }
    }
    html = Buffer.concat(chunks).toString('utf8');
    break;
  }
  if (!html) throw new Error('empty');

  const title =
    meta(html, ['og:title', 'twitter:title']) ||
    decodeEntities(clean(/<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1] ?? ''));
  const description = meta(html, ['og:description', 'twitter:description', 'description']);
  const siteName = meta(html, ['og:site_name']) || current.hostname.replace(/^www\./, '');
  let image = meta(html, ['og:image', 'og:image:url', 'twitter:image']);
  // Resolve relative image URLs against the page; drop anything not http(s).
  if (image) {
    try {
      const abs = new URL(image, current);
      image = abs.protocol === 'http:' || abs.protocol === 'https:' ? abs.toString() : '';
    } catch {
      image = '';
    }
  }

  return { url: current.toString(), title, description, image, siteName };
}
