import adapter from '@sveltejs/adapter-cloudflare';
import { relative, sep } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import process from 'node:process';
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import { sveltekit } from '@sveltejs/kit/vite';
import { loadEnv, searchForWorkspaceRoot, type Plugin } from 'vite';

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

/**
 * Wrangler's platform proxy, which adapter-cloudflare starts behind
 * `cloudflare:workers` for `vite dev`, `vite preview` and vitest, refuses to start
 * unless the HYPERDRIVE binding has a local Postgres connection string, and reads
 * it only from process.env (never from `.env`). Point it at the DATABASE_URL the
 * app already uses, or at a placeholder where there is none: unit tests never
 * connect through it.
 */
const emulateHyperdriveFromDatabaseUrl = (mode: string): void => {
	const key = 'CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE';
	if (process.env[key]) return;
	process.env[key] =
		process.env.DATABASE_URL ??
		loadEnv(mode, process.cwd(), '').DATABASE_URL ??
		'postgres://placeholder:placeholder@127.0.0.1:5432/placeholder';
};

const routesDirectory = process.env.SVELTEKIT_ROUTES_DIR ?? 'src/routes';

/**
 * Component specs render artwork and avatar images whose URLs point at the app's
 * own server routes. Answering those from the test server would run the media
 * endpoints (and their WASM codecs) inside vitest, where an error's stack trace
 * crashes Vite 8's module runner and aborts the whole run. Component tests must
 * not depend on the backend anyway, so the browser test server answers them 404.
 */
const keepComponentTestsOffTheBackend: Plugin = {
	name: 'not-the-louvre:component-tests-off-the-backend',
	configureServer(server) {
		server.middlewares.use((request, response, next) => {
			if (!/^\/(api|avatars)\//.test(request.url ?? '')) return next();
			response.statusCode = 404;
			response.end();
		});
	}
};

export default defineConfig(({ mode }) => {
	emulateHyperdriveFromDatabaseUrl(mode);

	return {
		plugins: [
			tailwindcss(),
			sveltekit({
				compilerOptions: {
					// defaults to rune mode for the project, execept for `node_modules`. Can be removed in svelte 6.
					runes: ({ filename }) => {
						const relativePath = relative(import.meta.dirname, filename);
						const pathSegments = relativePath.toLowerCase().split(sep);
						const isExternalLibrary = pathSegments.includes('node_modules');

						return isExternalLibrary ? undefined : true;
					}
				},
				adapter: adapter(),
				files: { routes: routesDirectory }
			})
		],
		// Build-time constant so Rollup dead-code-eliminates the Playwright-only
		// in-memory storage branches from the production worker. `bun run build:e2e`
		// runs with PLAYWRIGHT=1 (playwright.config.ts), `bun run build` never does,
		// so the deployed bundle can no longer be flipped by a stray Worker variable.
		define: {
			__PLAYWRIGHT__: JSON.stringify(process.env.PLAYWRIGHT === '1')
		},
		build: {
			// Vite's 4KB default inlined eight Fontsource files as base64 data URIs
			// inside the render-blocking root stylesheet — 34KB raw / 24KB gz, 60%
			// of its gzipped weight, half of it legacy .woff twins no woff2-capable
			// browser will ever use. Fonts are always emitted as hashed assets now,
			// so they are fetched lazily and get their own long-lived cache entry;
			// returning undefined keeps the byte limit for everything else.
			assetsInlineLimit: (filePath: string) =>
				/\.(woff2?|ttf|otf)$/.test(filePath) ? false : undefined,

			rollupOptions: {
				// .wasm imports stay external so wrangler bundles them as
				// WebAssembly.Module entries (workerd forbids compiling from bytes).
				external: (id) => id.endsWith('.wasm')
			}
		},
		server: {
			fs: {
				allow: [workspaceRoot]
			}
		},
		ssr: {
			noExternal: ['gsap']
		},
		test: {
			expect: { requireAssertions: true },
			projects: [
				{
					extends: './vite.config.ts',
					plugins: [keepComponentTestsOffTheBackend],
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
	};
});
