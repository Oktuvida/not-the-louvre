ALTER TABLE "app"."users" ADD COLUMN "avatar_onboarding_completed_at" timestamp;--> statement-breakpoint
UPDATE "app"."users"
SET "avatar_onboarding_completed_at" = "created_at"
WHERE "avatar_onboarding_completed_at" IS NULL;--> statement-breakpoint
