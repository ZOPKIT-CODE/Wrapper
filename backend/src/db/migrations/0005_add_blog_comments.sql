-- 0005_add_blog_comments
-- Public blog comments with moderation. A comment is only shown publicly once
-- an admin sets status to 'approved'.

CREATE TABLE IF NOT EXISTS blog_comments (
  comment_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id       UUID NOT NULL REFERENCES blog_posts(post_id),
  author_name   VARCHAR(120) NOT NULL,
  author_email  VARCHAR(255),
  body          TEXT NOT NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'rejected', 'spam')),
  created_ip    VARCHAR(64),
  moderated_by  UUID,
  moderated_at  TIMESTAMP,
  created_at    TIMESTAMP NOT NULL DEFAULT now(),
  updated_at    TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blog_comments_post_status ON blog_comments (post_id, status);
CREATE INDEX IF NOT EXISTS idx_blog_comments_status ON blog_comments (status);
