-- 0004_add_blog_posts_table
-- Single-platform blog. Content system-of-record is the body column
-- (Tiptap/ProseMirror JSON). body_html is a sanitized derived cache
-- rendered on publish for the crawlable public reader.

CREATE TABLE IF NOT EXISTS blog_posts (
  post_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Fully public single-platform blog: no auth/tenant context.
  author_id            UUID REFERENCES tenant_users(user_id),

  title                VARCHAR(255) NOT NULL,
  slug                 VARCHAR(255) NOT NULL,
  subtitle             TEXT,
  excerpt              TEXT,
  body                 JSONB NOT NULL,
  body_html            TEXT,
  schema_version       INTEGER NOT NULL DEFAULT 1,

  cover_image_key      VARCHAR(500),
  cover_image_alt      TEXT,

  tags                 JSONB NOT NULL DEFAULT '[]'::jsonb,

  status               VARCHAR(20) NOT NULL DEFAULT 'draft'
                         CHECK (status IN ('draft', 'published', 'archived')),

  meta_title           TEXT,
  meta_description     TEXT,
  og_image_key         VARCHAR(500),
  seo_noindex          BOOLEAN NOT NULL DEFAULT FALSE,

  reading_time_minutes INTEGER,
  word_count           INTEGER,

  published_at         TIMESTAMP,
  created_at           TIMESTAMP NOT NULL DEFAULT now(),
  updated_at           TIMESTAMP NOT NULL DEFAULT now(),
  deleted_at           TIMESTAMP,

  created_by           UUID,
  updated_by           UUID
);

CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts (status);
CREATE INDEX IF NOT EXISTS idx_blog_posts_feed ON blog_posts (status, published_at);

-- Public namespace: a live (non-deleted) slug resolves to exactly one post.
CREATE UNIQUE INDEX IF NOT EXISTS uq_blog_posts_pub_slug
  ON blog_posts (slug)
  WHERE deleted_at IS NULL;
