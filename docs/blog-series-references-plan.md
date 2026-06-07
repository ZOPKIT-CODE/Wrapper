The critique's claims are verified against the real files: no `blog/index.ts` (the aggregator is the flat `schema/index.ts` with per-table re-exports at lines 31-33), `simpleTransform('a', {rel:'...nofollow', target:'_blank'})` at line 40, `autolink: true` at line 31, soft-delete-only at line 169, body-change gating at line 127, and `/blog/:slug` crawler route at line 71 with prefix-match public routing. All critique points hold. Here is the final plan.

# Blog Series + Article-to-Article Referencing — Final Implementation Plan

This plan merges the original design with every valid critique point: the corrected schema-aggregator path, the body_html staleness fix promoted into core scope, the XSS-safe sanitizer rewrite, soft-delete-aware index hygiene, write-amplification controls, and re-decoupled SEO wins. All file paths are verified against the live tree.

---

## 1. Recommended Phased Build Order

Ranked first → last, grouped by value/risk. The big change from the draft: **slug-history 301 is promoted to Phase 1 (P0)** because it is the only working mitigation for cached-`body_html` staleness, and the **series SEO wins (8, 9) are front-loaded as Phase 0** because they are independent of the referencing feature and never touch the XSS boundary or migrations.

**Phase 0 — Decoupled low-risk SEO wins (ship first, in parallel with referencing review)**
1. Series JSON-LD (`CreativeWorkSeries`/`isPartOf`) + `BreadcrumbList` — no migration, no sanitizer, no parity.
2. Series crawler-HTML + sitemap coverage (`renderSeriesDocument`, `/blog/series/:slug` route, sitemap URLs).

**Phase 1 — Referencing foundation (highest value, highest risk; gate behind tests)**
3. **Sanitizer transform rewrite** (internal vs external `rel`/`target`, `data-post-id` allow-listed) — *land its `blog-render.test.ts` cases FIRST*; it modifies the sole XSS boundary.
4. **Extended `Link` mark with `postId`** — byte-mirrored backend/frontend (Callout lock-step rule).
5. **Render-time slug resolution + dangling-reference degrade** in `renderBodyHtml`.
6. **`blog_post_links` reverse index** (parse-on-save, transactional, soft-delete-aware) — migration.
7. **`blog_post_slug_history` + 301** — *promoted to P0*, the staleness safety net; migration.
8. **Re-render fan-out on slug/status change** (re-render published inbound referrers via `blog_post_links`) — *promoted into core scope* (decision below: fan-out vs accept-301-only).

**Phase 2 — Reader/author surfaces + polish (depend on Phase 1 data)**
9. "Referenced by" panel on public post + crawler HTML (P1).
10. In-editor "Link to a post" picker + bounded post-search endpoint (P1).
11. Series grouping on blog index (P2).
12. Aggregate series reading time + completion progress; per-part reading time on landing rows (P2).
13. Orphan-page report from the links index (P2; needs soft-delete-aware query).

**Explicitly deferred (post-plan):** v2 `@`/`[[` mention-chip picker (NodeView + `@tiptap/suggestion`, not installed), unlinked-mentions full-text scan, backlink `context` snippets, RSS backlink exposure, co-citation related-posts.

---

## 2. Article-to-Article Referencing + Backlinks

### Approach (confirmed)
Extend the **existing `@tiptap/extension-link` mark** with one inline attribute `postId` (Tiptap "extend existing extension" pattern), rather than a new node. `link` is already in `EXPECTED_BLOG_MARKS`; `<a>` is already allow-listed in `blog-render.ts`. Adding only a mark *attribute* leaves `EXPECTED_BLOG_NODES`/`EXPECTED_BLOG_MARKS` and `tiptap-schema.test.ts` **unchanged** — but the `Link.extend(...)` must be **byte-mirrored** in `backend/src/features/blog/tiptap-schema.ts` and `frontend/src/features/blog/tiptap-extensions.ts` (same lock-step rule as Callout). The dedicated `postReference` node + `@tiptap/suggestion` chip is a v2 only.

```ts
Link.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      postId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-post-id'),
        renderHTML: (a) => (a.postId ? { 'data-post-id': a.postId } : {}),
      },
    };
  },
}).configure({ autolink: true, /* keep existing config */ })
```

### Data model
- **`blog_post_links`** — derived reverse index, **never hand-maintained**:
  - `from_post_id uuid NOT NULL REFERENCES blog_posts(post_id) ON DELETE CASCADE`
  - `to_post_id   uuid NOT NULL REFERENCES blog_posts(post_id) ON DELETE CASCADE`
  - `PRIMARY KEY (from_post_id, to_post_id)`
  - `CHECK (from_post_id <> to_post_id)` — **self-reference guard** (a post must not appear in its own "Referenced by").
  - `CREATE INDEX idx_blog_post_links_to ON blog_post_links(to_post_id)` — drives the backlinks query.
- **`blog_post_slug_history`** — `old_slug text, post_id uuid REFERENCES blog_posts(post_id) ON DELETE CASCADE, created_at timestamptz`, indexed on `old_slug` for redirect lookup.
- References themselves live in the existing `body` jsonb. **No new column on `blog_posts`.** The `context` snippet column is deferred (v1 backlinks are title + excerpt only — stated as a known limitation).

**Schema registration (corrected):** add `backend/src/db/schema/blog/blog-post-links.ts` and `…/blog-post-slug-history.ts`, then re-export them from the **flat aggregator `backend/src/db/schema/index.ts`** (alongside lines 31-33, e.g. `export * from './blog/blog-post-links.js';`). There is **no** `schema/blog/index.ts` — the original plan's path was wrong and would have left the tables unregistered.

**CASCADE caveat (corrected):** `softDeletePost` only sets `deleted_at` (line 169); posts are **never hard-deleted**, so the FK `ON DELETE CASCADE` essentially never fires. The index is therefore **not** self-cleaning. Required hygiene:
- `softDeletePost` (and series soft-delete) must explicitly `DELETE FROM blog_post_links WHERE from_post_id = $1`.
- The public backlinks query and orphan report must filter to `to`/`from` posts that are `status='published' AND deleted_at IS NULL` and guard against dangling `to_post_id`.

### Extraction / storage (parse-on-save, with write-amplification controls)
On create/update, walk the ProseMirror JSON collecting `link` marks carrying a `postId`, dedupe, then **inside a single transaction** `DELETE … WHERE from_post_id=$1` + re-`INSERT`. Controls (critique-driven):
- **Gate strictly on body change** — hook into the existing `if (input.body !== undefined)` block (blog-service.ts line 127); never re-index when only metadata changed.
- **Single doc traversal** — piggyback link collection on the existing `extractPlainText` walk (don't traverse the JSON twice for word-count then links).
- **Skip the work** when no link mark carries a `postId`.
- **Concurrency:** the delete+insert runs in one transaction; key it to the post's `updatedAt` so a stale interleaved autosave (debounce + manual save, multi-tab) drops rather than corrupts the row set.
- **Autosave reality:** `BlogEditorPage.tsx` autosaves on a 1500ms debounce; the re-index + (for published posts) the render-time `SELECT` sit on this hot path, so the gating above is mandatory, not optional. Consider deferring the re-index off the synchronous save response if profiling shows latency.

### Render-time slug resolution + dangling handling
`renderHTML` is pure/sync and cannot hit the DB, so resolution lives in `renderBodyHtml(body)`: walk JSON → collect all `postId`s → one batched `SELECT post_id, slug, status, deleted_at FROM blog_posts WHERE post_id = ANY($1)` → rewrite each internal anchor's `href` to the **current** `/blog/<slug>`. If the target is deleted/unpublished, **drop the mark** (render plain text) so the public page never emits a broken link. Runs only where `body_html` is produced: `setPostStatus` (publish) and `updatePost`-of-already-published (lines 132-134 / 153-155).

### Sanitizer + parity (XSS-safe rewrite — corrected)
`blog-render.ts` `SANITIZE_OPTS` (the sole XSS boundary):
1. Add `'data-post-id'` to `allowedAttributes.a` (else sanitize-html strips it).
2. Replace `transformTags.a` (currently `sanitizeHtml.simpleTransform('a', { rel:'noopener noreferrer nofollow', target:'_blank' })`, line 40) with a **function** transform. **Critical XSS fix:** the internal branch must **not trust the author-supplied `href`** — the blog is fully public/untrusted, so an author can hand-write `<a data-post-id=… href="javascript:…">`. The internal (no-`nofollow`, same-tab, no `target=_blank`) treatment applies **only after the render-time pass has replaced `href` with a server-generated relative `/blog/<resolved-slug>` keyed to a VALID resolved `post_id`**. Anchors whose `postId` did not resolve, or any anchor without a server-confirmed internal href, fall through to the existing external rewrite (`_blank` + `nofollow`). `allowedSchemes` still blocks `javascript:`, but the rel/target exemption must not key off mere attribute presence.
3. Parity: node/mark SET unchanged → `tiptap-schema.test.ts` untouched, but the `Link.extend` mirror is mandatory.

**Autolink interaction (noted):** `autolink: true` (line 31) means pasted raw URLs become `link` marks with **no `postId`** → they correctly fall to the external branch. A pasted `/blog/<slug>` URL is therefore **not** treated as an internal reference and gets **no** backlink row; only the picker creates true references. This is intended and should be documented for authors.

### Backlinks display
- Add a `backlinks` field to `GET /api/blog/by-slug/:slug` via the existing `Promise.all` in `routes/posts.ts`. **Query shape (critique-driven):** a **single indexed JOIN** — `blog_post_links` ⨝ `blog_posts ON to_post_id = :postId AND from-post published AND deleted_at IS NULL`, bounded with a `LIMIT`. Must **not** repeat the in-memory 50-row scan anti-pattern of `getRelatedPosts` (blog-service.ts 248-255) or the per-series count loop in `listSeries`.
- Render a "Referenced by" section on `PublicBlogPostPage.tsx` near "Related posts," as real crawlable `<Link>`s with the post title as descriptive anchor + excerpt as context.
- Mirror in `blog-prerender.ts renderPostDocument` so bots see the two-way graph. Add the field to the `PostView` type + `blogApi.publicGetBySlug` mapping.

### Editor UX
Reuse the existing link affordance. Add a "Link to a post" control in `BubbleToolbar.tsx`/`EditorToolbar.tsx` opening a small searchable modal backed by **`GET /api/blog/posts/search?q=`** (admin-gated, returns `{postId,title,slug}` over published+draft). **Bounded query (critique-driven):** explicit `LIMIT` (e.g. 50), excludes `deleted_at IS NOT NULL`, and **excludes the current post being edited** so an author can't self-reference via the picker. On select: `setLink({ href: '/blog/'+slug, postId })`. Anchor text defaults to the selected text or the target title (never "click here") — satisfies Lighthouse/SEO descriptive-anchor guidance. Drafts are searchable but flagged "draft" in the list (decision below).

### SEO / structured data
1. **Internal references are crawlable, followable, same-tab `<a>`** with descriptive anchor text — the highest-value internal-link type for PageRank distribution and topical relevance (Google "Links best practices"; Yoast internal-linking; Semrush PageRank 2025). Directly mitigates orphan pages.
2. **Slug-history 301** protects external/bookmarked links on rename (MediaWiki "leave a redirect on move" pattern).
3. **Orphan-page report** from the links graph (published posts with zero inbound rows) — turns an invisible crawl-budget problem (Conductor/JEMSU) into a fixable checklist.

---

## 3. Series Improvements

| # | Improvement | What it is | Files | Migration | Parity | Effort | Priority | User value |
|---|---|---|---|---|---|---|---|---|
| S1 | Series JSON-LD + BreadcrumbList | Emit `BlogPosting.isPartOf → CreativeWorkSeries` (name/url/position) + `BreadcrumbList` (Blog › Series › Post) in both client head and crawler HTML. Thread `series {title,slug,position,totalParts}` through the by-slug envelope (or compute position from items index). | `frontend/src/features/blog/components/BlogPostHead.tsx`, `backend/src/features/blog/services/blog-prerender.ts`, `backend/src/features/blog/routes/posts.ts` | No | No | M | **P1 (Phase 0)** | Reliable series-relationship parsing; breadcrumb rich results; series index as a mini-pillar hub (topic-cluster SEO). |
| S2 | Series crawler-HTML + sitemap coverage | `/blog/series/:slug` is SPA-only and absent from sitemap. Add `renderSeriesDocument`, a crawler route, and series URLs in `seo.ts` sitemap (filter to series with ≥1 published post). **Route ordering (corrected):** register `/blog/series/:slug` **before** `/blog/:slug` (prerender.ts line 71) or it is shadowed (`slug='series'`). **`auth.ts` PUBLIC_ROUTES edit is REDUNDANT** — `isPublicRoute` prefix-matches `/blog/`, so `/blog/series/:slug` is already public. | `backend/src/features/blog/services/blog-prerender.ts`, `backend/src/features/blog/routes/prerender.ts`, `backend/src/features/blog/routes/seo.ts` | No | No | M | **P1 (Phase 0)** | Canonical, indexable series hub + sitemap presence; kills the orphan-hub gap. |
| S3 | Series grouping on blog index | `PublicBlogListPage.tsx` ignores series. Add a "Series · N parts" strip via a public series-list endpoint (extend `series.ts` with a public `GET /` returning series + published counts; reuse `listSeries` filtered to ≥1 published). | `frontend/src/features/blog/pages/PublicBlogListPage.tsx`, `frontend/src/features/blog/api/blog.ts`, `backend/src/features/blog/routes/series.ts`, `backend/src/features/blog/services/series-service.ts` | No | No | M | P2 | Stops series fragmenting the feed; signals depth/authority (Hashnode-style discovery). |
| S4 | Aggregate series reading time + completion progress | On series landing + in-post widget, sum `readingTimeMinutes` ("~X min total") and show "Y of Z parts read" from localStorage. Pure presentation. | `frontend/src/features/blog/pages/PublicBlogSeriesPage.tsx`, `frontend/src/features/blog/pages/PublicBlogPostPage.tsx` | No | No | S | P2 | Readers commit ("finish in 2 sittings") and track progress; a differentiator no competitor ships at series level. |
| S5 | Per-part reading time + part numbering on landing rows | Add "N min read" per row (data already in `getPublicSeriesBySlug`); keep the numbered badge. | `frontend/src/features/blog/pages/PublicBlogSeriesPage.tsx` | No | No | S | P2 | Sets per-part expectations; cheap polish. |

---

## 4. Risks & Decisions

### Risks (mitigations folded into the plan)
- **`body_html` caching staleness (central weak point).** `body_html` is cached only at publish and on `updatePost`-of-published-when-body-changed. Renaming target B's slug, or unpublishing B, updates **nothing** in already-published referrer A's cached HTML until A is re-saved — so render-time slug resolution and dangling-degrade **do not reach untouched published referrers**, and stale/broken internal anchors can also leak into RSS `content:encoded` (seo.ts line 61) and prerender HTML. The `blog_post_links` join table is accurate (rebuilt on the *from*-post's save), but A's *rendered* HTML can still carry B's old slug. **This is why slug-history 301 is P0 and the fan-out is in core scope** (see decision 1).
- **XSS boundary.** The internal-link exemption must apply only to server-resolved relative hrefs keyed to a valid `post_id` — never trust the author's `href`. Land `blog-render.test.ts` cases (internal kept same-tab/no-nofollow; external still `_blank`+nofollow; `javascript:` on a `data-post-id` anchor blocked; dangling `postId` degrades to text) **before** anything depends on it.
- **Write amplification on autosave.** 1500ms debounce → re-index + render `SELECT` per pause. Mitigated by body-change gating, single-traversal piggyback, no-postId skip, transactional+`updatedAt`-keyed writes.
- **Stale index rows.** Soft-delete-only means `blog_post_links` is not self-cleaning; `softDeletePost` must purge `from`-side rows and queries must filter dangling `to`-side rows.
- **Route shadowing.** Register `/blog/series/:slug` before `/blog/:slug`.
- **Migration filenames.** Do **not** hardcode `0007`/`0008` — `pnpm db:new` derives the next index from `meta/_journal.json`. Follow the 0006 recipe (`db:new` → hand-write `CREATE TABLE/INDEX IF NOT EXISTS` → `db:schema:dump` → `db:drift` → commit `meta/_journal.json` + `schema.sql` together → apply live via `mcp__supabase-wrapper__apply_migration`).
- **Missing regression guards.** Add a test asserting the `Link.postId` attribute round-trips and that backend/frontend `Link.extend` stay byte-mirrored, plus the sanitizer cases above.
- **v1 limitations (accept & document):** PK dedupe collapses multiple in-body links to one backlink row (no count/context until the deferred `context` column); RSS/prerender can serve stale internal links until re-render.

### Decisions for the user

1. **Fan-out vs 301-only for slug-change staleness (the key trade-off).** Option A: on slug/publish-status change, re-render all published inbound referrers (looked up via `blog_post_links`) — fully correct, in-body links always live, but adds write-time fan-out cost. Option B: rely solely on the slug-history 301 — cheap, protects external links, but in-body internal `href`s stay stale in cache until the referrer is re-saved. **Recommendation: do both — 301 always (P0), plus a bounded fan-out for published referrers.** Confirm whether the fan-out runs synchronously or via the messaging outbox.
2. **One migration or two?** `blog_post_links` and `blog_post_slug_history` land together for the referencing+rename story. Either combine into one migration or keep separate — be explicit so `schema.sql` dump + drift check runs once per migration (don't batch and forget).
3. **Picker scope: published-only or published+draft?** Recommendation: allow drafts but flag "draft" in the list (a draft target degrades to plain text publicly until published).
4. **Series position source.** `getSeriesForPost` returns items + prev/next but no explicit numeric position in the envelope. Confirm threading `series {title,slug,position,totalParts}` vs computing position from the items array index for the JSON-LD.
5. **Editor "Referenced by N" count** — public-only for v1, or also a read-only author-facing count? (Recommendation: defer to P2 with the orphan report.)
6. **RSS** — confirm backlinks/references stay reader/crawler-page only (out of scope for RSS), accepting that stale cached HTML can leak dangling internal links into the feed until re-render.
7. **Unlinked mentions** (Obsidian-style full-text title scan) — confirmed **deferred** beyond this plan (needs full-text search over rendered text).