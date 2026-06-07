-- 0007_add_blog_post_references
-- Article-to-article referencing.
--   blog_post_links        : derived reverse-link index (which posts link to which),
--                            rebuilt by parsing each post body on save. Never hand-maintained.
--   blog_post_slug_history : remembers a post's previous slugs so old URLs 301-redirect
--                            to the current slug after a rename (link rot protection).

CREATE TABLE IF NOT EXISTS blog_post_links (
  from_post_id  UUID NOT NULL REFERENCES blog_posts(post_id) ON DELETE CASCADE,
  to_post_id    UUID NOT NULL REFERENCES blog_posts(post_id) ON DELETE CASCADE,
  created_at    TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY (from_post_id, to_post_id),
  CONSTRAINT blog_post_links_no_self CHECK (from_post_id <> to_post_id)
);

CREATE INDEX IF NOT EXISTS idx_blog_post_links_to ON blog_post_links (to_post_id);

CREATE TABLE IF NOT EXISTS blog_post_slug_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID NOT NULL REFERENCES blog_posts(post_id) ON DELETE CASCADE,
  old_slug    VARCHAR(255) NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blog_post_slug_history_old_slug ON blog_post_slug_history (old_slug);
CREATE INDEX IF NOT EXISTS idx_blog_post_slug_history_post ON blog_post_slug_history (post_id);
