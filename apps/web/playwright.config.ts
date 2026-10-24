import process from 'node:process';
import { defineConfig } from '@playwright/test';

// The e2e server uses DATABASE_URL when it is set (CI's Postgres service) and
// otherwise the compose Postgres that `bun run db:start` serves.
const databaseUrl =
	process.env.DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:55432/postgres';

// Runtime variables the Worker reads through `$app/env/private`.
const workerVariables = {
	BETTER_AUTH_SECRET: 'playwright-secret-value-1234567890',
	DATABASE_URL: databaseUrl,
	ORIGIN: 'http://127.0.0.1:4173'
};

export default defineConfig({
	use: {
		baseURL: 'http://localhost:4173',
		// Headless Chromium no longer falls back to software WebGL on its own, and
		// without a WebGL context the home scene throws before "Come In" can open
		// the auth overlay. SwiftShader stands in for the GPU real visitors have.
		launchOptions: { args: ['--enable-unsafe-swiftshader'] },
		trace: 'retain-on-failure'
	},
	workers: 1,
	webServer: {
		// The e2e build keeps the /demo routes and runs on workerd through `wrangler
		// dev`, the runtime production uses: adapter-cloudflare's build imports
		// `cloudflare:workers`, which Node cannot load, so `vite preview` is no option.
		// The second config is the realtime Worker, whose Durable Objects the web
		// Worker binds to; one `wrangler dev` runs both.
		command: `bun run build:e2e && wrangler dev -c wrangler.jsonc -c ../realtime/wrangler.jsonc --ip 127.0.0.1 --port 4173 ${Object.entries(
			workerVariables
		)
			.map(([key, value]) => `--var ${key}:${JSON.stringify(value)}`)
			.join(' ')}`,
		env: {
			// The build's analyse step imports the server modules, and Better Auth
			// checks its secret on import.
			...workerVariables,
			// Build time: swaps object storage for the in-memory store.
			PLAYWRIGHT: '1',
			// wrangler reads the local Hyperdrive stand-in only from the environment.
			CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE: databaseUrl,
			WRANGLER_SEND_METRICS: 'false'
		},
		url: 'http://localhost:4173',
		reuseExistingServer: !process.env.CI
	},
	testMatch: '**/*.e2e.{ts,js}'
});
