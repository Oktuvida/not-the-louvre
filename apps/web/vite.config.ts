import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';
import process from 'node:process';
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import { sveltekit } from '@sveltejs/kit/vite';
import { searchForWorkspaceRoot } from 'vite';

type VitestBrowserRunner = {
	wrapDynamicImport: <T>(moduleFactory: () => Promise<T>) => Promise<T>;
};

const globalWithVitestRunner = globalThis as typeof globalThis & {
	__vitest_browser_runner__?: VitestBrowserRunner;
};

globalWithVitestRunner.__vitest_browser_runner__ ??= {
	wrapDynamicImport: async <T>(moduleFactory: () => Promise<T>) => moduleFactory()
};

const workspaceRoot = searchForWorkspaceRoot(process.cwd());
const strokeJsonRuntimeRoot = resolve(workspaceRoot, 'packages/stroke-json-runtime');

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	// Build-time constant so Rollup dead-code-eliminates the Playwright-only
	// in-memory storage branches from the production worker. `bun run build:e2e`
	// runs with PLAYWRIGHT=1 (playwright.config.ts), `bun run build` never does,
	// so the deployed bundle can no longer be flipped by a stray Worker variable.
	define: {
		__PLAYWRIGHT__: JSON.stringify(process.env.PLAYWRIGHT === '1')
	},
	build: {
		rollupOptions: {
			// .wasm imports stay external so wrangler bundles them as
			// WebAssembly.Module entries (workerd forbids compiling from bytes).
			external: (id) => id.endsWith('.wasm')
		}
	},
	server: {
		fs: {
			allow: [workspaceRoot, strokeJsonRuntimeRoot]
		}
	},
	ssr: {
		noExternal: ['gsap', /^@not-the-louvre\/stroke-json-runtime(?:\/.*)?$/]
	},
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'client',
					browser: {
						enabled: true,
						provider: playwright(),
						instances: [{ browser: 'chromium', headless: true }]
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**']
				}
			},

			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
