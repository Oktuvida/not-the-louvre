import type { ComponentProps } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';

vi.mock('#lib/features/home-entry-scene/canvas/museum-canvas.js', () => ({
	museumWindowOpening: { x: 0, y: 0, width: 100, height: 100 },
	museumWindowAspectRatio: '16/9'
}));

vi.mock('$app/environment', () => ({
	browser: true
}));

import { makeArtwork } from '#lib/features/gallery-exploration/fixtures/artworks.js';
import RoomHarness from './RoomHarness.svelte';
import NewestFirstRoom from './NewestFirstRoom.svelte';

type RoomProps = ComponentProps<typeof NewestFirstRoom>;

const renderRoom = (props: Partial<RoomProps> & Pick<RoomProps, 'artworks' | 'pageInfo'>) =>
	render(RoomHarness, {
		props: { component: NewestFirstRoom, roomProps: { onSelect: () => {}, ...props } }
	});

const NO_MORE = { hasMore: false, nextCursor: null };

describe('NewestFirstRoom', () => {
	it('notes on every polaroid when it went up', async () => {
		await renderRoom({
			artworks: [
				makeArtwork({ id: 'fresh', timestamp: Date.now() }),
				makeArtwork({ id: 'older', timestamp: Date.now() - 3 * 60 * 60 * 1000 })
			],
			pageInfo: NO_MORE
		});

		await expect
			.element(page.getByTestId('wet-paint-card-fresh').getByText('just hung'))
			.toBeVisible();
		await expect
			.element(page.getByTestId('wet-paint-card-older').getByText('hung 3 hours ago'))
			.toBeVisible();
	});

	it('keeps a sensitive piece covered until a signed-in visitor uncovers it', async () => {
		const onSelect = vi.fn();
		const artwork = makeArtwork({ id: 'sensitive', isNsfw: true, title: 'Sensitive piece' });
		await renderRoom({ artworks: [artwork], onSelect, pageInfo: NO_MORE, viewerId: 'visitor' });

		const card = page.getByTestId('wet-paint-card-sensitive').getByRole('button');
		await card.click();
		expect(onSelect).not.toHaveBeenCalled();

		await card.click();
		expect(onSelect).toHaveBeenCalledWith(artwork);
	});

	it('pages on through older pieces as the visitor scrolls', async () => {
		const loadMoreArtworks = vi.fn().mockResolvedValue({
			artworks: [makeArtwork({ id: 'next-page' })],
			pageInfo: NO_MORE
		});
		await renderRoom({
			artworks: [makeArtwork({ id: 'first-page' })],
			loadMoreArtworks,
			pageInfo: { hasMore: true, nextCursor: 'cursor-1' }
		});

		await vi.waitFor(() => expect(loadMoreArtworks).toHaveBeenCalledWith({ cursor: 'cursor-1' }));
		await expect.element(page.getByTestId('wet-paint-card-next-page')).toBeVisible();
	});
});
