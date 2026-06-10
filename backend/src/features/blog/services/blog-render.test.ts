import { describe, it, expect } from 'vitest';
import {
  renderBodyHtml,
  extractPlainText,
  computeWordCount,
  computeReadingTimeMinutes,
  buildMediaUrl,
  collectLinkPostIds,
  type RefResolver,
} from './blog-render.js';

const doc = (content: unknown[]) => ({ type: 'doc', content });

/** Build a stub reference resolver from a plain map of postId → {slug, live}. */
const resolver = (m: Record<string, { slug: string; live: boolean }>): RefResolver =>
  async (ids) => new Map(ids.filter((id) => m[id]).map((id) => [id, m[id]]));

describe('blog-render', () => {
  it('renders basic nodes to HTML', async () => {
    const html = await renderBodyHtml(doc([
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Hello' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'world', marks: [{ type: 'bold' }] }] },
    ]));
    expect(html).toContain('<h2');
    expect(html).toContain('Hello');
    expect(html).toMatch(/<strong/);
  });

  it('strips a javascript: link href (XSS boundary)', async () => {
    const html = await renderBodyHtml(doc([
      { type: 'paragraph', content: [{ type: 'text', text: 'click', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] },
    ]));
    expect(html).not.toContain('javascript:');
  });

  it('escapes raw HTML in text nodes (no script injection)', async () => {
    const html = await renderBodyHtml(doc([
      { type: 'paragraph', content: [{ type: 'text', text: '<script>alert(1)</script>' }] },
    ]));
    expect(html).not.toContain('<script>');
  });

  it('keeps https links and forces safe rel/target', async () => {
    const html = await renderBodyHtml(doc([
      { type: 'paragraph', content: [{ type: 'text', text: 'x', marks: [{ type: 'link', attrs: { href: 'https://example.com' } }] }] },
    ]));
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('nofollow');
  });

  it('extracts plain text, word count and reading time', () => {
    const d = doc([{ type: 'paragraph', content: [{ type: 'text', text: 'one two three' }] }]);
    expect(extractPlainText(d)).toBe('one two three');
    expect(computeWordCount(d)).toBe(3);
    expect(computeReadingTimeMinutes(400)).toBe(2);
    expect(computeReadingTimeMinutes(0)).toBe(1);
  });

  it('renders code blocks with a preserved language class (client highlights them)', async () => {
    const html = await renderBodyHtml(doc([
      { type: 'codeBlock', attrs: { language: 'javascript' }, content: [{ type: 'text', text: 'const x = 1;' }] },
    ]));
    expect(html).toContain('<pre');
    expect(html).toContain('<code');
    expect(html).toContain('const x = 1;');
    // language class survives the sanitizer so client-side highlight.js can colorize.
    expect(html).toContain('language-javascript');
  });

  it('renders a table (header + cells) and keeps it through the sanitizer', async () => {
    const html = await renderBodyHtml(doc([
      { type: 'table', content: [
        { type: 'tableRow', content: [
          { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Feature' }] }] },
          { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Value' }] }] },
        ] },
        { type: 'tableRow', content: [
          { type: 'tableCell', attrs: { colspan: 2 }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Spanned' }] }] },
        ] },
      ] },
    ]));
    expect(html).toContain('<table');
    expect(html).toContain('<th');
    expect(html).toContain('<td');
    expect(html).toContain('Feature');
    expect(html).toContain('colspan="2"');
  });

  it('renders a callout as <div data-callout> with the type class', async () => {
    const html = await renderBodyHtml(doc([
      { type: 'callout', attrs: { type: 'warning' }, content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Heads up.' }] },
      ] },
    ]));
    expect(html).toContain('data-callout="warning"');
    expect(html).toContain('class="callout callout-warning"');
    expect(html).toContain('Heads up.');
  });

  // ── Article-to-article references ──────────────────────────────────────────

  const refDoc = (postId: string, href = 'https://stale.example/old') => doc([
    { type: 'paragraph', content: [{ type: 'text', text: 'see this', marks: [{ type: 'link', attrs: { href, postId } }] }] },
  ]);

  it('collects internal-link postIds from a doc', () => {
    expect(collectLinkPostIds(refDoc('p1'))).toEqual(['p1']);
    expect(collectLinkPostIds(doc([{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }]))).toEqual([]);
  });

  it('resolves a live internal reference to its current slug, same-tab + followed', async () => {
    const html = await renderBodyHtml(refDoc('p1'), resolver({ p1: { slug: 'current-slug', live: true } }));
    expect(html).toContain('href="/blog/current-slug"');
    expect(html).toContain('data-post-id="p1"');
    expect(html).not.toContain('nofollow');          // internal → followed
    expect(html).not.toContain('target="_blank"');   // internal → same tab
    expect(html).not.toContain('stale.example');      // old href replaced
  });

  it('drops a dangling/unpublished reference to plain text (no broken link)', async () => {
    const html = await renderBodyHtml(refDoc('p1'), resolver({ p1: { slug: 'x', live: false } }));
    expect(html).toContain('see this');
    expect(html).not.toContain('<a');
    expect(html).not.toContain('data-post-id');
  });

  it('neutralizes a javascript: href even on a reference (resolution overrides href)', async () => {
    const html = await renderBodyHtml(refDoc('p1', 'javascript:alert(1)'), resolver({ p1: { slug: 'safe', live: true } }));
    expect(html).not.toContain('javascript:');
    expect(html).toContain('href="/blog/safe"');
  });

  it('with no resolver, drops internal references rather than emitting a guessed href', async () => {
    const html = await renderBodyHtml(refDoc('p1'));
    expect(html).toContain('see this');
    expect(html).not.toContain('<a');
  });

  it('builds a media URL from a key', () => {
    expect(buildMediaUrl('blog/cover/2026-06-06/abc.png', 'https://app.test/'))
      .toBe('https://app.test/api/blog/media/blog/cover/2026-06-06/abc.png');
    expect(buildMediaUrl(null, 'https://app.test')).toBe('');
  });
});
