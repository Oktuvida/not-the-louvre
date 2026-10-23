import { existsSync, readFileSync } from 'node:fs';
import process from 'node:process';
import { defineConfig } from '@playwright/test';

// The e2e server uses DATABASE_URL when it is set (CI's Postgres service) and
// otherwise the local compose stack described by ../../.env.supabase, or by its
// committed example that `bun run db:start` copies on first boot.
const readSupabaseEnv = (): Record<string, string> => {
	const file = ['../../.env.supabase', '../../.env.supabase.example'].find((path) =>
		existsSync(path)
	);
	if (!file) return {};

	return Object.fromEntries(
		readFileSync(file, 'utf8')
			.split(/\r?\n/)
			.map((line) => /^([A-Z0-9_]+)=(.*)$/.exec(line.trim()))
			.filter((match) => match !== null)
			.map(([, key, value]) => [key, value.replace(/^['"]|['"]$/g, '')])
	);
};

const supabase = readSupabaseEnv();
const databaseUrl =
	process.env.DATABASE_URL ??
	`postgres://postgres:${supabase.POSTGRES_PASSWORD}@127.0.0.1:${supabase.POSTGRES_PORT ?? '5432'}/${supabase.POSTGRES_DB ?? 'postgres'}`;

export default defineConfig({
	use: {
		baseURL: 'http://localhost:4173',
		// Headless Chromium no longer falls back to software WebGL on its own, and
		// without a WebGL context the home scene throws before "Come In" can open
		// the auth overlay. SwiftShader stands in for the GPU real visitors have.
		launchOptions: { args: ['--enable-unsafe-swiftshader'] }
	},
	workers: 1,
	webServer: {
		command: 'bun run build:e2e && bun run preview -- --host 127.0.0.1 --port 4173',
		env: {
			PLAYWRIGHT: '1',
			DATABASE_URL: databaseUrl,
			// `vite preview` emulates the Worker bindings through wrangler, which
			// refuses to start unless the HYPERDRIVE binding has a local Postgres.
			CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE: databaseUrl,
			ORIGIN: 'http://127.0.0.1:4173',
			BETTER_AUTH_SECRET: 'playwright-secret-value-1234567890',
			SUPABASE_PUBLIC_URL: supabase.SUPABASE_PUBLIC_URL ?? '',
			ANON_KEY: supabase.ANON_KEY ?? '',
			JWT_SECRET: supabase.JWT_SECRET ?? ''
		},
		url: 'http://localhost:4173',
		reuseExistingServer: !process.env.CI
	},
	testMatch: '**/*.e2e.{ts,js}'
});
