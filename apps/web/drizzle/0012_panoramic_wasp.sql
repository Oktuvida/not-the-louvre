CREATE TYPE "app"."artwork_nsfw_source" AS ENUM('creator', 'moderator');--> statement-breakpoint
CREATE TYPE "app"."moderation_text_policy_context" AS ENUM('nickname', 'comment', 'artwork_title');--> statement-breakpoint
CREATE TABLE "app"."moderation_text_policies" (
	"context" "app"."moderation_text_policy_context" PRIMARY KEY NOT NULL,
	"allowlist" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"blocklist" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."viewer_content_preferences" (
	"user_id" text PRIMARY KEY NOT NULL,
	"adult_content_enabled" boolean DEFAULT false NOT NULL,
	"adult_content_consented_at" timestamp,
	"adult_content_revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."artworks" ADD COLUMN "is_nsfw" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."artworks" ADD COLUMN "nsfw_source" "app"."artwork_nsfw_source";--> statement-breakpoint
ALTER TABLE "app"."artworks" ADD COLUMN "nsfw_labeled_at" timestamp;--> statement-breakpoint
ALTER TABLE "app"."users" ADD COLUMN "avatar_is_nsfw" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."users" ADD COLUMN "avatar_is_hidden" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."users" ADD COLUMN "is_banned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."users" ADD COLUMN "banned_at" timestamp;--> statement-breakpoint
ALTER TABLE "app"."users" ADD COLUMN "ban_reason" text;--> statement-breakpoint
ALTER TABLE "app"."moderation_text_policies" ADD CONSTRAINT "moderation_text_policies_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."viewer_content_preferences" ADD CONSTRAINT "viewer_content_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "moderation_text_policies_updated_by_idx" ON "app"."moderation_text_policies" USING btree ("updated_by");