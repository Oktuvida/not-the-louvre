ALTER TABLE "app"."artworks" ADD COLUMN "parent_id" text;--> statement-breakpoint
ALTER TABLE "app"."artworks" ADD COLUMN "fork_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "artworks_parent_id_idx" ON "app"."artworks" USING btree ("parent_id");--> statement-breakpoint
ALTER TABLE "app"."artworks" ADD CONSTRAINT "artworks_fork_count_non_negative_check" CHECK ("app"."artworks"."fork_count" >= 0);