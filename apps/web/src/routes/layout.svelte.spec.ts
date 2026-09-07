import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';

import RootLayoutHarness from './RootLayoutHarness.svelte';
import { SITE_NAME } from '$lib/features/shared-ui/site-meta';

const idleCallbacks: IdleRequestCallback[] = [];

const { imageInstances } = vi.hoisted(() => ({
	imageInstances: [] as Array<{ decoding: string; src: string }>
}));

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
