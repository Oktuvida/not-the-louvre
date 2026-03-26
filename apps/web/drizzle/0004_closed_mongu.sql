CREATE TYPE "app"."artwork_vote_value" AS ENUM('up', 'down');--> statement-breakpoint
CREATE TYPE "app"."engagement_rate_limit_kind" AS ENUM('vote', 'comment');--> statement-breakpoint
CREATE TABLE "app"."artwork_comments" (
	"id" text PRIMARY KEY NOT NULL,
	"artwork_id" text NOT NULL,
	"author_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."artwork_engagement_rate_limits" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" "app"."engagement_rate_limit_kind" NOT NULL,
	"actor_key" text NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"window_started_at" timestamp NOT NULL,
	"last_attempt_at" timestamp NOT NULL,
	"blocked_until" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."artwork_votes" (
	"id" text PRIMARY KEY NOT NULL,
	"artwork_id" text NOT NULL,
	"user_id" text NOT NULL,
	"value" "app"."artwork_vote_value" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."artworks" ADD COLUMN "score" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."artworks" ADD COLUMN "comment_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."artwork_comments" ADD CONSTRAINT "artwork_comments_artwork_id_artworks_id_fk" FOREIGN KEY ("artwork_id") REFERENCES "app"."artworks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."artwork_comments" ADD CONSTRAINT "artwork_comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."artwork_votes" ADD CONSTRAINT "artwork_votes_artwork_id_artworks_id_fk" FOREIGN KEY ("artwork_id") REFERENCES "app"."artworks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."artwork_votes" ADD CONSTRAINT "artwork_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "artwork_comments_artwork_created_idx" ON "app"."artwork_comments" USING btree ("artwork_id","created_at","id");--> statement-breakpoint
CREATE INDEX "artwork_comments_author_id_idx" ON "app"."artwork_comments" USING btree ("author_id");--> statement-breakpoint
CREATE UNIQUE INDEX "artwork_engagement_rate_limits_kind_actor_unique" ON "app"."artwork_engagement_rate_limits" USING btree ("kind","actor_key");--> statement-breakpoint
CREATE INDEX "artwork_engagement_rate_limits_blocked_until_idx" ON "app"."artwork_engagement_rate_limits" USING btree ("blocked_until");--> statement-breakpoint
CREATE UNIQUE INDEX "artwork_votes_artwork_user_unique" ON "app"."artwork_votes" USING btree ("artwork_id","user_id");--> statement-breakpoint
CREATE INDEX "artwork_votes_artwork_id_idx" ON "app"."artwork_votes" USING btree ("artwork_id");--> statement-breakpoint
CREATE INDEX "artwork_votes_user_id_idx" ON "app"."artwork_votes" USING btree ("user_id");