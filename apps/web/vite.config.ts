import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import { sveltekit } from '@sveltejs/kit/vite';

type VitestBrowserRunner = {
	wrapDynamicImport: <T>(moduleFactory: () => Promise<T>) => Promise<T>;
};

const globalWithVitestRunner = globalThis as typeof globalThis & {
	__vitest_browser_runner__?: VitestBrowserRunner;
};

globalWithVitestRunner.__vitest_browser_runner__ ??= {
	wrapDynamicImport: async <T>(moduleFactory: () => Promise<T>) => moduleFactory()
};

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	ssr: {
		noExternal: ['gsap']
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
