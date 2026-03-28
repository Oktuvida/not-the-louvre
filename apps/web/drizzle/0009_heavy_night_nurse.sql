CREATE TYPE "app"."content_report_status" AS ENUM('pending', 'reviewed', 'actioned');--> statement-breakpoint
ALTER TABLE "app"."content_reports" ADD COLUMN "status" "app"."content_report_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."content_reports" ADD COLUMN "reviewed_by" text;--> statement-breakpoint
ALTER TABLE "app"."content_reports" ADD COLUMN "reviewed_at" timestamp;--> statement-breakpoint
ALTER TABLE "app"."content_reports" ADD CONSTRAINT "content_reports_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."content_reports" DROP CONSTRAINT "content_reports_artwork_id_artworks_id_fk";--> statement-breakpoint
ALTER TABLE "app"."content_reports" DROP CONSTRAINT "content_reports_comment_id_artwork_comments_id_fk";--> statement-breakpoint
CREATE INDEX "content_reports_status_idx" ON "app"."content_reports" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "content_reports_pending_artwork_reporter_unique" ON "app"."content_reports" USING btree ("reporter_id", "artwork_id") WHERE "artwork_id" is not null and "status" = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX "content_reports_pending_comment_reporter_unique" ON "app"."content_reports" USING btree ("reporter_id", "comment_id") WHERE "comment_id" is not null and "status" = 'pending';--> statement-breakpoint
ALTER TABLE "app"."content_reports" ADD CONSTRAINT "content_reports_review_resolution_check" CHECK (("status" = 'pending' and "reviewed_by" is null and "reviewed_at" is null) or ("status" <> 'pending' and "reviewed_by" is not null and "reviewed_at" is not null));--> statement-breakpoint
CREATE OR REPLACE FUNCTION "app"."apply_report_auto_hide"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
declare
	active_report_count integer;
begin
	if new.artwork_id is not null then
		perform pg_advisory_xact_lock(4201, hashtext(new.artwork_id));

		select count(*)
		into active_report_count
		from app.content_reports
		where artwork_id = new.artwork_id
			and status = 'pending';

		if active_report_count >= 3 then
			update app.artworks
			set is_hidden = true,
				hidden_at = coalesce(hidden_at, new.created_at),
				updated_at = greatest(updated_at, new.updated_at)
			where id = new.artwork_id
				and is_hidden = false;
		end if;
	end if;

	if new.comment_id is not null then
		perform pg_advisory_xact_lock(4202, hashtext(new.comment_id));

		select count(*)
		into active_report_count
		from app.content_reports
		where comment_id = new.comment_id
			and status = 'pending';

		if active_report_count >= 3 then
			update app.artwork_comments
			set is_hidden = true,
				hidden_at = coalesce(hidden_at, new.created_at),
				updated_at = greatest(updated_at, new.updated_at)
			where id = new.comment_id
				and is_hidden = false;
		end if;
	end if;

	return null;
end;
$$;