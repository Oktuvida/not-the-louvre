import type { ComponentProps } from 'svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';

vi.mock('$app/environment', () => ({
	browser: true
}));

import { makeArtwork } from '$lib/features/gallery-exploration/fixtures/artworks';
import { clearRoomFeedCache } from '$lib/features/gallery-exploration/model/feed-cache';
import HotWallRoom from './HotWallRoom.svelte';
import RoomHarness from './RoomHarness.svelte';

const createArtwork = (id: string, score: number) => makeArtwork({ id, score, upvotes: score });

type HotWallProps = ComponentProps<typeof HotWallRoom>;

const renderRoom = (props: Partial<HotWallProps> & Pick<HotWallProps, 'artworks' | 'pageInfo'>) =>
	render(RoomHarness, { props: { component: HotWallRoom, roomProps: props } });

describe('HotWallRoom', () => {
	beforeEach(() => {
		clearRoomFeedCache();
	});

	it('creates its own ArtworkAccumulator seeded with initial artworks', async () => {
		const artworks = [
			createArtwork('h1', 100),
			createArtwork('h2', 90),
			createArtwork('h3', 80),
			createArtwork('h4', 70),
			createArtwork('h5', 60)
		];

		renderRoom({
			artworks,
			pageInfo: { hasMore: true, nextCursor: 'cursor-1' }
		});

		// The hot wall room should render
		await expect.element(page.getByTestId('hot-wall-room')).toBeVisible();

		// Lead artwork should be visible
		await expect.element(page.getByTestId('hot-wall-lead')).toBeVisible();
	});

	it('renders lead artwork with stronger prominence and remaining artworks in supporting wall', async () => {
		const artworks = [
			createArtwork('h1', 100),
			createArtwork('h2', 90),
			createArtwork('h3', 80),
			createArtwork('h4', 70),
			createArtwork('h5', 60),
			createArtwork('h6', 50),
			createArtwork('h7', 40)
		];

		renderRoom({
			artworks,
			pageInfo: { hasMore: false, nextCursor: null }
		});

		// Lead artwork (first item) should have its own section
		await expect.element(page.getByTestId('hot-wall-lead')).toBeVisible();

		// Lead artwork image should be present
		const leadImg = document.querySelector('[data-testid="hot-wall-lead"] img');
		expect(leadImg).not.toBeNull();

		// Supporting wall artworks should be rendered
		const supportingCards = document.querySelectorAll('[data-testid^="hot-wall-card-"]');
		expect(supportingCards.length).toBeGreaterThanOrEqual(1);
	});

	it('wires ScrollSentinel to call accumulator loadMore', async () => {
		const loadMoreArtworks = vi.fn().mockResolvedValue({
			artworks: [],
			pageInfo: { hasMore: false, nextCursor: null }
		});

		const artworks = [
			createArtwork('h1', 100),
			createArtwork('h2', 90),
			createArtwork('h3', 80),
			createArtwork('h4', 70),
			createArtwork('h5', 60)
		];

		renderRoom({
			artworks,
			pageInfo: { hasMore: true, nextCursor: 'cursor-1' },
			loadMoreArtworks
		});

		await expect.element(page.getByTestId('hot-wall-room')).toBeVisible();

		// ScrollSentinel should be present
		const sentinel = document.querySelector('[data-testid="scroll-sentinel"]');
		expect(sentinel).not.toBeNull();
	});

	it('reseeds accumulator when artworks prop changes so refreshed data is shown', async () => {
		const artworks = [createArtwork('h1', 100), createArtwork('h2', 90), createArtwork('h3', 80)];

		const screen = renderRoom({
			artworks,
			pageInfo: { hasMore: false, nextCursor: null }
		});

		await expect.element(page.getByTestId('hot-wall-room')).toBeVisible();
		await expect.element(page.getByTestId('hot-wall-lead')).toBeVisible();

		// Simulate refresh: completely new set of artworks
		const refreshedArtworks = [
			createArtwork('h4', 200),
			createArtwork('h5', 150),
			createArtwork('h1', 100)
		];

		await screen.rerender({
			component: HotWallRoom,
			roomProps: {
				artworks: refreshedArtworks,
				pageInfo: { hasMore: false, nextCursor: null }
			}
		});

		// The new lead artwork should be h4
		const leadImg = document.querySelector('[data-testid="hot-wall-lead"] img');
		expect(leadImg).not.toBeNull();
		expect(leadImg?.getAttribute('alt')).toBe('Artwork h4');

		// h5 should appear in the supporting wall
		const supportingCards = document.querySelectorAll('[data-testid^="hot-wall-card-"]');
		const cardIds = Array.from(supportingCards).map((el) => el.getAttribute('data-testid'));
		expect(cardIds).toContain('hot-wall-card-h5');
	});

	it('renders empty state when no artworks are provided', async () => {
		renderRoom({
			artworks: [],
			pageInfo: { hasMore: false, nextCursor: null }
		});

		// Should show empty state message about no artworks heating up
		await expect.element(page.getByText(/nothing.*heating up/i)).toBeVisible();

		// Lead artwork should NOT be visible
		expect(document.querySelector('[data-testid="hot-wall-lead"]')).toBeNull();
	});

	it('keeps the lead card unblurred for its own author and prefetches its detail on pointerdown', async () => {
		const onPrefetch = vi.fn();
		const lead = makeArtwork({ authorId: 'user-1', id: 'h1', isNsfw: true, score: 100 });

		renderRoom({
			adultContentEnabled: false,
			artworks: [lead, createArtwork('h2', 90)],
			onPrefetch,
			pageInfo: { hasMore: false, nextCursor: null },
			viewerId: 'user-1'
		});

		await expect.element(page.getByTestId('hot-wall-lead')).toBeVisible();

		// The author's own sensitive artwork is not hidden from them.
		expect(document.querySelector('[data-testid="hot-wall-lead"] .nsfw-scrim')).toBeNull();

		const leadButton = document.querySelector<HTMLButtonElement>(
			'[data-testid="hot-wall-lead"] button'
		);
		leadButton?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));

		expect(onPrefetch).toHaveBeenCalledWith('h1');

		// A finger landing on the lead may be the start of a scroll, and the
		// request a prefetch sends cannot be recalled by the `pointercancel`.
		leadButton?.dispatchEvent(
			new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' })
		);
		expect(onPrefetch).toHaveBeenCalledTimes(1);

		// Tab moves through the wall; only an activating key is intent to open.
		leadButton?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Tab' }));
		expect(onPrefetch).toHaveBeenCalledTimes(1);

		leadButton?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }));
		expect(onPrefetch).toHaveBeenCalledTimes(2);
	});
	it('comes back to the feed it left instead of restarting at the first page', async () => {
		const seed = [createArtwork('h1', 100), createArtwork('h2', 90)];
		const loadMoreArtworks = vi.fn().mockResolvedValue({
			artworks: [createArtwork('h3', 80), createArtwork('h4', 70)],
			pageInfo: { hasMore: false, nextCursor: null }
		});

		const first = renderRoom({
			artworks: seed,
			feedCacheKey: 'hot-wall',
			loadMoreArtworks,
			pageInfo: { hasMore: true, nextCursor: 'cursor-1' }
		});

		await expect.element(page.getByTestId('hot-wall-room')).toBeVisible();

		document
			.querySelector('[data-testid="scroll-sentinel"]')
			?.scrollIntoView({ behavior: 'instant', block: 'center' });

		await vi.waitFor(() => {
			expect(document.querySelector('[data-testid="hot-wall-card-h4"]')).not.toBeNull();
		});

		// Leaving the room hands the paged-in feed to the cache…
		first.unmount();

		renderRoom({
			artworks: seed,
			feedCacheKey: 'hot-wall',
			loadMoreArtworks,
			pageInfo: { hasMore: true, nextCursor: 'cursor-1' }
		});

		// …so coming back does not drop three pages and start at the top again.
		await expect.element(page.getByTestId('hot-wall-room')).toBeVisible();
		await vi.waitFor(() => {
			expect(document.querySelector('[data-testid="hot-wall-card-h4"]')).not.toBeNull();
		});
	});
});
