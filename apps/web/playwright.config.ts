import process from 'node:process';
import { defineConfig } from '@playwright/test';

export default defineConfig({
	use: {
		baseURL: 'http://localhost:4173'
	},
	workers: 1,
	webServer: {
		command: 'PLAYWRIGHT=1 bun run build && PLAYWRIGHT=1 bun run preview -- --host 0.0.0.0',
		url: 'http://localhost:4173',
		reuseExistingServer: !process.env.CI
	},
	testMatch: '**/*.e2e.{ts,js}'
});
