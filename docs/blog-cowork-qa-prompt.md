# END-TO-END TEST & REVIEW: Blog / Publishing Feature

You are an autonomous QA agent. Your job is to **end-to-end test the blog/publishing feature** of a web app using browser automation plus terminal/curl, then produce a **structured review with prioritized improvements**. Work methodically through every scenario below, capture evidence as you go, and only at the end assemble the deliverable. If something blocks you (servers down, not logged in, no admin token), pause and ask the user rather than guessing or faking results.

---

## 0. Context you need

**What the blog is.** This product has a public blog on its marketing site plus a company-admin authoring back office:
- **Public reader** (no login): a Medium-style blog at `/blog`, individual posts at `/blog/:slug`, tag archives at `/blog/tag/:tag`, series pages at `/blog/series/:slug`. Anyone can read and submit comments (comments are held for moderation).
- **Authoring (COMPANY-ADMIN ONLY):** a "Blog" tab inside the `/company-admin` dashboard, plus a full-page rich-text editor at `/company-admin/blog/new` and `/company-admin/blog/:postId/edit`. Used to write posts (Tiptap rich text), upload cover/inline images, manage tags, SEO metadata, series, publish/unpublish, soft-delete, and moderate comments.
- Content is authored as Tiptap/ProseMirror JSON and rendered to **sanitized** `body_html` server-side. **`sanitize-html` on the backend is the sole XSS boundary** — the public page renders the HTML with `dangerouslySetInnerHTML` and does NOT re-sanitize.
- **Re-render semantics (core correctness):** a **published** post re-renders `body_html` server-side on every body update; a **draft** leaves `body_html` null until first publish. The body is never exposed publicly while a post is a draft.
- The blog has **no tenant_id**; it is global/marketing content.
- **Permission model:** `ADMIN_BLOG_VIEW` gates admin reads (list/get); `ADMIN_BLOG_MANAGE` gates writes (create/update/publish/unpublish/delete/upload/moderate).

**Environment / URLs (local dev):**
- Frontend (the SPA you test in the browser): **http://localhost:3001**
- Backend API: **http://localhost:3000**
- Public reader pages: `http://localhost:3001/blog`, `/blog/:slug`, `/blog/tag/:tag`, `/blog/series/:slug`
- Admin authoring: `http://localhost:3001/company-admin` → "Blog" tab; editor at `/company-admin/blog/new`.
- Public blog API base: `http://localhost:3000/api/blog/...`
- SEO/crawler endpoints are served by the **backend** on port 3000: `http://localhost:3000/sitemap.xml`, `/rss.xml`, `/robots.txt`, and crawler-rendered `http://localhost:3000/blog/:slug`.

**Login expectations (read carefully — safety-critical):**
- The company-admin account is **letszopkit@gmail.com**. Auth is via Cognito.
- **You must NOT type or enter any password/credentials yourself.** Assume there is an already-logged-in admin session in the browser.
- If you reach an admin page and you are NOT logged in (you see a login screen or get redirected to sign-in), **STOP and ask the user to log in as the company admin, then continue.** Do not attempt to authenticate.
- **Authenticated direct API testing:** several authenticated write-API status-code contracts (Group F') can only be tested directly with a valid admin bearer token. **Do NOT forge, guess, or synthesize tokens.** At the start, ask the user whether they can supply a valid admin bearer token for direct API contract testing. If they cannot, validate those contracts *indirectly* through the UI flows where possible and explicitly label the remaining authenticated status-code matrix as **"Not tested — no token."**

**Known dev caveats (do NOT report these as new bugs):**
- The backend dev AWS key is quarantined, so **uploaded cover/inline images may fail to DISPLAY** (S3 GetObject returns 403) in dev even though the **upload itself (PutObject) succeeds**. Image *display* failure in dev is **expected**. Note it only as a "known caveat confirmed," never as a defect. Image *upload* failing, or the wrong error handling around it, is still fair game.

---

## 1. Pre-flight: confirm the app is reachable

Before any testing:
1. From the terminal, check both servers respond:
   - `curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:3001/blog` (frontend)
   - `curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/blog/feed` (backend)
2. In the browser, open **http://localhost:3001/blog** and confirm the feed renders.
3. **If the frontend (3001) or backend (3000) is not reachable**, STOP and ask the user to start the dev servers (`pnpm dev` in both the `frontend` and `backend` directories), then resume. Do not fabricate results against a dead server.
4. Confirm there is at least one **published** post in the feed. If the feed is empty, you will need to author and publish a test post in the Authoring section (Section 3) before the reader scenarios can be fully exercised — sequence your work accordingly.

---

## 2. Build the canonical fixture post FIRST (pre-condition for most reader scenarios)

Several reader-styling and SEO scenarios silently assume rich pre-existing content. **Do not** degrade those assertions to "whatever happens to exist." Instead, up front (after confirming you are logged in as admin — see Group B), **author and publish one canonical "fixture" post** that exercises every block type, and reuse it throughout. The fixture post MUST contain:

- A Title and Subtitle, an Excerpt, at least 3 Tags, and a cover image.
- **Multiple H2 and H3 headings** (so TOC/scroll-spy can be exercised in A3), including **two H2s with identical text** (to probe the duplicate-heading-ID collision risk in A3).
- Bullet list and numbered list (nested, to test indent/dedent).
- A blockquote and a divider.
- A fenced **code block with a language** (e.g. `javascript`) AND a second code block **with no language** (degrade-gracefully check).
- Inline code, bold, italic, strikethrough.
- Links (at least one external).
- A 3×3 **table** with a header row.
- **All four callout variants** if reachable (info / success / warning / danger) — if only `info` is reachable via the UI, note that and include one info callout (this feeds B8).
- At least one inline image.

Also create **2–3 additional smaller published posts sharing a common tag** (so A2 prev/next + related posts, A5 tag pages, and the series scenarios in Group D have real data). Sequence: do Group B's "confirm logged in" + editor basics first, build these fixtures, then run the reader (Group A), SEO (Group E), and API (Group F) scenarios against them.

---

## 3. Tooling: use the right tier for each check

- **Browser automation** for everything in the SPA (reader pages, editor, admin dashboard, ⌘K search, scroll-spy, reading-progress bar, comment forms). Take screenshots at each meaningful state.
- **Terminal / curl** for: SEO endpoints (`sitemap.xml`, `rss.xml`, `robots.txt`), crawler-UA detection (sending `User-Agent: Googlebot` vs a real browser UA), API status-code checks (401/403/404/400), feed pagination bounds, SQL-injection probes on `tag`/`q` params, media-proxy traversal probes, SVG-upload rejection, and inspecting raw response headers (`curl -i`). Capture the raw output.
- **View-source / DevTools** for SEO head tags, JSON-LD, OG/Twitter meta, confirming sanitized HTML in the rendered post, and **grabbing the exact request body shape** before any API probe (do not copy request shapes from this prompt — read them off a real DevTools network request).
- Keep a running evidence log: for each scenario record Pass / Partial / Fail / Not tested, what you observed, and a pointer to the screenshot or pasted curl output.

---

## 4. Test scenarios

Work through these groups in order (after the fixture build in Section 2). For each numbered scenario, do the **steps**, compare against **expected**, and record the result + evidence. Where the inventory lists an expected style/behavior, spot-check it; you don't need pixel-perfect verification, but call out clear deviations.

### Group A — Public Blog Reader (browser, no login)

**A1. Blog feed (`/blog`).** Open `/blog`. Expect: published posts as Medium-style cards in reverse-chronological order, each with title, subtitle/excerpt, cover thumbnail, author byline, date, reading time, up to 3 tags; page title "Blog" + descriptive subtitle; a Search button showing a "⌘K" hint; skeleton loaders on initial load; an empty state ("No posts yet. Check back soon.") if there are zero posts. Cards are clickable.

**A2. Single post page (`/blog/:slug`).** Click a card (and also try navigating directly to a known slug). Expect: title, subtitle, cover image (full width, rounded), author byline with initials avatar, long-format date (e.g. "June 6, 2026"), reading time, rendered body HTML with correct typography (headings, lists, code blocks, blockquotes, tables, callouts), prev/next nav, related posts. Confirm a **reading-progress bar** (thin emerald line at the very top) that grows 0→100% as you scroll to the bottom.

**A3. Table of Contents + scroll-spy (desktop, lg+).** On the fixture post (multiple H2/H3 headings), on a wide viewport, confirm a sticky right-sidebar "On this page" list (H2 flush, H3 indented). Scroll and confirm the active heading highlights (emerald left border / emerald text) and updates in real time. Click a TOC entry and confirm it anchors to that heading. **Duplicate-heading probe:** the fixture has two H2s with identical text — confirm clicking each TOC entry anchors correctly and that scroll-spy does not break/jump (known risk: client-side heading-ID collision); record exactly what happens. Note: TOC should be **hidden** if the post has ≤1 heading, and hidden on mobile (<lg) — verify both.

**A4. Rendered article styling.** On the fixture post, eyeball the prose: H1/H2/H3 sizing, paragraph size/line-height, ul/ol markers, blockquote left-border + italic, fenced code block (light gray bg, rounded, horizontal scroll), inline code chip, green underlined links, images max-width 100% rounded, tables with bordered cells + shaded header, and callouts in the four variants (info=blue, success=green, warning=orange/amber, danger=red — whichever are reachable). Confirm **code syntax highlighting** (highlight.js github-light) is applied to the language-tagged code block; confirm the **no-language** block degrades gracefully.

**A5. Tag page (`/blog/tag/:tag`).** Click a tag (or visit `/blog/tag/<known-tag>`). Expect: page title "#<tag> — Blog", an "All posts" breadcrumb, the tag as an uppercase heading, matching posts as cards. Then visit `/blog/tag/nonexistent-tag` and confirm the empty state ("No posts tagged …").

**A6. Series page (`/blog/series/:slug`).** Visit a series page (create one in Group D if none exists). Expect: series title as H1 with "Series" label, optional description, optional cover image, an **ordered numbered list** of published posts (each with title + excerpt, clickable). Then visit `/blog/series/nonexistent-series` and confirm the "Series not found" error state with a "Back to the blog" button.

**A7. Search command palette (⌘K / Ctrl+K).** On any blog page press ⌘K (Mac) / Ctrl+K. Expect a modal with a "Search posts…" input. Type 1 char → "Type at least 2 characters…". Type 2+ chars matching a known post → server-side results grouped under "Posts" showing title + excerpt. Press Enter / click a result → navigates to the post and closes the modal. Search a nonsense string → "No posts found."

**A8. Marketing chrome.** Confirm the standard marketing navbar (logo, nav links, CTA) at top and the marketing footer at bottom on all public blog pages, consistent with the rest of the marketing site.

**A9. Reader edge / empty / error states.** Verify: `/blog/nonexistent-slug` → "Post not found. It may be unpublished or removed." with a "Back to the blog" button (no hard 404 navigation). Post with no cover image → renders cleanly with no broken-image placeholder. Post with no author → byline shows date + reading time only. **Invalid/missing image key →** open a post whose cover/inline image key is invalid or whose S3 object is missing and confirm the page renders cleanly with a graceful broken-image edge case (distinguish this from the known dev S3-403 caveat).

### Group B — Authoring / Editor (browser, COMPANY-ADMIN; confirm logged in first)

> Before this group: open `/company-admin`. If you see a sign-in screen, STOP and ask the user to log in as letszopkit@gmail.com, then continue. (Do the fixture build from Section 2 immediately after confirming login.)

**B1. Open the editor.** `/company-admin` → "Blog" tab → "New post". Expect the full-page `BlogEditorPage`: sticky header with Back + save state, Title/Subtitle fields, a collapsible "SEO & metadata" section, cover-image uploader, Tiptap editor (toolbar + bubble menu + insert menu), word-count/reading-time in the header (hidden on mobile).

**B2. Core fields + slug auto-gen.** Enter a Title (e.g. "QA E2E Test Post"); add a Subtitle. Open "SEO & metadata" and confirm Excerpt, Slug, Tags, Series, Meta Title, Meta Description, and a "Hide from search engines (noindex)" toggle. Leave Slug blank and confirm it auto-generates from the title on save. Add comma-separated Tags (e.g. `product, engineering`). Confirm the **SEO completeness hint** lists missing items (it should treat excerpt OR meta-description as satisfying one requirement; also wants cover image + tags).

**B2a. Slug auto-uniquification / collision.** Create a **second** post with the **same title** as an existing post and confirm the second slug is auto-suffixed (`-2`, then `-3`, …) rather than colliding. Repeat the same for **series** (two series, identical titles → second gets `-2`). Note as a **known risk** (do not try to force it) the concurrent-create race where two simultaneous creates can hit the UNIQUE constraint and surface a 500, and that `generateUniqueSlug` bails after 1000 iterations.

**B2b. Non-ASCII / unicode slug generation.** Create a post titled with diacritics / non-ASCII (e.g. "Café Déjà-Vu 日本語") and record how the slug is generated (kebab-case transliteration vs stripped vs empty). Flag any i18n weakness.

**B3. Save draft + autosave.** Click "Save draft" to create the post (autosave only kicks in **after** the post exists). Then edit the body and wait ~1.5s; confirm a "Saving…" indicator then a "Saved … ago" label that ticks. Confirm the URL/route now reflects an edit route with a postId. **Autosave robustness probe (known risk, observe — do not engineer data loss on real content):** note whether closing/navigating away during the pending ~1.5s autosave window risks losing the last edit, and that concurrent edits are last-write-wins with no merge. Record as a documented probe/finding.

**B4. Tiptap marks + blocks.** In the editor, exercise: **Bold / Italic / Strikethrough / inline Code** (via toolbar AND by selecting text to bring up the bubble menu; try keyboard shortcuts Cmd+B / Cmd+I). **H2 / H3** headings. **Bullet & numbered lists** (Enter for new item, Tab/Shift+Tab to indent/dedent). **Blockquote**. **Divider** (renders Medium-style "• • •"). **Links** (toolbar/bubble → URL prompt; confirm green underlined link with `target=_blank rel="noopener noreferrer nofollow"`; empty URL removes the link). Note: the link prompt uses `window.prompt()` — handle the native dialog via your browser automation, and note the prompt-based UX as not mobile-friendly (known risk).

**B5. Code block + syntax highlight.** Insert a code block (toolbar, or type ```` ```javascript ````) and paste a few lines of code. Confirm syntax highlighting renders and the block has the expected shaded background / horizontal scroll. Also insert a code block **with no language** and confirm graceful degradation.

**B6. Images.** Click the Image toolbar button and upload a JPG/PNG (also try drag-and-drop and paste if feasible). Confirm the upload network call to `/blog/uploads?kind=inline` (or `?kind=cover` for the cover uploader) **succeeds** and an `<img>` is inserted. **Remember the known caveat:** the image may not visually render in dev (S3 GetObject 403) — that is expected; confirm the *upload* succeeded and report the display failure only as the known caveat. Also confirm the cover-image uploader (dashed "Add a cover image" → Replace/× controls) accepts a JPG/PNG. Note whether **alt text** is editable (known limitation: image alt defaults to the filename and is not editable) — flag as a finding/improvement, not a hard bug.

**B7. Phase-3 Tables.** Insert a table (toolbar Table icon → 3×3 with a header row). Click into the table and confirm the **contextual TableControls bar appears only while the caret is inside the table**. Exercise: +Col, +Row, Toggle Header, −Col, −Row, Merge Cells, Split Cell, and Delete Table (red). Confirm the table renders with bordered cells and a shaded header row, and that controls **disappear** when the caret leaves the table.

**B8. Phase-3 Callouts + variant reachability.** Insert a Callout (toolbar/InsertMenu). Confirm it creates an **info** (blue) callout by default and can contain text/blocks. **Explicitly determine whether the success / warning / danger variants are reachable at all via the UI** (known limitation: there is currently no UI to change the callout type after insertion). Record the definitive answer (e.g. "only info reachable") as a finding, and feed it back into the fixture (Section 2) and A4.

**B9. Word count / reading time.** Type/paste enough content and confirm the header shows "{N} words · {M} min read", updating as you edit. Sanity-check that the reading-time number is plausible (~words/200, min 1).

**B10. Publish / Unpublish / View + staleness edge cases.** Click **Publish**. Confirm the post becomes published, a "View" external link and an "Unpublish" button appear, and the public URL `/blog/<slug>` now serves the post (open it in a new tab). Then click **Unpublish** and confirm the public page now 404s / shows "Post not found" on refresh. **Cached-render-then-refresh edge case:** with the public post already open, unpublish it from admin, then confirm the already-rendered tab may still show cached data but a **refresh** yields 404 / "Post not found." Re-publish for downstream tests if needed.

**B11. Draft-vs-published body re-render (core correctness).** On a **published** post, edit the body, save, then reload the public `/blog/<slug>` and confirm the change is reflected (server re-rendered `body_html`). Separately, create a **draft** post and confirm its body is **never** exposed publicly (no public `/blog/<slug>`, absent from feed/search) until first publish — i.e. draft `body_html` stays null until publish.

**B12. Soft-delete lifecycle.** On a **self-created** test post, use the post-row Edit/Delete UI to **Delete** it. Confirm: it disappears from the **public** feed, `by-slug`, search, `sitemap.xml`, and `rss.xml`; it remains visible in the **admin** list (soft delete sets `deletedAt`, not a hard delete); and a **second** delete of the same post returns 404 / is rejected. Only delete posts you created.

**B13. Future-dated & archived exclusion.** If the editor allows setting a future `publishedAt` (or note via API behavior), confirm a **future-dated** published post is **excluded** from the public feed/by-slug/sitemap/rss until its time arrives (only `status=published AND publishedAt<=now` is served). Likewise confirm an **archived**-status post → public `/blog/<slug>` 404. Label as "Not tested — no UI/token" if you cannot set these states.

**B14. ADVERSARIAL XSS-strip test (P0-critical).** In the editor, author/paste content designed to smuggle script — e.g. a `<script>alert(1)</script>` snippet, an `<img src=x onerror=alert(1)>`, a `javascript:` link, and an `<iframe>`/`<object>` and `style="..."`-based payload. Save and **publish**, then open the public `/blog/<slug>` page and **view source / inspect the rendered `.blog-prose` HTML**. **Expected:** the server-side sanitizer strips `<script>`, event-handler attributes, dangerous URL schemes, and disallowed tags; no alert fires and nothing script-y survives in the DOM. If any payload survives into the public page, that is a **P0 security finding** — capture the exact surviving markup.

### Group C — Comments moderation lifecycle (browser; spans public + admin)

**C1. Submit a public comment.** On a published post, scroll to "Comments". Confirm the count in the heading and the approved-comments list (oldest-first), plus a "Leave a comment" form. Submit a comment with Name + body (email optional). Expect: button shows a spinner, then a success toast "Comment submitted — it will appear once approved." and the comment does **not** yet appear publicly.

**C2. Comment form validation.** Try submitting with empty Name and/or empty body (and whitespace-only) → expect a validation/toast error, no submission. Confirm client-side max-length attrs (name ≤120, comment ≤5000). Confirm the email field, if shown, is labeled as not publicly shown.

**C2a. Server-side truncation & content-safety (API).** First inspect a real comment submit in DevTools to learn the exact request shape (it submits `postId`, `authorName`, `authorEmail`, `body` — NOT `slug`). Then via API submit a comment with **name > 120**, **email > 255**, and **body > 5000** chars and confirm the backend **silently truncates** (authorName→120, authorEmail→255, body→5000) with **no error surfaced to the user** — record this as a finding (silent truncation). Also submit a comment containing **Unicode/emoji/RTL text and control characters** plus inline HTML/`<script>`, approve it, and confirm it renders as **escaped plain text** with whitespace preserved and **no HTML execution**.

**C3. Moderation queue (admin).** `/company-admin` → Blog → "Comments" subtab. Confirm a "pending count" badge on the tab, and that the comment you submitted in C1 appears newest-first with author name, (email if given), timestamp, and post-title context. Empty state should read "Nothing to review."

**C4. Approve → appears publicly.** Click **Approve** on your test comment. Confirm it leaves the queue, then reload the public post and confirm the comment now appears in the approved list with author name, short date, and body (plain text, whitespace preserved, no HTML execution).

**C5. Reject / Spam.** Submit two more test comments; in the queue **Reject** one and mark the other **Spam**. Confirm both leave the queue and neither appears on the public post. (These are non-destructive moderation actions and are fine to perform on your own test comments.)

**C6. Comment on unpublished / deleted post + queue context.** Confirm a comment cannot be submitted against an unpublished/nonexistent post (via the public form on a post you then unpublish, or note backend behavior). **Then:** submit a comment on a published post, then **delete/unpublish that post**, and confirm the comment **still appears in the moderation queue but with null/empty post-title context** (inventory edge case) — record exactly what the queue shows.

**C7. Moderation audit-trail & concurrency (probe/finding).** Note whether per-action moderation metadata (`moderatedBy` / `moderatedAt`) is set on approve/reject/spam, and that `moderatedBy` is **null** when the auth context lacks a userId (incomplete audit, action still proceeds) — flag the missing/incomplete per-action moderation audit log as a finding. Note that concurrent moderation of the same comment is expected to be idempotent (both succeed). These may be untestable without a token — label accordingly.

### Group D — Series lifecycle (browser, admin + public)

**D1. Create a series.** `/company-admin` → Blog → "Series" subtab. Enter a title (e.g. "QA Series") and create. Confirm an auto-generated slug, the series appears in the left list, is auto-selected, and the detail panel shows the empty-state hint about assigning posts via the editor.

**D2. Assign posts.** Open your published test post(s) in the editor → SEO & metadata → **Series** dropdown → select "QA Series". Confirm autosave persists it and the post then appears under the series detail card. Create/assign at least 2–3 posts so ordering is testable.

**D3. Reorder.** In the series detail, use the up/down arrows (first post's up disabled, last post's down disabled). Reorder, confirm a "Save order" button appears, click it, expect an "Order saved" confirmation and the new order persisting after reload.

**D4. Public series page + within-series nav.** Visit `/blog/series/<series-slug>` and confirm the ordered, numbered list of published posts. Open a post that's in the series and confirm: (1) a series **badge** near the title ("Series Name · Part X of Y") linking to the series page; (2) a within-series curriculum section listing all posts with the current one marked "you are here"; (3) prev/next links to adjacent series posts.

**D5. Detach + delete.** In one post's editor, set Series → "None" and confirm it detaches (no longer in the series list). Then in the Series tab, **Delete** "QA Series"; confirm the confirmation dialog explains posts are detached but kept, and after deletion the series disappears and its former posts still exist (just ungrouped). Treat the delete as acceptable since it's your own test series — but confirm the dialog wording matches before confirming.

### Group E — SEO / crawler endpoints (terminal / curl; backend port 3000)

Run these with curl and **paste the raw output** as evidence.

**E1. robots.txt.** `curl -i http://localhost:3000/robots.txt` → expect `text/plain`, `cache-control: public, max-age=3600`, body with `User-agent: *`, `Allow: /`, and a `Sitemap:` line.

**E2. sitemap.xml.** `curl -i http://localhost:3000/sitemap.xml` → expect `application/xml`, `cache-control: ... max-age=600`, a `<urlset>` with a `/blog` entry plus one `<url><loc>…</loc><lastmod>…</lastmod></url>` per published, non-noindex post. Pipe through `xmllint --format -` if available to confirm well-formed XML. Confirm noindex, draft, soft-deleted, future-dated, and archived posts are **absent**. Note the scale caps as a finding (no sitemap index/chunking; caps at 5000; >50k ignored by Google).

**E3. rss.xml.** `curl -i http://localhost:3000/rss.xml` → expect `application/rss+xml`, `max-age=600`, an RSS 2.0 `<channel>` titled "Blog" with `<item>`s (title, absolute link, guid, pubDate, description; optional `content:encoded`). Confirm noindex/draft/deleted/future/archived posts are excluded.

**E4. Crawler-UA server render (positive).** `curl -s -H 'User-Agent: Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' http://localhost:3000/blog/<published-slug>` → expect **200 HTML** (no redirect) containing: `<meta name="robots">`, `<meta name="description">`, `<link rel="canonical">`, OG tags (`og:type=article`, `og:title`, `og:description`, `og:url`, `og:image`), Twitter card tags, a `<script type="application/ld+json">` BlogPosting block, and an `<article>` with `<h1>` + a `<div class="prose">` of sanitized body HTML. Validate the JSON-LD (extract it and `jq .`); confirm `@type: BlogPosting`, `headline`, `url`, `mainEntityOfPage`, and date fields. **Note as a finding** that the JSON-LD has **no `author` object** and `og:type` is hardcoded `article`. Also `curl` the crawler-UA `/blog` **list** page → 200 HTML with up to 50 post cards, and confirm the list page emits `rel=canonical` to `{site}/blog`.

**E5. Crawler-UA negative (human) + BLOG_SITE_URL misconfig (first-class assertion).** `curl -i -H 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36' http://localhost:3000/blog/<slug>` → confirm behavior matches the loop-safe logic: if `BLOG_SITE_URL` is set and differs from the request host, expect a **302** to the public site; if same host or unset, expect a 200 static no-JS fallback. Note which branch you observed. **Then make an explicit pass/fail assertion:** inspect the crawler-rendered `canonical` / `og:url` / `og:image` URLs from E4 — if they point at `localhost`/an internal host (i.e. `BLOG_SITE_URL` unset/misconfigured), flag this as a **CRITICAL social-unfurl / canonical-leak risk** with a clear Fail.

**E6. noindex enforcement.** Create + publish a post with the **noindex** toggle ON (in the editor SEO section). Confirm it is **absent** from `sitemap.xml` and `rss.xml`, and that its crawler-rendered `/blog/<slug>` page emits `<meta name="robots" content="noindex,nofollow">`, while still being publicly readable (not a 404).

**E7. Cache + robots headers spot-check.** Confirm `cache-control` on each of the above: sitemap/rss `max-age=600`, robots `max-age=3600`, crawler `/blog/:slug` 200 → `public, max-age=300, s-maxage=600`, and 404 → `no-store` (test the 404 with a nonexistent slug under Googlebot UA). **Also check `X-Robots-Tag` on 404/500 responses** — known risk: its absence means crawlers may index 404 pages; flag if missing.

**E8. SPA head parity (browser).** Open a published post in the browser, View Source / inspect `<head>`, and confirm the React-rendered title/description/canonical/robots/OG/Twitter/JSON-LD mirror the server-rendered crawler version, with image URLs of the form `http://localhost:3000/api/blog/media/<encoded-key>`.

**E9. Social-image robustness edge case.** For a post whose `og:image`/`twitter:image` references an image that has been deleted from S3 (or whose key is invalid), confirm the prerender **still emits the URL** with no runtime validation (→ broken social card). Record as a finding (no image-existence validation at render time).

### Group F — API / auth security checks (terminal / curl; backend port 3000, anonymous)

**F1. Anonymous public reads succeed.** With **no auth header**: `GET /api/blog/feed`, `/api/blog/search?q=<term>`, `/api/blog/by-slug/<slug>`, `/api/blog/series/by-slug/<slug>`, `/api/blog/comments/by-slug/<slug>` → all **200**. Confirm `by-slug` returns 404 for an unpublished/deleted/nonexistent slug.

**F1a. Feed pagination bounds.** Probe `GET /api/blog/feed` with `?limit=0`, `?limit=999` (expect clamped to 1–50), `?limit=-5`, and `?offset=-10` (expect clamped to 0). Confirm no total-count is returned (a `hasMore`-style heuristic is used, not a count). Record the clamped values observed.

**F2. Admin endpoints reject anonymous.** With no auth header, `GET http://localhost:3000/api/blog` (admin list), `POST /api/blog`, `POST /api/blog/uploads`, `GET /api/blog/comments/pending` → expect **401** (or 403). Capture the status codes. **Do not** attempt to forge or supply tokens.

**F2a. Permission-granularity boundary (document the gap).** The backend distinguishes `ADMIN_BLOG_VIEW` (reads) from `ADMIN_BLOG_MANAGE` (writes). Testing the **VIEW-but-not-MANAGE** boundary requires a **second principal** (a view-only account). If no such account/token is available, explicitly record this as **"Not tested — needs a view-only account"** rather than silently omitting it. Do not fabricate.

**F3. Media proxy key whitelist + traversal.** `curl -i http://localhost:3000/api/blog/media/blog/cover/<...known-key>` → expect 200 with `content-type`, `cache-control: public, max-age=31536000`, and `cross-origin-resource-policy: cross-origin` (image bytes may 403 in dev per the known caveat — note that, but verify the **header/route** behavior). Then exercise the security boundary (`isServableBlogMediaKey` regex is the **sole** S3-scope boundary): each of the following MUST return **404** —
- `http://localhost:3000/api/blog/media/logo/whatever.png` (non-blog prefix)
- `http://localhost:3000/api/blog/media/../` and `…/blog/../logo/x` (path traversal)
- a **double-encoded** traversal (e.g. `%2e%2e%2f`)
- a key with a `blog/` prefix but an **invalid date / filename shape** (malformed key)

Capture each status. Any non-404 here that escapes the `blog/` scope is a **P0** finding (over-permissioned creds could expose configs/other S3 objects).

**F4. SVG / bad upload rejection.** This requires an authenticated admin session, so do it through the **editor UI** rather than curl: attempt to upload an **SVG** file as a cover/inline image and confirm it is rejected (SVG is excluded from the allowed MIME list); if you can observe the request, note the **400**. Also note (without necessarily forcing it) the documented behavior that files **>10 MB** are rejected.

**F5. Tag / search SQL-injection probes (P0-class).** The `tag` param on `GET /api/blog/feed` is injected into a `jsonb_exists` query with **no Zod validation on the route** (known risk). Send injection payloads and confirm **no SQL error, no data leak, no 500** —
- `curl -sS -i "http://localhost:3000/api/blog/feed?tag=%27%20OR%201%3D1--"` (URL-encoded `' OR 1=1--`)
- `curl -sS -i "http://localhost:3000/api/blog/feed?tag=%27%3B%20DROP%20TABLE%20blog_posts%3B--"`
- the same class of payloads against `GET /api/blog/search?q=...`

Expect a clean 200 with empty/normal results (no rows leaked, no DB error in the body/logs). A SQL error or anomalous data return is a **P0** finding. (If you have backend log access, check for SQL errors.)

**F6. Comment-submit on unpublished/fake post.** **First inspect a real comment submit in DevTools** to copy the exact request shape — the frontend submits `{ postId, authorName, authorEmail, body }` to `POST /api/blog/comments/submit` (it sends **`postId`, NOT `slug`**; do not copy the field names from this prompt blindly). Then replay that shape with a **fake/unpublished `postId`** → expect a **404 / `{ ok: false }`** and **no comment stored** (verify it does not appear in the moderation queue). Capture status + body.

### Group F' — Authenticated write-API contracts (ONLY with a user-supplied admin token; otherwise label "Not tested — no token")

These validate the backend status-code contracts directly. They require a **valid admin bearer token supplied by the user** (see Section 0). If no token is available, validate what you can **indirectly via the UI** (Groups B/C/D) and mark the rest **"Not tested — no token."** Never forge a token.

**F'1. Create contract.** `POST /api/blog` with a valid body → **201** + a generated `slug`. `POST /api/blog` with an invalid slug (failing the slug regex) → **400**.

**F'2. Update / re-render contract.** `PATCH /api/blog/:id` on a **published** post re-renders `bodyHtml`; on a **draft** leaves `bodyHtml` null. Confirm both.

**F'3. Publish / unpublish contract.** `POST /api/blog/:id/publish` sets/keeps `publishedAt` (re-publishing **preserves** the original `publishedAt`) and validates the publish status enum (invalid status → **400**). `POST /api/blog/:id/unpublish` on a **draft** is a **no-op** (no error). 

**F'4. Delete contract.** `DELETE /api/blog/:id` sets `deletedAt` and excludes from public; a **second** `DELETE` of the same id → **404**.

**F'5. Series CRUD + reorder contract.** Create/update/delete a series. `POST` reorder with **> 500 ids → 400**; an **invalid UUID → 400**; a `postId` **not in the series** → silent per-row no-op (no error). 

**F'6. Moderation contract.** Moderate a comment with an **invalid status value → 400**. Confirm `moderatedBy`/`moderatedAt` are set on a valid moderate (and `moderatedBy` is null if the token's auth context lacks a userId).

---

## 5. Safety boundaries (must follow)

- **Never enter credentials / passwords.** If an admin page shows a login screen, stop and ask the user to log in.
- **Never forge, guess, or synthesize auth tokens.** Use a real admin bearer token only if the user explicitly supplies one (Group F'); otherwise mark those contracts "Not tested — no token."
- **No destructive/irreversible actions** beyond the scoped test artifacts you created (your own test posts, comments, and the "QA Series"). Do **not** delete pre-existing real posts, real comments, or real series. When in doubt, ask first.
- Soft-delete, unpublish, reorder, and moderate are reversible/non-destructive on **your own** test artifacts and are fine to exercise.
- Treat the **image-display dev caveat** (S3 GetObject 403) as expected, not a bug.
- For SQL-injection and traversal probes, only send the read/no-op payloads above against the **local dev** backend; do not run destructive payloads against any non-local host.
- If any step would mutate production-looking data you didn't create, **pause and ask** before proceeding.
- Clearly label any test you could **not** complete (blocked on login, no token, no seed data, no second account) as "Not tested — blocked: <reason>" rather than guessing the outcome.

---

## 6. Deliverable (produce this at the end)

Assemble a single structured review with these sections, in order:

**1) Executive summary** — 3–6 sentences: overall health of the blog feature, how many scenarios passed/partial/failed/not-tested, and the single most important issue.

**2) Per-feature results table** — one row per scenario you ran (use the IDs above, A1…F'6). Columns:

| Feature (ID + name) | Status (Pass / Partial / Fail / Not tested) | Severity (P0 / P1 / P2 / n-a) | Repro steps | Evidence (screenshot ref / curl output / view-source quote) |

**3) What works** — concise bullet list of confirmed-working capabilities.

**4) Bugs, prioritized** — grouped P0 → P1 → P2. For each: title, affected feature ID(s), repro, observed vs. expected, evidence, and suggested fix area.
- **P0** = security (surviving XSS, successful SQL injection / tag-param leak, media-proxy traversal escaping the `blog/` scope, admin endpoint readable anonymously, canonical/OG URLs leaking localhost/internal host) or data loss.
- **P1** = broken core flow (re-render not happening, soft-delete leaking publicly, publish/unpublish/moderation broken).
- **P2** = minor/cosmetic.
- Explicitly note the confirmed **known caveats** (dev image display) and **documented known risks** (silent comment truncation, duplicate-heading-ID collision, autosave data-loss window, concurrent-create slug race, missing moderation audit log, no callout-type picker, non-editable alt text, no `X-Robots-Tag` on 404) separately so they aren't mistaken for newly introduced bugs — but still rank the ones that are genuine defects.

**5) UX / feature improvement suggestions, prioritized** — separate from bugs. Benchmark the experience against **Medium** and **Notion** and rank each **High / Medium / Low** by user impact vs. effort, with a one-line rationale. Cover, at minimum, these dimensions:
- **Accessibility (a11y):** keyboard-only navigation; focus management/trap in the ⌘K modal and comment form; ARIA roles/labels; color-contrast on emerald/slate text; screen-reader behavior of the TOC/scroll-spy and reading-progress bar; editable, meaningful image alt text (currently defaults to filename).
- **Performance / scale:** measure feed load time + payload size; the feed and public series page fetch **all** posts with no pagination (risk at 1000+ posts); sitemap caps at 5000 with no index/chunking; large-body first-publish render cost. Recommend pagination UI + sitemap index. (Seed/estimate a large dataset if feasible.)
- **Internationalization / locale:** dates hardcoded en-US in prerender (no locale awareness); slug generation from non-ASCII titles; RTL content handling.
- **Mobile / responsive (dedicated, not a footnote):** `window.prompt()` link UX is not mobile-friendly; no mobile TOC alternative for long-form; editor toolbar + table-controls responsiveness on small viewports.
- **SEO structured-data completeness:** add an `author` object to BlogPosting; reconsider hardcoded `og:type=article`; add an image sitemap; add a sitemap index/pagination; emit `X-Robots-Tag`.
- **Observability / error-surfacing:** image-upload failures are toast-only with no retry; autosave network errors are silently logged, not retried; prerender failures serve a generic fallback that can mask real bugs. Recommend surfacing + retry.
- **Anti-abuse / rate-limiting:** `createdIp` is collected but never used to block; no rate limit on comment-submit, search, or crawler endpoints; no CAPTCHA/honeypot on the public comment form. Recommend leveraging the already-collected IP + a honeypot.
- **Content-integrity / WYSIWYG parity:** editor CSS vs reader CSS are copy-pasted (callouts/tables/code), and the editor Tiptap schema vs the backend sanitizer allow-list can drift. Recommend a single shared source of truth for both.
- Plus the lighter items: callout-type picker in the toolbar, search debounce, feed pagination UI, accessible link-insert UI instead of `window.prompt`.

**6) Coverage notes** — what you could not test and why (blocked on login, no admin token, no view-only account for the VIEW/MANAGE boundary, missing seed data, dev caveat), so the gaps are explicit. Include any authenticated-API contracts (Group F') left as "Not tested — no token."

Keep evidence inline and specific (exact strings, status codes, surviving markup) — vague claims like "looks fine" are not acceptable. Begin now with Section 1 (pre-flight reachability), then ask the user (a) to log in as the company admin if any admin page shows a sign-in screen, and (b) whether they can supply a valid admin bearer token for the Group F' authenticated-API contracts. Do not fabricate results against a dead server, an unauthenticated session, or a missing token.
