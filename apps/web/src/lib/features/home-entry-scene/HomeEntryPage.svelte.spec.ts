import { page } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakePage } from '#lib/testing/fake-page-state.svelte.js';
import { render } from 'vitest-browser-svelte';
import HomeEntryPage from './HomeEntryPage.svelte';

// The scene mounts a Threlte `<Canvas>`, which the headless browser cannot give
// a WebGL context; the stub keeps the rest of the page mountable.
vi.mock('#lib/features/home-entry-scene/scene/StudioScene.svelte', async () => ({
	default: (await import('./components/StudioSceneStub.svelte')).default
}));

const navigation = vi.hoisted(() => ({ goto: vi.fn() }));

const setPageUrl = (href: string) => fakePage.set({ state: {}, url: href });

vi.mock('$app/navigation', async () => ({
	...(await import('#lib/testing/fake-navigation.js')).fakeNavigation,
	goto: navigation.goto
}));

vi.mock(
	'$app/state',
	async () => (await import('#lib/testing/fake-page-state.svelte.js')).fakeAppState
);

const warmup = vi.hoisted(() => ({
	cancel: vi.fn(),
	schedule: vi.fn()
}));

vi.mock('#lib/features/shared-ui/studio-background-warmup.js', () => ({
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
	// Cleared here rather than in `afterEach`: the library's own teardown
	// unmounts the previous page, and that unmount calls `warmup.cancel`.
	beforeEach(() => {
		warmup.cancel.mockClear();
		warmup.schedule.mockClear();
	});

	afterEach(() => {
		setPageUrl('http://localhost/');
		navigation.goto.mockClear();
	});

	it('lifts the shared grey veil when the visitor comes back from a room', async () => {
		// The veil is opaque from the first frame — the visitor is looking at the
		// scrim the room dropped, not at a page that fades one in.
		setPageUrl('http://localhost/?from=gallery');

		await render(HomeEntryPage, { entryState: 'inside' });

		const veil = page.getByTestId('page-fade-overlay');
		await expect.element(veil).toBeInTheDocument();

		// It has to leave on its own: gating it behind the entry state used to
		// strand half-onboarded visitors behind an opaque grey page.
		await vi.waitFor(
			() => {
				expect(document.querySelector('[data-testid="page-fade-overlay"]')).toBeNull();
			},
			{ timeout: 3000 }
		);

		await settlePrefetches();
	});

	it('warms the studio table background itself instead of leaving it to the root layout', async () => {
		const { unmount } = await render(HomeEntryPage, {});

		expect(warmup.schedule).toHaveBeenCalledTimes(1);

		await settlePrefetches();
		unmount();

		// A visitor who leaves before the idle callback fires never spends the
		// 109KB.
		expect(warmup.cancel).toHaveBeenCalledTimes(1);
	});

	it('prefetches the studio model and its DRACO decoder from the page that needs them', async () => {
		await render(HomeEntryPage, {});

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
