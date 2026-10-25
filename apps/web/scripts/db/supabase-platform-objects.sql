-- Supabase-owned objects that the migration history references.
--
-- Hosted Supabase and the local `compose.yaml` stack create these before any
-- app migration runs: the `authenticated` role ships with supabase/postgres,
-- the `supabase_realtime` publication with the realtime service, and the
-- `storage.buckets` columns with storage-api's own migrations. A plain Postgres
-- (CI's service container, a throwaway local database) has none of them, so
-- 0008 (realtime grants and publication) and 0011 (bucket row) would fail.
--
-- This file recreates only what those migrations touch, idempotently, so the
-- SQL contract suites can run against vanilla Postgres. Never run it against
-- hosted Supabase or the compose stack: there the real objects already exist.
-- It also doubles as the inventory of the app's Supabase coupling in its
-- schema history.

do $$
begin
	if not exists (select 1 from pg_roles where rolname = 'authenticated') then
		create role authenticated nologin;
	end if;
end;
$$;

do $$
begin
	if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
		create publication supabase_realtime;
	end if;
end;
$$;

create schema if not exists storage;

create table if not exists storage.buckets (
	id text primary key,
	name text not null,
	public boolean default false,
	file_size_limit bigint,
	allowed_mime_types text[]
);
