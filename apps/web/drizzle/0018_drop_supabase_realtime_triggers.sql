-- Live updates moved to the realtime Worker's Durable Objects (apps/realtime),
-- so nothing reads the Supabase Realtime mirror tables any more. The triggers
-- that feed them go first: the next migration drops the tables, and a trigger
-- still writing into them would fail every vote and comment.
DROP TRIGGER IF EXISTS sync_artwork_vote_realtime_trigger ON "app"."artwork_votes";
--> statement-breakpoint
DROP TRIGGER IF EXISTS sync_artwork_comment_realtime_trigger ON "app"."artwork_comments";
--> statement-breakpoint
DROP FUNCTION IF EXISTS "app"."sync_artwork_vote_realtime"();
--> statement-breakpoint
DROP FUNCTION IF EXISTS "app"."sync_artwork_comment_realtime"();
--> statement-breakpoint
DROP POLICY IF EXISTS "artwork_vote_realtime_authenticated_select" ON "app"."artwork_vote_realtime";
--> statement-breakpoint
DROP POLICY IF EXISTS "artwork_comment_realtime_authenticated_select" ON "app"."artwork_comment_realtime";
--> statement-breakpoint
DROP FUNCTION IF EXISTS "app"."can_access_artwork_realtime"(text);
--> statement-breakpoint
DROP FUNCTION IF EXISTS "app"."request_user_id"();
--> statement-breakpoint
REVOKE USAGE ON SCHEMA "app" FROM authenticated;
