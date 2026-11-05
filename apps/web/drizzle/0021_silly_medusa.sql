ALTER TABLE "app"."content_reports" DROP CONSTRAINT "content_reports_single_target_check";--> statement-breakpoint
ALTER TABLE "app"."content_reports" ADD COLUMN "wish_id" text;--> statement-breakpoint
ALTER TABLE "app"."wishes" ADD COLUMN "is_hidden" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."wishes" ADD COLUMN "hidden_at" timestamp;--> statement-breakpoint
CREATE INDEX "content_reports_wish_id_idx" ON "app"."content_reports" USING btree ("wish_id");--> statement-breakpoint
CREATE UNIQUE INDEX "content_reports_pending_wish_reporter_unique" ON "app"."content_reports" USING btree ("reporter_id","wish_id") WHERE "app"."content_reports"."wish_id" is not null and "app"."content_reports"."status" = 'pending';--> statement-breakpoint
ALTER TABLE "app"."content_reports" ADD CONSTRAINT "content_reports_single_target_check" CHECK ((case when "app"."content_reports"."artwork_id" is null then 0 else 1 end + case when "app"."content_reports"."comment_id" is null then 0 else 1 end + case when "app"."content_reports"."wish_id" is null then 0 else 1 end) = 1);