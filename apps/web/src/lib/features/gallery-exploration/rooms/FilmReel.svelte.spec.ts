import type { ComponentProps } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';

vi.mock('$app/environment', () => ({
	browser: true
}));

// A visitor who asked for less motion gets a still line: specs of what comes up
// on it use that path, and the ones about the movement keep it moving.
const motion = vi.hoisted(() => ({ reduced: false }));

vi.mock('svelte/motion', async (importOriginal) => ({
	...(await importOriginal<typeof import('svelte/motion')>()),
	prefersReducedMotion: {
		get current() {
			return motion.reduced;
		}
	}
}));

import { makeArtwork } from '#lib/features/gallery-exploration/fixtures/artworks.js';
import FilmReel from './FilmReel.svelte';
import RoomHarness from './RoomHarness.svelte';

// A one-pixel GIF that really resolves.
const PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

const piece = (id: string, title: string, imageUrl = PIXEL, overrides = {}) =>
	makeArtwork({ id, imageUrl, title, ...overrides });

type FilmReelProps = ComponentProps<typeof FilmReel>;
type Reel = {
	cancelFreeSpin(): void;
	spinToArtwork(artwork: ReturnType<typeof makeArtwork>): boolean;
	startFreeSpin(): void;
};

const renderReel = async (props: Partial<FilmReelProps> = {}) => {
	let reel: Reel | undefined;
	await render(RoomHarness, {
		props: {
			component: FilmReel,
			onInstance: (instance: Record<string, unknown> | undefined) => {
				if (instance) reel = instance as unknown as Reel;
			},
			roomProps: { onDeveloped: () => {}, ...props },
			style: 'width: 800px; height: 600px;'
		}
	});
	await vi.waitFor(() => expect(reel).toBeDefined());
	return reel!;
};

const line = () => page.getByTestId('film-reel-track').element();
const photos = () => [...document.querySelectorAll('[data-testid="film-reel"] img')];

/** Plays every motion with an end to its finish; the steady spin has none. */
const finishMotions = () => {
	for (const motion of document.getAnimations()) {
		if (motion.effect?.getComputedTiming().iterations !== Infinity) motion.finish();
	}
};

describe('FilmReel', () => {
	afterEach(() => {
		motion.reduced = false;
	});

	it('hangs nothing but undeveloped photos until a spin lands on one', async () => {
		await renderReel();

		await expect.element(page.getByTestId('film-reel')).toBeVisible();
		expect(line().children.length).toBeGreaterThan(10);
		expect(photos()).toHaveLength(0);
	});

	// The reel was the heaviest thing in the gallery because every frame was
	// recalculated on every tick. Now the line is one piece and the browser
	// moves it: nothing on the page changes while it runs.
	it('moves as one piece, with nothing on the page changing as it runs', async () => {
		const reel = await renderReel();
		const changes: MutationRecord[] = [];
		const watcher = new MutationObserver((records) => changes.push(...records));
		watcher.observe(line(), { attributes: true, childList: true, subtree: true });

		reel.startFreeSpin();

		await vi.waitFor(() => expect(line().getAnimations()).toHaveLength(1));
		await new Promise((resolve) => setTimeout(resolve, 150));
		watcher.disconnect();

		expect(changes).toEqual([]);
		const moved = line().getAnimations()[0]!.effect as KeyframeEffect;
		expect(moved.getKeyframes().every((keyframe) => 'transform' in keyframe)).toBe(true);
	});

	it('runs until the artwork is known, then slows down and develops it', async () => {
		const onDeveloped = vi.fn();
		const onLand = vi.fn();
		const reel = await renderReel({ onDeveloped, onLand });
		const artwork = piece('chosen', 'Chosen Piece');

		reel.startFreeSpin();
		await vi.waitFor(() => {
			finishMotions();
			const running = line().getAnimations()[0];
			expect(running?.effect?.getComputedTiming().iterations).toBe(Infinity);
		});
		expect(onLand).not.toHaveBeenCalled();

		expect(reel.spinToArtwork(artwork)).toBe(true);
		await vi.waitFor(() => {
			expect(line().getAnimations()[0]?.effect?.getComputedTiming().iterations).toBe(1);
		});
		expect(onLand).not.toHaveBeenCalled();

		await vi.waitFor(() => {
			finishMotions();
			expect(onLand).toHaveBeenCalledWith(artwork);
		});
		await vi.waitFor(() => {
			finishMotions();
			expect(onDeveloped).toHaveBeenCalledWith(artwork);
		});
		expect(line().getAnimations()).toHaveLength(0);
		await expect.element(page.getByRole('img', { name: 'Chosen Piece' })).toBeVisible();
	});

	it('writes the piece on the polaroid once it has developed', async () => {
		motion.reduced = true;
		const reel = await renderReel();

		reel.startFreeSpin();
		reel.spinToArtwork(piece('chosen', 'Chosen Piece', PIXEL, { artist: 'night_painter' }));

		await expect.element(page.getByText('Chosen Piece', { exact: true })).toBeVisible();
		await expect.element(page.getByText('night_painter')).toBeVisible();
	});

	it('lets the visitor open the piece without waiting for it to develop', async () => {
		const onOpen = vi.fn();
		const onDeveloped = vi.fn();
		const reel = await renderReel({ onDeveloped, onOpen });
		const artwork = piece('chosen', 'Chosen Piece');

		reel.startFreeSpin();
		await vi.waitFor(() => {
			finishMotions();
			expect(reel.spinToArtwork(artwork)).toBe(true);
		});
		const open = page.getByRole('button', { name: 'Open Chosen Piece' });
		await vi.waitFor(() => {
			for (const motion of line().getAnimations()) {
				if (motion.effect?.getComputedTiming().iterations !== Infinity) motion.finish();
			}
			expect(open.element()).toBeVisible();
		});

		await open.click();

		expect(onOpen).toHaveBeenCalledWith(artwork);
		expect(onDeveloped).not.toHaveBeenCalled();
	});

	it('takes the last piece away with the line when it spins again', async () => {
		motion.reduced = false;
		const reel = await renderReel();

		reel.startFreeSpin();
		await vi.waitFor(() => {
			finishMotions();
			expect(reel.spinToArtwork(piece('first', 'First Piece'))).toBe(true);
		});
		const first = page.getByRole('img', { name: 'First Piece' });
		await vi.waitFor(() => {
			finishMotions();
			expect(first.element()).toBeVisible();
		});

		reel.startFreeSpin();

		await vi.waitFor(() => {
			finishMotions();
			expect(first.query()).toBeNull();
		});
	});

	it('stops and puts nothing up when the artwork never comes', async () => {
		const onLand = vi.fn();
		const reel = await renderReel({ onLand });

		reel.startFreeSpin();
		await vi.waitFor(() => expect(line().getAnimations()).toHaveLength(1));
		reel.cancelFreeSpin();

		await vi.waitFor(() => {
			finishMotions();
			expect(line().getAnimations()).toHaveLength(0);
		});
		expect(onLand).not.toHaveBeenCalled();
		expect(photos()).toHaveLength(0);
		await expect
			.element(page.getByTestId('film-reel'))
			.toHaveAttribute('data-reel-state', 'resting');
	});

	it('refuses an artwork when no spin is under way', async () => {
		const reel = await renderReel();

		expect(reel.spinToArtwork(piece('chosen', 'Chosen Piece'))).toBe(false);
	});

	it('keeps the line still for a visitor who asked for less motion', async () => {
		motion.reduced = true;
		const onDeveloped = vi.fn();
		const reel = await renderReel({ onDeveloped });
		const artwork = piece('chosen', 'Chosen Piece');

		reel.startFreeSpin();
		expect(line().getAnimations()).toHaveLength(0);
		reel.spinToArtwork(artwork);

		await vi.waitFor(() => expect(onDeveloped).toHaveBeenCalledWith(artwork));
		expect(line().getAnimations()).toHaveLength(0);
		expect(photos()[0]!.getAnimations()).toHaveLength(0);
	});

	describe('a sensitive piece', () => {
		it('stays covered for a viewer who has not opted in', async () => {
			motion.reduced = true;
			const reel = await renderReel({ viewerId: 'viewer-1' });

			reel.startFreeSpin();
			reel.spinToArtwork(piece('nsfw', 'Sensitive', PIXEL, { authorId: 'other', isNsfw: true }));

			await expect.element(page.getByText('18+')).toBeVisible();
		});

		it('is not covered for its own author', async () => {
			motion.reduced = true;
			const onDeveloped = vi.fn();
			const reel = await renderReel({ onDeveloped, viewerId: 'viewer-1' });

			reel.startFreeSpin();
			reel.spinToArtwork(piece('nsfw', 'Sensitive', PIXEL, { authorId: 'viewer-1', isNsfw: true }));

			await vi.waitFor(() => expect(onDeveloped).toHaveBeenCalled());
			expect(page.getByText('18+').query()).toBeNull();
		});

		it('censors at the shared --nsfw-* strength instead of its own', async () => {
			motion.reduced = true;
			document.documentElement.style.setProperty('--nsfw-blur', '7px');
			document.documentElement.style.setProperty('--nsfw-scrim', 'rgba(1, 2, 3, 0.4)');
			try {
				const reel = await renderReel({ viewerId: 'viewer-1' });

				reel.startFreeSpin();
				reel.spinToArtwork(piece('nsfw', 'Sensitive', PIXEL, { authorId: 'other', isNsfw: true }));

				const image = page.getByRole('img', { name: 'Sensitive' });
				await expect.element(image).toBeInTheDocument();
				expect(getComputedStyle(image.element()).filter).toContain('blur(7px)');
				expect(
					getComputedStyle(page.getByText('18+').element().parentElement!).backgroundColor
				).toBe('rgba(1, 2, 3, 0.4)');
			} finally {
				document.documentElement.style.removeProperty('--nsfw-blur');
				document.documentElement.style.removeProperty('--nsfw-scrim');
			}
		});
	});

	describe('a photo that will not come', () => {
		it('leaves a pencilled note on the polaroid, and does not claim it developed', async () => {
			motion.reduced = true;
			const onDeveloped = vi.fn();
			const reel = await renderReel({ onDeveloped });

			reel.startFreeSpin();
			reel.spinToArtwork(piece('lost', 'Lost Piece', '/no-such-artwork.webp'));

			await expect.element(page.getByText(/didn.t develop/i)).toBeVisible();
			await expect
				.element(page.getByRole('img', { name: 'Lost Piece' }))
				.toHaveStyle({ opacity: '0' });
			expect(onDeveloped).not.toHaveBeenCalled();
		});
	});
});
