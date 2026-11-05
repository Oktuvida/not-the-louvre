import type { ComponentProps } from 'svelte';
import { page } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { Artwork } from '#lib/features/artwork-presentation/model/artwork.js';

vi.mock('$app/environment', () => ({
	browser: true
}));

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
import MysteryRoom from './MysteryRoom.svelte';
import RoomHarness from './RoomHarness.svelte';

const PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

const chosen = makeArtwork({ id: 'random-1', imageUrl: PIXEL, title: 'Random Masterpiece' });

type MysteryProps = ComponentProps<typeof MysteryRoom>;

const renderRoom = (props: Partial<MysteryProps> = {}) =>
	render(RoomHarness, {
		props: { component: MysteryRoom, roomProps: props, style: 'width: 800px; height: 600px;' }
	});

const spinButton = () => page.getByRole('button', { name: /spin/i });

describe('MysteryRoom', () => {
	afterEach(() => {
		motion.reduced = false;
	});

	it('offers a line of undeveloped photos, with Spin and its note under it', async () => {
		await renderRoom();

		await expect.element(page.getByTestId('film-reel')).toBeVisible();
		await expect.element(spinButton()).toBeVisible();
		await expect.element(page.getByText(/discover a random masterpiece/i)).toBeVisible();
	});

	it('disables Spin while the line runs', async () => {
		await renderRoom({ fetchRandomArtwork: () => new Promise<Artwork>(() => {}) });

		await spinButton().click();

		await expect.element(spinButton()).toBeDisabled();
	});

	it('starts the line on the click instead of waiting for the artwork', async () => {
		await renderRoom({ fetchRandomArtwork: () => new Promise<Artwork>(() => {}) });
		const reel = page.getByTestId('film-reel');
		await expect.element(reel).toHaveAttribute('data-reel-state', 'resting');

		await spinButton().click();

		await expect.element(reel).toHaveAttribute('data-reel-state', 'spinning');
	});

	it('opens the piece a spin developed, after a moment to look at it', async () => {
		motion.reduced = true;
		const onSelect = vi.fn();
		await renderRoom({ fetchRandomArtwork: vi.fn().mockResolvedValue(chosen), onSelect });
		const spunAt = performance.now();

		await spinButton().click();

		await vi.waitFor(() => expect(onSelect).toHaveBeenCalledWith(chosen), { timeout: 5000 });
		// A floor, which a slow machine can only clear by more.
		expect(performance.now() - spunAt).toBeGreaterThanOrEqual(500);
	});

	it('opens the piece at once when the visitor presses it, and only the once', async () => {
		const onSelect = vi.fn();
		await renderRoom({ fetchRandomArtwork: vi.fn().mockResolvedValue(chosen), onSelect });

		await spinButton().click();

		// Played up to the photo coming up, and held there for the press.
		const track = page.getByTestId('film-reel-track').element();
		const photo = page.getByRole('img', { name: 'Random Masterpiece' });
		await vi.waitFor(() => {
			for (const running of track.getAnimations()) running.finish();
			expect(photo.element().getAnimations()).toHaveLength(1);
		});
		photo.element().getAnimations()[0]!.pause();

		const press = page.getByRole('button', { name: 'Open Random Masterpiece' }).element();
		(press as HTMLElement).click();

		expect(onSelect).toHaveBeenCalledOnce();
		await new Promise((resolve) => setTimeout(resolve, 800));
		expect(onSelect).toHaveBeenCalledOnce();
	});

	it('holds the line while the postcard is open, and lets it go after', async () => {
		const screen = await renderRoom({ postcardOpen: true });
		const drift = () => page.getByTestId('film-reel-track').element().getAnimations()[0];

		await vi.waitFor(() => expect(drift()?.playState).toBe('paused'));

		await screen.rerender({
			component: MysteryRoom,
			roomProps: { postcardOpen: false },
			style: 'width: 800px; height: 600px;'
		});

		await vi.waitFor(() => expect(drift()?.playState).toBe('running'));
	});

	it('gives Spin back as soon as the line has stopped', async () => {
		motion.reduced = true;
		await renderRoom({ fetchRandomArtwork: vi.fn().mockResolvedValue(chosen) });

		await spinButton().click();

		await expect.element(page.getByRole('img', { name: 'Random Masterpiece' })).toBeVisible();
		await expect.element(spinButton()).not.toBeDisabled();
	});

	it('surfaces a failed spin instead of swallowing it, and winds the line down', async () => {
		await renderRoom({ fetchRandomArtwork: vi.fn().mockRejectedValue(new Error('Network error')) });

		await spinButton().click();

		const notice = page.getByTestId('mystery-spin-error');
		await expect.element(notice).toBeVisible();
		await expect.element(notice).toHaveAttribute('role', 'alert');
		await expect
			.element(notice)
			.toMatchTextContent('That spin came up empty — give it another go.');
		await expect
			.element(page.getByTestId('film-reel'))
			.toHaveAttribute('data-reel-state', 'resting');
		await expect.element(spinButton()).not.toBeDisabled();
	});
});
