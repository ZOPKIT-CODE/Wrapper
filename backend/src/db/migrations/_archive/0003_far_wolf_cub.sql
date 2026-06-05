ALTER TABLE "event_tracking" ADD COLUMN "retry_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "event_tracking" ADD COLUMN "last_retry_at" timestamp;--> statement-breakpoint
ALTER TABLE "event_tracking" ADD COLUMN "published_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "event_tracking" ADD COLUMN "acknowledged" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "event_tracking" ADD COLUMN "acknowledged_at" timestamp;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_tracking_published_at_idx" ON "event_tracking" ("published_at");