import process from 'node:process';
import { defineConfig } from '@playwright/test';

export default defineConfig({
	use: {
		baseURL: 'http://localhost:4173'
	},
	workers: 1,
	webServer: {
		command:
			'set -a && [ -f .env ] && . ./.env || true && [ -f ../../.env.supabase ] && export $(grep -E "^(SUPABASE_PUBLIC_URL|ANON_KEY|JWT_SECRET|SUPABASE_SECRET_KEY|SERVICE_ROLE_KEY|PUBLIC_SUPABASE_URL|PUBLIC_SUPABASE_ANON_KEY|SUPABASE_ANON_KEY|SUPABASE_JWT_SECRET|ARTWORK_STORAGE_BUCKET)=" ../../.env.supabase | xargs) || true && set +a && PLAYWRIGHT=1 DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/postgres ORIGIN=http://127.0.0.1:4173 BETTER_AUTH_SECRET=playwright-secret-value-1234567890 bun run build && PLAYWRIGHT=1 DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/postgres ORIGIN=http://127.0.0.1:4173 BETTER_AUTH_SECRET=playwright-secret-value-1234567890 bun run preview -- --host 127.0.0.1 --port 4173',
		url: 'http://localhost:4173',
		reuseExistingServer: !process.env.CI
	},
	testMatch: '**/*.e2e.{ts,js}'
});
