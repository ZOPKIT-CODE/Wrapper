import { describe, it, expect } from 'vitest';
import { getSchema } from '@tiptap/core';
import { blogExtensions, EXPECTED_BLOG_NODES, EXPECTED_BLOG_MARKS } from './tiptap-schema.js';

/**
 * Schema-parity guard: the editor (frontend) and renderer (backend) must agree
 * on the node/mark set, or the public HTML diverges from the WYSIWYG view.
 * This asserts the backend extension list produces exactly the expected schema.
 */
describe('tiptap schema parity', () => {
  const schema = getSchema(blogExtensions);

  it('exposes all expected node types', () => {
    const names = Object.keys(schema.nodes);
    for (const n of EXPECTED_BLOG_NODES) expect(names).toContain(n);
  });

  it('exposes all expected mark types', () => {
    const names = Object.keys(schema.marks);
    for (const m of EXPECTED_BLOG_MARKS) expect(names).toContain(m);
  });
});
