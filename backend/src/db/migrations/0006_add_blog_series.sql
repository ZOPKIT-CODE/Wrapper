-- 0006_add_blog_series
-- Series / collections: an ordered reading path. A post belongs to at most one
-- series via blog_posts.series_id + series_position.

CREATE TABLE IF NOT EXISTS blog_series (
  series_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title            VARCHAR(255) NOT NULL,
  slug             VARCHAR(255) NOT NULL,
  description      TEXT,
  cover_image_key  VARCHAR(500),
  created_at       TIMESTAMP NOT NULL DEFAULT now(),
  updated_at       TIMESTAMP NOT NULL DEFAULT now(),
  deleted_at       TIMESTAMP,
  created_by       UUID,
  updated_by       UUID
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_blog_series_pub_slug ON blog_series (slug) WHERE deleted_at IS NULL;

ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS series_id UUID REFERENCES blog_series(series_id);
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS series_position INTEGER;

CREATE INDEX IF NOT EXISTS idx_blog_posts_series ON blog_posts (series_id, series_position);
