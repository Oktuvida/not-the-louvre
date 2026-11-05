-- Enough reports take a slip out of the mailbox, as they do an artwork or a comment.
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

	if new.wish_id is not null then
		perform pg_advisory_xact_lock(4203, hashtext(new.wish_id));

		select count(*)
		into active_report_count
		from app.content_reports
		where wish_id = new.wish_id
			and status = 'pending';

		if active_report_count >= 3 then
			update app.wishes
			set is_hidden = true,
				hidden_at = coalesce(hidden_at, new.created_at)
			where id = new.wish_id
				and is_hidden = false;
		end if;
	end if;

	return null;
end;
$$;
