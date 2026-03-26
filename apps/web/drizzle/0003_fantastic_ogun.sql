CREATE TABLE "app"."artwork_publish_rate_limits" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_key" text NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"window_started_at" timestamp NOT NULL,
	"last_attempt_at" timestamp NOT NULL,
	"blocked_until" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."artworks" (
	"id" text PRIMARY KEY NOT NULL,
	"author_id" text NOT NULL,
	"title" text NOT NULL,
	"storage_key" text NOT NULL,
	"media_content_type" text NOT NULL,
	"media_size_bytes" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "artworks_media_size_positive_check" CHECK ("app"."artworks"."media_size_bytes" > 0)
);
--> statement-breakpoint
ALTER TABLE "app"."artworks" ADD CONSTRAINT "artworks_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "artwork_publish_rate_limits_actor_key_unique" ON "app"."artwork_publish_rate_limits" USING btree ("actor_key");--> statement-breakpoint
CREATE INDEX "artwork_publish_rate_limits_blocked_until_idx" ON "app"."artwork_publish_rate_limits" USING btree ("blocked_until");--> statement-breakpoint
CREATE INDEX "artworks_author_id_idx" ON "app"."artworks" USING btree ("author_id");--> statement-breakpoint
CREATE UNIQUE INDEX "artworks_storage_key_unique" ON "app"."artworks" USING btree ("storage_key");