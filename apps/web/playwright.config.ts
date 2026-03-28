import process from 'node:process';
import { defineConfig } from '@playwright/test';

export default defineConfig({
	use: {
		baseURL: 'http://localhost:4173'
	},
	workers: 1,
	webServer: {
		command:
			'set -a && [ -f .env ] && . ./.env || true && POSTGRES_PASSWORD=$(grep -E "^POSTGRES_PASSWORD=" ../../.env.supabase | cut -d= -f2-) && POSTGRES_PORT=$(grep -E "^POSTGRES_PORT=" ../../.env.supabase | cut -d= -f2-) && POSTGRES_DB=$(grep -E "^POSTGRES_DB=" ../../.env.supabase | cut -d= -f2-) && set +a && PLAYWRIGHT=1 DATABASE_URL=postgres://postgres:${POSTGRES_PASSWORD}@127.0.0.1:${POSTGRES_PORT:-5432}/${POSTGRES_DB:-postgres} ORIGIN=http://127.0.0.1:4173 BETTER_AUTH_SECRET=playwright-secret-value-1234567890 bun run build && PLAYWRIGHT=1 DATABASE_URL=postgres://postgres:${POSTGRES_PASSWORD}@127.0.0.1:${POSTGRES_PORT:-5432}/${POSTGRES_DB:-postgres} ORIGIN=http://127.0.0.1:4173 BETTER_AUTH_SECRET=playwright-secret-value-1234567890 bun run preview -- --host 127.0.0.1 --port 4173',
		url: 'http://localhost:4173',
		reuseExistingServer: !process.env.CI
	},
	testMatch: '**/*.e2e.{ts,js}'
});
