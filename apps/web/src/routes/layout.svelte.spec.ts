import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';

import RootLayoutHarness from './RootLayoutHarness.svelte';
import { SITE_NAME } from '#lib/features/shared-ui/site-meta.js';
import { STUDIO_DESK_IMAGE } from '#lib/features/shared-ui/studio-background-warmup.js';

const idleCallbacks: IdleRequestCallback[] = [];

const { imageInstances, pageState } = vi.hoisted(() => ({
	imageInstances: [] as Array<{ decoding: string; src: string; srcset: string }>,
	// The layout is the only place that renders <title>, so the error page's
	// status has to reach it through `page`.
	pageState: {
		data: {} as Record<string, unknown>,
		error: null as { message: string } | null,
		status: 200,
		url: new URL('https://not-the-louvre.art/')
	}
}));

// No release goes out while a spec runs.
vi.mock('$app/state', () => ({
	page: pageState,
	updated: { check: async () => false, current: false }
}));

const TrackingImage = class {
	decoding = '';
	srcset = '';
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

const renderRootLayout = (viewer: { id: string; isBanned: boolean; role: string } | null = null) =>
	render(RootLayoutHarness, {
		data: {
			ambientAudioEnabled: false,
			favicon: { href: '/favicon.svg', kind: 'sketch' },
			viewer
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

	// The studio desk's warm-up belongs to the surfaces that lead to /draw (the
	// home page and the gallery's "Create Art" control), not to every route.
	it('does not warm the studio background from routes that may never reach /draw', async () => {
		await renderRootLayout();

		for (const callback of idleCallbacks) {
			callback({ didTimeout: false, timeRemaining: () => 1 } as IdleDeadline);
		}

		expect(imageInstances.map((image) => image.srcset)).not.toContain(STUDIO_DESK_IMAGE.avif);
	});

	it('renders the shared document title and share-preview metadata', async () => {
		await renderRootLayout();

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

		await renderRootLayout();

		expect(document.title).toBe(`404 · ${SITE_NAME}`);
	});

	it('declares each house typeface once per subset, across its weights', async () => {
		await renderRootLayout();

		const faces = new Map<string, { range: string; src: string; weight: string }[]>();
		for (const sheet of Array.from(document.styleSheets)) {
			let rules: CSSRuleList;
			try {
				rules = sheet.cssRules;
			} catch {
				continue;
			}

			for (const rule of Array.from(rules)) {
				if (!(rule instanceof CSSFontFaceRule)) continue;
				const family = rule.style.getPropertyValue('font-family').replace(/["']/g, '');
				faces.set(family, [
					...(faces.get(family) ?? []),
					{
						range: rule.style.getPropertyValue('unicode-range').trim(),
						src: rule.style.getPropertyValue('src'),
						weight: rule.style.getPropertyValue('font-weight')
					}
				]);
			}
		}

		for (const [family, weights] of [
			['Baloo 2', '400 800'],
			['Caveat', '400 700'],
			['Fredoka', '300 700']
		] as const) {
			const declared = faces.get(family) ?? [];
			expect(
				declared.map(({ weight }) => weight),
				family
			).toEqual([weights, weights]);

			const latin = declared.find(({ src }) => /-latin-wght-/.test(src));
			const latinExt = declared.find(({ src }) => /-latin-ext-wght-/.test(src));
			expect(latin?.range, family).toMatch(/^U\+0-FF,/i);
			expect(latinExt?.range, family).toMatch(/^U\+100-2BA,/i);
		}
	});

	it('preloads the two above-the-fold font faces with crossorigin', async () => {
		await renderRootLayout();

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
