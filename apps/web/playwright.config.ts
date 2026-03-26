import { defineConfig } from '@playwright/test';

export default defineConfig({
	webServer: {
		command: 'PLAYWRIGHT=1 bun run build && PLAYWRIGHT=1 bun run preview',
		port: 4173
	},
	testMatch: '**/*.e2e.{ts,js}'
});
