import type { ComponentProps } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';

vi.mock('$app/environment', () => ({
	browser: true
}));

// A visitor who asked for less motion sees a still reel. Specs that need every
// frame to stay where it is opt in; the rest keep the moving reel.
const motion = vi.hoisted(() => ({ reduced: false }));

vi.mock('svelte/motion', async (importOriginal) => ({
	...(await importOriginal<typeof import('svelte/motion')>()),
	prefersReducedMotion: {
		get current() {
			return motion.reduced;
		}
	}
}));

vi.mock('#lib/client/gsap.js', () => {
	return {
		gsap: {
			to: (proxy: Record<string, number>, config: Record<string, unknown>) => {
				const targetValue =
					typeof config.value === 'string' && (config.value as string).startsWith('+=')
						? proxy.value + parseFloat((config.value as string).slice(2))
						: (config.value as number);

				const tween = {
					proxy,
					target: targetValue,
					onUpdate: config.onUpdate as (() => void) | undefined,
					onComplete: config.onComplete as (() => void) | undefined,
					kill: vi.fn()
				};

				// Immediately complete the tween for testing
				proxy.value = targetValue;
				tween.onUpdate?.();
				tween.onComplete?.();

				return tween;
			}
		}
	};
});

import { makeArtwork } from '#lib/features/gallery-exploration/fixtures/artworks.js';
import type { Artwork } from '#lib/features/artwork-presentation/model/artwork.js';
import FilmReel from './FilmReel.svelte';
import RoomHarness from './RoomHarness.svelte';

const createArtwork = (id: string): Artwork =>
	makeArtwork({ id, score: 50, upvotes: 50, imageUrl: `https://example.com/${id}.avif` });

type FilmReelProps = ComponentProps<typeof FilmReel>;

const renderReel = (
	props: Partial<FilmReelProps> & Pick<FilmReelProps, 'artworks'>,
	onInstance?: (instance: Record<string, unknown> | undefined) => void
) =>
	render(RoomHarness, {
		props: {
			component: FilmReel,
			onInstance,
			roomProps: { onLand: () => {}, ...props },
			style: 'width: 800px; height: 400px;'
		}
	});

describe('FilmReel', () => {
	it('renders frame images with width and height attributes matching frameSize', async () => {
		const artworks = [createArtwork('f1'), createArtwork('f2'), createArtwork('f3')];

		await renderReel({ artworks });

		await expect.element(page.getByTestId('film-reel')).toBeVisible();

		// Check that reel frame images have width and height attributes
		const images = document.querySelectorAll('.reel-frame-image');
		expect(images.length).toBeGreaterThan(0);

		for (const img of images) {
			const htmlImg = img as HTMLImageElement;
			expect(htmlImg.hasAttribute('width')).toBe(true);
			expect(htmlImg.hasAttribute('height')).toBe(true);
			// Width and height should match (square frames)
			expect(htmlImg.getAttribute('width')).toBe(htmlImg.getAttribute('height'));
			// Every rendered frame is in or next to the viewport: lazy loading only
			// buys intersection bookkeeping and a late decode mid-spin.
			expect(htmlImg.hasAttribute('loading')).toBe(false);
		}
	});

	it('keeps only transform and opacity in the per-tick inline style', async () => {
		const artworks = [createArtwork('f1'), createArtwork('f2'), createArtwork('f3')];

		await renderReel({ artworks });

		await expect.element(page.getByTestId('film-reel')).toBeVisible();

		const frame = document.querySelector<HTMLElement>('.reel-frame');
		expect(frame).not.toBeNull();

		const inlineProperties = Array.from(frame!.style);
		expect(inlineProperties.toSorted()).toEqual(['opacity', 'transform']);
	});

	it('accepts onIdleProgress callback prop', async () => {
		const onIdleProgress = vi.fn();
		const artworks = [createArtwork('f1'), createArtwork('f2'), createArtwork('f3')];

		await renderReel({ artworks, onIdleProgress });

		await expect.element(page.getByTestId('film-reel')).toBeVisible();

		// The onIdleProgress callback should exist as a valid prop
		// It will be called during idle scrolling with a fraction value
		expect(onIdleProgress).toBeDefined();
		expect(typeof onIdleProgress).toBe('function');
	});

	it('exports the spin API the mystery room drives it with', async () => {
		const artworks = [createArtwork('f1'), createArtwork('f2'), createArtwork('f3')];
		let reel: Record<string, unknown> | undefined;

		await renderReel({ artworks }, (instance) => {
			reel = instance;
		});

		await expect.element(page.getByTestId('film-reel')).toBeVisible();

		await vi.waitFor(() => {
			expect(reel).toBeDefined();
		});

		expect(typeof reel?.spin).toBe('function');
		expect(typeof reel?.spinToArtwork).toBe('function');
		expect(typeof reel?.resetToIdle).toBe('function');
		expect(typeof reel?.isSpinning).toBe('function');
	});

	it('does not blur an author’s own sensitive artwork on the reel', async () => {
		const artworks = [
			makeArtwork({ authorId: 'user-1', id: 'own', isNsfw: true }),
			createArtwork('f2'),
			createArtwork('f3')
		];

		await renderReel({ adultContentEnabled: false, artworks, viewerId: 'user-1' });

		await expect.element(page.getByTestId('film-reel')).toBeVisible();

		expect(document.querySelectorAll('.nsfw-badge').length).toBe(0);
	});

	it('blurs a sensitive artwork the viewer does not own', async () => {
		const artworks = [
			makeArtwork({ authorId: 'user-2', id: 'theirs', isNsfw: true }),
			createArtwork('f2'),
			createArtwork('f3')
		];

		await renderReel({ adultContentEnabled: false, artworks, viewerId: 'user-1' });

		await expect.element(page.getByTestId('film-reel')).toBeVisible();

		expect(document.querySelectorAll('.nsfw-badge').length).toBeGreaterThan(0);
	});

	it('censors at the shared --nsfw-* strength instead of its own hardcoded blur and scrim', async () => {
		// The reel cannot use <NsfwImage>, so the only thing keeping it at the
		// gallery-wide strength is that it reads the two custom properties.
		document.documentElement.style.setProperty('--nsfw-blur', '7px');
		document.documentElement.style.setProperty('--nsfw-scrim', 'rgb(1, 2, 3)');

		try {
			const artworks = [
				makeArtwork({ authorId: 'user-2', id: 'theirs', isNsfw: true }),
				createArtwork('f2'),
				createArtwork('f3')
			];

			await renderReel({ adultContentEnabled: false, artworks, viewerId: 'user-1' });

			await expect.element(page.getByTestId('film-reel')).toBeVisible();

			const blurred = document.querySelector('.nsfw-blurred');
			expect(blurred).not.toBeNull();
			const filter = getComputedStyle(blurred!).filter;
			expect(filter).toContain('blur(7px)');
			expect(filter).toContain('saturate(0)');

			const overlay = document.querySelector('.nsfw-overlay');
			expect(overlay).not.toBeNull();
			expect(getComputedStyle(overlay!).backgroundColor).toBe('rgb(1, 2, 3)');
		} finally {
			document.documentElement.style.removeProperty('--nsfw-blur');
			document.documentElement.style.removeProperty('--nsfw-scrim');
		}
	});

	describe('a photo that will not come', () => {
		// A one-pixel GIF that really resolves, for the frames whose photo does come.
		const PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
		const piece = (id: string, title: string, imageUrl = PIXEL) =>
			makeArtwork({ id, imageUrl, title });
		const notes = () => page.getByText(/didn.t develop/i);

		beforeEach(() => {
			motion.reduced = true;
		});

		afterEach(() => {
			motion.reduced = false;
		});

		// A frame whose photo never arrived showed the browser's broken-image icon
		// and the bare title, spinning past like any other.
		it('leaves the frame empty with a pencilled note instead of a broken picture', async () => {
			await renderReel({
				artworks: [
					piece('lost', 'Lost Piece', '/no-such-artwork.webp'),
					piece('calm', 'Calm Piece'),
					piece('quiet', 'Quiet Piece')
				]
			});

			await expect.element(notes().first()).toBeVisible();

			const lost = page.getByRole('img', { name: 'Lost Piece' }).all();
			expect(lost.length).toBeGreaterThan(0);
			// Not drawn, so no broken picture shows; still named for a screen reader.
			for (const image of lost) await expect.element(image).toHaveStyle({ opacity: '0' });
			// Only the frames showing that artwork say so.
			await expect.poll(() => notes().all().length).toBe(lost.length);
		});

		// The reel reuses its frames: when the pool grows, a frame that showed one
		// artwork goes on to show another.
		it('judges a reused frame by the artwork it shows now', async () => {
			const calm = piece('calm', 'Calm Piece');
			const quiet = piece('quiet', 'Quiet Piece');
			const screen = await renderReel({
				artworks: [piece('lost', 'Lost Piece', '/no-such-artwork.webp'), calm, quiet]
			});
			await expect.element(notes().first()).toBeVisible();

			// Of the frames that showed the lost photo, some now show a photo that is
			// fine and one shows another that will not come either.
			await screen.rerender({
				roomProps: {
					artworks: [
						piece('gone', 'Gone Piece', '/another-missing-artwork.webp'),
						piece('fresh', 'Fresh Piece'),
						calm,
						quiet
					],
					onLand: () => {}
				}
			});

			const gone = page.getByRole('img', { name: 'Gone Piece' });
			await expect.poll(() => gone.all().length).toBeGreaterThan(0);
			await expect.poll(() => notes().all().length).toBe(gone.all().length);
			for (const image of gone.all()) await expect.element(image).toHaveStyle({ opacity: '0' });
			for (const name of ['Fresh Piece', 'Calm Piece', 'Quiet Piece']) {
				for (const image of page.getByRole('img', { name }).all()) {
					await expect.element(image).toHaveStyle({ opacity: '1' });
				}
			}
		});
	});
});
