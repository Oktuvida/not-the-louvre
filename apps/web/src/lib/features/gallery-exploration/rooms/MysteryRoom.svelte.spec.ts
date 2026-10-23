import type { ComponentProps } from 'svelte';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { Artwork } from '#lib/features/artwork-presentation/model/artwork.js';

vi.mock('$app/environment', () => ({
	browser: true
}));

vi.mock('#lib/client/gsap.js', () => {
	// Track idle cycle depth to prevent infinite recursion from startIdle → onComplete → startIdle
	let idleDepth = 0;
	const MAX_IDLE_CYCLES = 2;

	return {
		gsap: {
			to: (proxy: Record<string, number>, config: Record<string, unknown>) => {
				const targetValue =
					typeof config.value === 'string' && (config.value as string).startsWith('+=')
						? proxy.value + parseFloat((config.value as string).slice(2))
						: (config.value as number);

				const isIdle = config.ease === 'none'; // idle tweens use ease: 'none'

				const tween = {
					proxy,
					target: targetValue,
					onUpdate: config.onUpdate as (() => void) | undefined,
					onComplete: config.onComplete as (() => void) | undefined,
					kill: vi.fn()
				};

				if (isIdle && idleDepth >= MAX_IDLE_CYCLES) {
					// Stop recursion — don't complete this tween
					return tween;
				}

				if (isIdle) idleDepth++;

				// Immediately complete the tween for testing
				proxy.value = targetValue;
				tween.onUpdate?.();
				tween.onComplete?.();

				if (!isIdle) idleDepth = 0; // Reset depth on spin tweens

				return tween;
			},
			__resetIdleDepth: () => {
				idleDepth = 0;
			}
		}
	};
});

import { makeArtwork as makeArtworkFixture } from '#lib/features/gallery-exploration/fixtures/artworks.js';
import MysteryRoom from './MysteryRoom.svelte';
import RoomHarness from './RoomHarness.svelte';

const makeArtwork = (id: string, title: string): Artwork =>
	makeArtworkFixture({
		authorId: 'user-test',
		id,
		imageUrl: `/api/artworks/${id}/media`,
		score: 10,
		title,
		upvotes: 10
	});

type MysteryProps = ComponentProps<typeof MysteryRoom>;

const renderRoom = (props: Partial<MysteryProps> & Pick<MysteryProps, 'artworks' | 'pageInfo'>) =>
	render(RoomHarness, {
		props: { component: MysteryRoom, roomProps: props, style: 'width: 800px; height: 600px;' }
	});

const sampleArtworks = [
	makeArtwork('a1', 'Sunset Dreams'),
	makeArtwork('a2', 'Ocean Waves'),
	makeArtwork('a3', 'Forest Path'),
	makeArtwork('a4', 'City Lights'),
	makeArtwork('a5', 'Desert Dunes')
];

const defaultPageInfo = { hasMore: true, nextCursor: 'cursor-1' };

describe('MysteryRoom', () => {
	beforeEach(async () => {
		// Reset the GSAP mock's idle depth counter between tests
		const { gsap } = await import('#lib/client/gsap.js');
		(gsap as unknown as { __resetIdleDepth: () => void }).__resetIdleDepth();
	});

	it('renders a film reel with artwork frames visible on the strip', async () => {
		await renderRoom({
			artworks: sampleArtworks,
			pageInfo: defaultPageInfo
		});

		await expect.element(page.getByTestId('film-reel')).toBeVisible();
		await expect.element(page.getByTestId('film-reel-track')).toBeVisible();
		await expect
			.element(page.getByTestId('film-reel'))
			.toHaveAttribute('data-reel-orientation', 'horizontal');
	});

	it('applies the tighter mystery mobile shell layout hooks', async () => {
		await renderRoom({
			artworks: sampleArtworks,
			pageInfo: defaultPageInfo
		});

		const room = document.querySelector('[data-testid="mystery-room"]');
		expect(room).not.toBeNull();
		expect(room?.className).toContain('pt-28');
		expect(room?.className).toContain('gap-8');
	});

	it('shows the spin button that triggers the reel animation', async () => {
		await renderRoom({
			artworks: sampleArtworks,
			pageInfo: defaultPageInfo
		});

		await expect.element(page.getByRole('button', { name: /spin/i })).toBeVisible();
	});

	it('disables the spin button while the reel is spinning', async () => {
		// fetchRandomArtwork never resolves so the spin stays active
		const fetchRandomArtwork = vi.fn(() => new Promise<Artwork>(() => {}));

		await renderRoom({
			artworks: sampleArtworks,
			pageInfo: defaultPageInfo,
			fetchRandomArtwork
		});

		const spinButton = page.getByRole('button', { name: /spin/i });
		await spinButton.click();

		await expect.element(spinButton).toBeDisabled();
	});

	it('spin calls fetchRandomArtwork and passes result to filmReel.spinToArtwork', async () => {
		const randomArtwork = makeArtwork('random-1', 'Random Masterpiece');
		const fetchRandomArtwork = vi.fn().mockResolvedValue(randomArtwork);
		const onSelect = vi.fn();

		await renderRoom({
			artworks: sampleArtworks,
			pageInfo: defaultPageInfo,
			fetchRandomArtwork,
			onSelect
		});

		await page.getByRole('button', { name: /spin/i }).click();

		// fetchRandomArtwork should be called
		await vi.waitFor(
			() => {
				expect(fetchRandomArtwork).toHaveBeenCalledOnce();
			},
			{ timeout: 3000 }
		);

		// After the spin completes (GSAP mock completes immediately),
		// onSelect should be called with the random artwork
		await vi.waitFor(
			() => {
				expect(onSelect).toHaveBeenCalledOnce();
			},
			{ timeout: 3000 }
		);

		const calledWith = onSelect.mock.calls[0]![0] as Artwork;
		expect(calledWith.id).toBe('random-1');
	});

	it('starts the reel moving on the click instead of waiting for the artwork', async () => {
		// Never resolves: the reel has to move on its own until it is retargeted.
		const fetchRandomArtwork = vi.fn(() => new Promise<Artwork>(() => {}));

		await renderRoom({
			artworks: sampleArtworks,
			pageInfo: defaultPageInfo,
			fetchRandomArtwork
		});

		const reel = page.getByTestId('film-reel');
		await expect.element(reel).toHaveAttribute('data-reel-state', 'idle');

		await page.getByRole('button', { name: /spin/i }).click();

		await expect.element(reel).toHaveAttribute('data-reel-state', 'free-spinning');
	});

	it('surfaces a failed spin instead of swallowing it', async () => {
		const fetchRandomArtwork = vi.fn().mockRejectedValue(new Error('Network error'));

		await renderRoom({
			artworks: sampleArtworks,
			pageInfo: defaultPageInfo,
			fetchRandomArtwork
		});

		await page.getByRole('button', { name: /spin/i }).click();

		const notice = page.getByTestId('mystery-spin-error');
		await expect.element(notice).toBeVisible();
		await expect.element(notice).toHaveAttribute('role', 'alert');
		await expect
			.element(notice)
			.toMatchTextContent('That spin came up empty — give it another go.');
		// The run-up is wound back down rather than left turning forever.
		await expect.element(page.getByTestId('film-reel')).toHaveAttribute('data-reel-state', 'idle');
	});

	it('spin error keeps FilmReel in idle and re-enables the spin button', async () => {
		const fetchRandomArtwork = vi.fn().mockRejectedValue(new Error('Network error'));

		await renderRoom({
			artworks: sampleArtworks,
			pageInfo: defaultPageInfo,
			fetchRandomArtwork
		});

		const spinButton = page.getByRole('button', { name: /spin/i });
		await spinButton.click();

		// After the fetch rejects, the spin button should be re-enabled
		await vi.waitFor(
			() => {
				expect(fetchRandomArtwork).toHaveBeenCalledOnce();
			},
			{ timeout: 3000 }
		);

		// Button should be re-enabled after error
		await expect.element(spinButton).not.toBeDisabled();
	});

	it('renders artwork images inside the reel viewport', async () => {
		await renderRoom({
			artworks: sampleArtworks,
			pageInfo: defaultPageInfo
		});

		expect(document.querySelectorAll('img[alt="Sunset Dreams"]').length).toBeGreaterThan(0);
	});

	it('renders helper text explaining the feature', async () => {
		await renderRoom({
			artworks: sampleArtworks,
			pageInfo: defaultPageInfo
		});

		await expect.element(page.getByText(/discover a random masterpiece/i)).toBeVisible();
	});

	it('blurs nsfw artworks on the reel when adult content is disabled', async () => {
		const nsfwArtworks = [
			{ ...makeArtwork('nsfw-1', 'Spicy Art'), isNsfw: true },
			makeArtwork('safe-1', 'Safe Art'),
			makeArtwork('safe-2', 'Also Safe'),
			makeArtwork('safe-3', 'Very Safe'),
			makeArtwork('safe-4', 'Super Safe')
		];

		await renderRoom({
			adultContentEnabled: false,
			artworks: nsfwArtworks,
			pageInfo: defaultPageInfo
		});

		expect(document.querySelectorAll('.nsfw-badge').length).toBeGreaterThan(0);
	});

	it('shows nsfw artworks unblurred when adult content is enabled', async () => {
		const nsfwArtworks = [
			{ ...makeArtwork('nsfw-1', 'Spicy Art'), isNsfw: true },
			makeArtwork('safe-1', 'Safe Art'),
			makeArtwork('safe-2', 'Also Safe'),
			makeArtwork('safe-3', 'Very Safe'),
			makeArtwork('safe-4', 'Super Safe')
		];

		await renderRoom({
			adultContentEnabled: true,
			artworks: nsfwArtworks,
			pageInfo: defaultPageInfo
		});

		await expect.element(page.getByText('18+')).not.toBeInTheDocument();
	});

	it('calls loadMoreArtworks when idle progress reaches 80%', async () => {
		const loadMoreArtworks = vi.fn().mockResolvedValue({
			artworks: [makeArtwork('new-1', 'New Art')],
			pageInfo: { hasMore: false, nextCursor: null }
		});

		await renderRoom({
			artworks: sampleArtworks,
			pageInfo: defaultPageInfo,
			loadMoreArtworks
		});

		// Wait for the film reel to mount and idle animation to start
		await expect.element(page.getByTestId('film-reel')).toBeVisible();

		// The GSAP mock completes idle tweens immediately after the 100ms setTimeout
		// in FilmReel's $effect. Both onIdleProgress (fraction >= 0.8) and
		// onIdleCycleComplete trigger accumulator.loadMore(), which calls fetchPage
		// → loadMoreArtworks. Allow generous time for the setTimeout + effect chain.
		await vi.waitFor(
			() => {
				expect(loadMoreArtworks).toHaveBeenCalled();
			},
			{ timeout: 5000, interval: 100 }
		);
	});
});
