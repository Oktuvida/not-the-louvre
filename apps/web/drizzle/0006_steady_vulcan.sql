CREATE TYPE "app"."artwork_report_reason" AS ENUM('spam', 'harassment', 'hate', 'sexual_content', 'violence', 'misinformation', 'copyright', 'other');--> statement-breakpoint
CREATE TABLE "app"."content_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"reporter_id" text NOT NULL,
	"artwork_id" text,
	"comment_id" text,
	"reason" "app"."artwork_report_reason" NOT NULL,
	"details" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "content_reports_single_target_check" CHECK ((case when "app"."content_reports"."artwork_id" is null then 0 else 1 end + case when "app"."content_reports"."comment_id" is null then 0 else 1 end) = 1)
);
--> statement-breakpoint
ALTER TABLE "app"."artwork_comments" ADD COLUMN "is_hidden" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."artwork_comments" ADD COLUMN "hidden_at" timestamp;--> statement-breakpoint
ALTER TABLE "app"."artworks" ADD COLUMN "is_hidden" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."artworks" ADD COLUMN "hidden_at" timestamp;--> statement-breakpoint
ALTER TABLE "app"."content_reports" ADD CONSTRAINT "content_reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."content_reports" ADD CONSTRAINT "content_reports_artwork_id_artworks_id_fk" FOREIGN KEY ("artwork_id") REFERENCES "app"."artworks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."content_reports" ADD CONSTRAINT "content_reports_comment_id_artwork_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "app"."artwork_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "content_reports_artwork_id_idx" ON "app"."content_reports" USING btree ("artwork_id");--> statement-breakpoint
CREATE INDEX "content_reports_comment_id_idx" ON "app"."content_reports" USING btree ("comment_id");--> statement-breakpoint
CREATE INDEX "content_reports_reporter_id_idx" ON "app"."content_reports" USING btree ("reporter_id");