import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import HomeEntryPage from './HomeEntryPage.svelte';

// The scene mounts a Threlte `<Canvas>`, which the headless browser cannot give
// a WebGL context; the stub keeps the rest of the page mountable.
vi.mock('$lib/features/home-entry-scene/scene/StudioScene.svelte', async () => ({
	default: (await import('./components/StudioSceneStub.svelte')).default
}));

const warmup = vi.hoisted(() => ({
	cancel: vi.fn(),
	schedule: vi.fn()
}));

vi.mock('$lib/features/shared-ui/studio-background-warmup', () => ({
	scheduleStudioBackgroundWarmup: () => {
		warmup.schedule();
		return warmup.cancel;
	}
}));

const PREFETCHED_HREFS = [
	'/models/studio-transformed.glb',
	'/draco/draco_wasm_wrapper.js',
	'/draco/draco_decoder.wasm'
];

/*
 * The page's `<svelte:head>` prefetches are real requests in the browser
 * project, and the Playwright provider throws "Route is already handled" if one
 * is still in flight when the test tears the page down. Waiting for the three
 * resource entries keeps the suite off that race.
 */
const settlePrefetches = async () => {
	await vi.waitFor(
		() => {
			const loaded = performance.getEntriesByType('resource').map((entry) => entry.name);

			for (const href of PREFETCHED_HREFS) {
				expect(loaded.some((name) => name.endsWith(href))).toBe(true);
			}
		},
		{ timeout: 10000 }
	);
};

describe('HomeEntryPage', () => {
	it('warms the studio table background itself instead of leaving it to the root layout', async () => {
		const { unmount } = render(HomeEntryPage, {});

		expect(warmup.schedule).toHaveBeenCalledTimes(1);

		await settlePrefetches();
		unmount();

		// A visitor who leaves before the idle callback fires never spends the
		// 109KB.
		expect(warmup.cancel).toHaveBeenCalledTimes(1);
	});

	it('prefetches the studio model and its DRACO decoder from the page that needs them', async () => {
		render(HomeEntryPage, {});

		const prefetched = [...document.head.querySelectorAll('link[rel="prefetch"]')].map((link) =>
			link.getAttribute('href')
		);

		for (const href of PREFETCHED_HREFS) {
			expect(prefetched).toContain(href);
		}

		// Same-origin, no-CORS fetches: a `crossorigin` prefetch would land in a
		// second cache entry and download the decoder twice.
		expect(
			[...document.head.querySelectorAll('link[rel="prefetch"]')].some((link) =>
				link.hasAttribute('crossorigin')
			)
		).toBe(false);

		await settlePrefetches();
	});
});
