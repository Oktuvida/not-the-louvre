import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';

import RootLayoutHarness from './RootLayoutHarness.svelte';
import { SITE_NAME } from '$lib/features/shared-ui/site-meta';

const idleCallbacks: IdleRequestCallback[] = [];

const { imageInstances, pageState } = vi.hoisted(() => ({
	imageInstances: [] as Array<{ decoding: string; src: string }>,
	// The layout is the only place that renders <title>, so the error page's
	// status has to reach it through `page`.
	pageState: {
		data: {} as Record<string, unknown>,
		error: null as { message: string } | null,
		status: 200,
		url: new URL('https://not-the-louvre.art/')
	}
}));

vi.mock('$app/state', () => ({ page: pageState }));

const TrackingImage = class {
	decoding = '';
	#src = '';

	constructor() {
		imageInstances.push(this);
	}

	set src(value: string) {
		this.#src = value;
	}

	get src() {
		return this.#src;
	}
};

const renderRootLayout = () =>
	render(RootLayoutHarness, {
		data: {
			ambientAudioEnabled: false,
			favicon: { href: '/favicon.svg', kind: 'sketch' },
			viewer: null
		}
	});

describe('root layout', () => {
	beforeEach(() => {
		idleCallbacks.length = 0;
		imageInstances.length = 0;
		pageState.data = {};
		pageState.error = null;
		pageState.status = 200;

		vi.stubGlobal('Image', TrackingImage);
		vi.stubGlobal(
			'requestIdleCallback',
			vi.fn((callback: IdleRequestCallback) => {
				idleCallbacks.push(callback);
				return 1;
			})
		);
		vi.stubGlobal('cancelIdleCallback', vi.fn());
	});

	// The /table.avif warm-up belongs to the surfaces that lead to /draw (the
	// home page and the gallery's "Create Art" control), not to every route.
	it('does not warm the studio background from routes that may never reach /draw', () => {
		renderRootLayout();

		for (const callback of idleCallbacks) {
			callback({ didTimeout: false, timeRemaining: () => 1 } as IdleDeadline);
		}

		expect(imageInstances.map((image) => image.src)).not.toContain('/table.avif');
	});

	it('renders the shared document title and share-preview metadata', async () => {
		renderRootLayout();

		expect(document.title).toBe(SITE_NAME);

		const shareImage = document.head.querySelector('meta[property="og:image"]');
		const twitterCard = document.head.querySelector('meta[name="twitter:card"]');

		expect(shareImage?.getAttribute('content')).toBe('https://not-the-louvre.art/og-cover.png');
		expect(twitterCard?.getAttribute('content')).toBe('summary_large_image');
	});

	// `+error.svelte` has no `load` and so contributes no `meta`; without the
	// status the layout would title a 404 after whatever page.data still holds.
	it('titles an error page with its status', async () => {
		pageState.data = { meta: { title: 'Gallery' } };
		pageState.error = { message: 'Not found' };
		pageState.status = 404;

		renderRootLayout();

		expect(document.title).toBe(`404 · ${SITE_NAME}`);
	});

	it('preloads the two above-the-fold font faces with crossorigin', () => {
		renderRootLayout();

		const preloads = Array.from(
			document.head.querySelectorAll<HTMLLinkElement>('link[rel="preload"][as="font"]')
		);

		expect(preloads).toHaveLength(2);
		for (const preload of preloads) {
			expect(preload.getAttribute('crossorigin')).toBe('anonymous');
			expect(preload.getAttribute('type')).toBe('font/woff2');
		}
	});
});
