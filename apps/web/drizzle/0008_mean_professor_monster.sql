CREATE OR REPLACE FUNCTION "app"."request_user_id"()
RETURNS text
LANGUAGE sql
STABLE
AS $$
	select nullif(
		coalesce(
			nullif(current_setting('request.jwt.claim.sub', true), ''),
			case
				when nullif(current_setting('request.jwt.claims', true), '') is null then null
				else current_setting('request.jwt.claims', true)::jsonb ->> 'sub'
			end
		),
		''
	);
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "app"."can_access_artwork_realtime"(target_artwork_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
	select exists(
		select 1
		from app.artworks artwork
		where artwork.id = target_artwork_id
			and (
				not artwork.is_hidden
				or artwork.author_id = app.request_user_id()
				or exists(
					select 1
					from app.users viewer
					where viewer.id = app.request_user_id()
						and viewer.role in ('moderator', 'admin')
				)
			)
	);
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION "app"."can_access_artwork_realtime"(text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "app"."can_access_artwork_realtime"(text) TO authenticated;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "app"."artwork_vote_delta"(vote_value "app"."artwork_vote_value")
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
	select case when vote_value = 'up' then 1 else -1 end;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "app"."sync_artwork_score"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
declare
	new_delta integer := 0;
	old_delta integer := 0;
begin
	if tg_op = 'INSERT' then
		update app.artworks
		set score = score + app.artwork_vote_delta(new.value),
			updated_at = greatest(updated_at, new.updated_at)
		where id = new.artwork_id;
		return null;
	end if;

	if tg_op = 'DELETE' then
		update app.artworks
		set score = score - app.artwork_vote_delta(old.value),
			updated_at = greatest(updated_at, old.updated_at)
		where id = old.artwork_id;
		return null;
	end if;

	new_delta := app.artwork_vote_delta(new.value);
	old_delta := app.artwork_vote_delta(old.value);

	if new.artwork_id = old.artwork_id then
		if new_delta <> old_delta then
			update app.artworks
			set score = score - old_delta + new_delta,
				updated_at = greatest(updated_at, new.updated_at)
			where id = new.artwork_id;
		end if;
		return null;
	end if;

	update app.artworks
	set score = score - old_delta,
		updated_at = greatest(updated_at, old.updated_at)
	where id = old.artwork_id;

	update app.artworks
	set score = score + new_delta,
		updated_at = greatest(updated_at, new.updated_at)
	where id = new.artwork_id;

	return null;
end;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS sync_artwork_score_trigger ON "app"."artwork_votes";
--> statement-breakpoint
CREATE TRIGGER sync_artwork_score_trigger
AFTER INSERT OR UPDATE OR DELETE ON "app"."artwork_votes"
FOR EACH ROW
EXECUTE FUNCTION "app"."sync_artwork_score"();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "app"."sync_artwork_vote_realtime"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
begin
	if tg_op = 'DELETE' then
		delete from app.artwork_vote_realtime where id = old.id;
		return null;
	end if;

	insert into app.artwork_vote_realtime as realtime (
		id,
		artwork_id,
		value,
		created_at,
		updated_at
	)
	values (
		new.id,
		new.artwork_id,
		new.value,
		new.created_at,
		new.updated_at
	)
	on conflict (id) do update
	set artwork_id = excluded.artwork_id,
		value = excluded.value,
		created_at = excluded.created_at,
		updated_at = excluded.updated_at;

	return null;
end;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS sync_artwork_vote_realtime_trigger ON "app"."artwork_votes";
--> statement-breakpoint
CREATE TRIGGER sync_artwork_vote_realtime_trigger
AFTER INSERT OR UPDATE OR DELETE ON "app"."artwork_votes"
FOR EACH ROW
EXECUTE FUNCTION "app"."sync_artwork_vote_realtime"();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "app"."comment_is_public"(is_hidden boolean)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
	select not coalesce(is_hidden, false);
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "app"."sync_artwork_comment_count"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
declare
	was_public boolean := case when tg_op = 'INSERT' then false else app.comment_is_public(old.is_hidden) end;
	is_public boolean := case when tg_op = 'DELETE' then false else app.comment_is_public(new.is_hidden) end;
begin
	if tg_op = 'UPDATE' and new.artwork_id <> old.artwork_id then
		if was_public then
			update app.artworks
			set comment_count = greatest(0, comment_count - 1),
				updated_at = greatest(updated_at, old.updated_at)
			where id = old.artwork_id;
		end if;

		if is_public then
			update app.artworks
			set comment_count = comment_count + 1,
				updated_at = greatest(updated_at, new.updated_at)
			where id = new.artwork_id;
		end if;

		return null;
	end if;

	if was_public = is_public then
		return null;
	end if;

	update app.artworks
	set comment_count = greatest(0, comment_count + case when is_public then 1 else -1 end),
		updated_at = greatest(updated_at, coalesce(new.updated_at, old.updated_at))
	where id = coalesce(new.artwork_id, old.artwork_id);

	return null;
end;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS sync_artwork_comment_count_trigger ON "app"."artwork_comments";
--> statement-breakpoint
CREATE TRIGGER sync_artwork_comment_count_trigger
AFTER INSERT OR UPDATE OR DELETE ON "app"."artwork_comments"
FOR EACH ROW
EXECUTE FUNCTION "app"."sync_artwork_comment_count"();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "app"."sync_artwork_comment_realtime"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
begin
	if tg_op = 'DELETE' then
		delete from app.artwork_comment_realtime where id = old.id;
		return null;
	end if;

	insert into app.artwork_comment_realtime as realtime (
		id,
		artwork_id,
		author_id,
		body,
		is_visible,
		created_at,
		updated_at
	)
	values (
		new.id,
		new.artwork_id,
		new.author_id,
		case when new.is_hidden then null else new.body end,
		not new.is_hidden,
		new.created_at,
		new.updated_at
	)
	on conflict (id) do update
	set artwork_id = excluded.artwork_id,
		author_id = excluded.author_id,
		body = excluded.body,
		is_visible = excluded.is_visible,
		created_at = excluded.created_at,
		updated_at = excluded.updated_at;

	return null;
end;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS sync_artwork_comment_realtime_trigger ON "app"."artwork_comments";
--> statement-breakpoint
CREATE TRIGGER sync_artwork_comment_realtime_trigger
AFTER INSERT OR UPDATE OR DELETE ON "app"."artwork_comments"
FOR EACH ROW
EXECUTE FUNCTION "app"."sync_artwork_comment_realtime"();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "app"."artwork_is_public"(is_hidden boolean)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
	select not coalesce(is_hidden, false);
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "app"."sync_parent_fork_count"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
declare
	was_public boolean := case when tg_op = 'INSERT' then false else app.artwork_is_public(old.is_hidden) end;
	is_public boolean := case when tg_op = 'DELETE' then false else app.artwork_is_public(new.is_hidden) end;
begin
	if tg_op = 'UPDATE' and new.parent_id is distinct from old.parent_id then
		if old.parent_id is not null and was_public then
			update app.artworks
			set fork_count = greatest(0, fork_count - 1),
				updated_at = greatest(updated_at, old.updated_at)
			where id = old.parent_id;
		end if;

		if new.parent_id is not null and is_public then
			update app.artworks
			set fork_count = fork_count + 1,
				updated_at = greatest(updated_at, new.updated_at)
			where id = new.parent_id;
		end if;

		return null;
	end if;

	if coalesce(new.parent_id, old.parent_id) is null then
		return null;
	end if;

	if was_public = is_public then
		return null;
	end if;

	update app.artworks
	set fork_count = greatest(0, fork_count + case when is_public then 1 else -1 end),
		updated_at = greatest(updated_at, coalesce(new.updated_at, old.updated_at))
	where id = coalesce(new.parent_id, old.parent_id);

	return null;
end;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS sync_parent_fork_count_trigger ON "app"."artworks";
--> statement-breakpoint
CREATE TRIGGER sync_parent_fork_count_trigger
AFTER INSERT OR UPDATE OR DELETE ON "app"."artworks"
FOR EACH ROW
EXECUTE FUNCTION "app"."sync_parent_fork_count"();
--> statement-breakpoint
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
		where artwork_id = new.artwork_id;

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
		where comment_id = new.comment_id;

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
--> statement-breakpoint
DROP TRIGGER IF EXISTS apply_report_auto_hide_trigger ON "app"."content_reports";
--> statement-breakpoint
CREATE TRIGGER apply_report_auto_hide_trigger
AFTER INSERT ON "app"."content_reports"
FOR EACH ROW
EXECUTE FUNCTION "app"."apply_report_auto_hide"();
--> statement-breakpoint
UPDATE "app"."artworks" artwork
SET score = coalesce((
		select sum(case when vote.value = 'up' then 1 else -1 end)
		from "app"."artwork_votes" vote
		where vote.artwork_id = artwork.id
	), 0),
	comment_count = coalesce((
		select count(*)
		from "app"."artwork_comments" comment
		where comment.artwork_id = artwork.id and comment.is_hidden = false
	), 0),
	fork_count = coalesce((
		select count(*)
		from "app"."artworks" child
		where child.parent_id = artwork.id and child.is_hidden = false
	), 0);
--> statement-breakpoint
INSERT INTO "app"."artwork_vote_realtime" (
	id,
	artwork_id,
	value,
	created_at,
	updated_at
)
SELECT id, artwork_id, value, created_at, updated_at
FROM "app"."artwork_votes"
ON CONFLICT (id) DO UPDATE
SET artwork_id = excluded.artwork_id,
	value = excluded.value,
	created_at = excluded.created_at,
	updated_at = excluded.updated_at;
--> statement-breakpoint
INSERT INTO "app"."artwork_comment_realtime" (
	id,
	artwork_id,
	author_id,
	body,
	is_visible,
	created_at,
	updated_at
)
SELECT
	id,
	artwork_id,
	author_id,
	case when is_hidden then null else body end,
	not is_hidden,
	created_at,
	updated_at
FROM "app"."artwork_comments"
ON CONFLICT (id) DO UPDATE
SET artwork_id = excluded.artwork_id,
	author_id = excluded.author_id,
	body = excluded.body,
	is_visible = excluded.is_visible,
	created_at = excluded.created_at,
	updated_at = excluded.updated_at;
--> statement-breakpoint
ALTER TABLE "app"."artwork_vote_realtime" REPLICA IDENTITY FULL;
--> statement-breakpoint
ALTER TABLE "app"."artwork_comment_realtime" REPLICA IDENTITY FULL;
--> statement-breakpoint
DO $$
begin
	if not exists (
		select 1
		from pg_publication_tables
		where pubname = 'supabase_realtime'
			and schemaname = 'app'
			and tablename = 'artwork_vote_realtime'
	) then
		alter publication supabase_realtime add table app.artwork_vote_realtime;
	end if;

	if not exists (
		select 1
		from pg_publication_tables
		where pubname = 'supabase_realtime'
			and schemaname = 'app'
			and tablename = 'artwork_comment_realtime'
	) then
		alter publication supabase_realtime add table app.artwork_comment_realtime;
	end if;
end;
$$;
--> statement-breakpoint
GRANT USAGE ON SCHEMA "app" TO authenticated;
--> statement-breakpoint
REVOKE ALL ON TABLE "app"."artwork_vote_realtime" FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON TABLE "app"."artwork_comment_realtime" FROM PUBLIC;
--> statement-breakpoint
GRANT SELECT ON TABLE "app"."artwork_vote_realtime" TO authenticated;
--> statement-breakpoint
GRANT SELECT ON TABLE "app"."artwork_comment_realtime" TO authenticated;
--> statement-breakpoint
ALTER TABLE "app"."artwork_vote_realtime" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "app"."artwork_comment_realtime" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "artwork_vote_realtime_authenticated_select" ON "app"."artwork_vote_realtime";
--> statement-breakpoint
CREATE POLICY "artwork_vote_realtime_authenticated_select"
ON "app"."artwork_vote_realtime"
FOR SELECT
TO authenticated
USING ("app"."can_access_artwork_realtime"(artwork_id));
--> statement-breakpoint
DROP POLICY IF EXISTS "artwork_comment_realtime_authenticated_select" ON "app"."artwork_comment_realtime";
--> statement-breakpoint
CREATE POLICY "artwork_comment_realtime_authenticated_select"
ON "app"."artwork_comment_realtime"
FOR SELECT
TO authenticated
USING ("app"."can_access_artwork_realtime"(artwork_id));
-- Custom SQL migration file, put your code below! --