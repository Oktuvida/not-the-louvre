CREATE SCHEMA IF NOT EXISTS "app";--> statement-breakpoint
CREATE SCHEMA IF NOT EXISTS "better_auth";--> statement-breakpoint
ALTER SCHEMA "better_auth" OWNER TO postgres;--> statement-breakpoint
ALTER SCHEMA "app" OWNER TO postgres;--> statement-breakpoint
GRANT USAGE ON SCHEMA "app" TO postgres;--> statement-breakpoint
GRANT USAGE ON SCHEMA "better_auth" TO postgres;--> statement-breakpoint
ALTER TYPE "public"."auth_attempt_kind" SET SCHEMA "app";--> statement-breakpoint
ALTER TYPE "public"."user_role" SET SCHEMA "app";--> statement-breakpoint
ALTER TABLE "public"."account" SET SCHEMA "better_auth";--> statement-breakpoint
ALTER TABLE "public"."session" SET SCHEMA "better_auth";--> statement-breakpoint
ALTER TABLE "public"."user" SET SCHEMA "better_auth";--> statement-breakpoint
ALTER TABLE "public"."verification" SET SCHEMA "better_auth";--> statement-breakpoint
ALTER TABLE "public"."users" SET SCHEMA "app";--> statement-breakpoint
ALTER TABLE "public"."auth_rate_limits" SET SCHEMA "app";--> statement-breakpoint
ALTER TABLE "app"."users" DROP CONSTRAINT "users_nickname_lowercase_check";--> statement-breakpoint
ALTER TABLE "app"."users" ADD CONSTRAINT "users_nickname_lowercase_check" CHECK ("app"."users"."nickname" = lower("app"."users"."nickname"));--> statement-breakpoint
