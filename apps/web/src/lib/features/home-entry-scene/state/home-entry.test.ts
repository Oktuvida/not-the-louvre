import { describe, expect, it } from 'vitest';
import {
	homeSceneArtworkSlotNames,
	toHomePreviewCards,
	toHomeSceneArtworkSlots
} from './home-entry.svelte';

const artwork = (index: number) => ({
	author: { avatarUrl: null, nickname: `artist_${index}` },
	id: `artwork-${index}`,
	isNsfw: false,
	mediaUrl: `/api/artworks/artwork-${index}/media`,
	title: `Artwork ${index}`
});

describe('toHomeSceneArtworkSlots', () => {
	it('hangs the highest ranked artwork in the first frame and keeps source order', () => {
		const slots = toHomeSceneArtworkSlots([artwork(1), artwork(2), artwork(3)]);

		expect(slots.map((slot) => slot.slotName)).toEqual(['a1', 'a2', 'a3']);
		expect(slots[0]?.id).toBe('artwork-1');
		expect(slots[2]?.id).toBe('artwork-3');
	});

	it('drops the overflow instead of the top of a longer page', () => {
		const artworks = Array.from({ length: homeSceneArtworkSlotNames.length + 4 }, (_, index) =>
			artwork(index + 1)
		);

		const slots = toHomeSceneArtworkSlots(artworks);

		expect(slots).toHaveLength(homeSceneArtworkSlotNames.length);
		expect(slots[0]?.id).toBe('artwork-1');
		expect(slots.at(-1)?.id).toBe(`artwork-${homeSceneArtworkSlotNames.length}`);
	});

	it('exposes the slot names so the loader can request exactly one page of frames', () => {
		expect(homeSceneArtworkSlotNames).toHaveLength(11);
		expect(homeSceneArtworkSlotNames[0]).toBe('a1');
	});
});

describe('toHomePreviewCards', () => {
	it('keeps the three highest ranked artworks in podium order', () => {
		const cards = toHomePreviewCards([artwork(1), artwork(2), artwork(3), artwork(4)]);

		expect(cards.map((card) => card.rank)).toEqual([1, 2, 3]);
		expect(cards[0]?.id).toBe('artwork-1');
	});
});
