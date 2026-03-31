import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import HotWallRoom from './HotWallRoom.svelte';

const makeArtwork = (id: string, title: string, artist: string, score: number) => ({
	artist,
	artistAvatar: undefined,
	commentCount: 0,
	comments: [],
	downvotes: 0,
	forkCount: 0,
	id,
	imageUrl: `/api/artworks/${id}/media`,
	isNsfw: false,
	score,
	timestamp: Date.now(),
	title,
	upvotes: 0,
	viewerVote: null as 'up' | 'down' | null
});

const fiveArtworks = [
	makeArtwork('art-1', 'Blazing Sun', 'Artist Alpha', 100),
	makeArtwork('art-2', 'Warm Glow', 'Artist Beta', 80),
	makeArtwork('art-3', 'Amber Light', 'Artist Gamma', 60),
	makeArtwork('art-4', 'Gentle Heat', 'Artist Delta', 40),
	makeArtwork('art-5', 'Cool Breeze', 'Artist Epsilon', 20)
];

describe('HotWallRoom', () => {
	it('shows a centered coming-soon post-it placeholder', async () => {
		render(HotWallRoom);

		await expect.element(page.getByTestId('hot-wall-coming-soon')).toBeVisible();
		await expect.element(page.getByText('Soon.')).toBeVisible();
		await expect.element(page.getByText('The Hot Wall')).toBeVisible();
	});

	it.skip('renders the mosaic grid with 5 artworks showing artwork images', async () => {
		render(HotWallRoom, {
			artworks: fiveArtworks,
			onSelect: vi.fn()
		});

		for (const artwork of fiveArtworks) {
			await expect.element(page.getByAltText(artwork.title)).toBeVisible();
		}
	});

	it.skip('shows the #1 artwork info overlay with title, artist, and score', async () => {
		render(HotWallRoom, {
			artworks: fiveArtworks,
			onSelect: vi.fn()
		});

		await expect.element(page.getByText('Blazing Sun')).toBeVisible();
		await expect.element(page.getByText('Artist Alpha')).toBeVisible();
		await expect.element(page.getByText('100')).toBeVisible();
		await expect.element(page.getByText('Hottest')).toBeVisible();
	});

	it.skip('does not show info for #2-#5 tiles', async () => {
		render(HotWallRoom, {
			artworks: fiveArtworks,
			onSelect: vi.fn()
		});

		// The titles of #2-#5 should NOT be visible in the mosaic
		// (they only appear as alt text on images, not as visible text)
		const mosaicSection = page.getByTestId('hot-wall-mosaic');
		await expect.element(mosaicSection).toBeVisible();

		// #1 info is visible
		await expect.element(page.getByText('Blazing Sun')).toBeVisible();

		// #2-#5 titles should not appear as visible text in the mosaic
		// (alt text is not visible text, so getByText should not find them)
		for (const artwork of fiveArtworks.slice(1)) {
			await expect.element(page.getByText(artwork.title)).not.toBeInTheDocument();
		}
	});

	it.skip('calls onSelect when a mosaic tile is clicked', async () => {
		const onSelect = vi.fn();
		render(HotWallRoom, {
			artworks: fiveArtworks,
			onSelect
		});

		await page.getByTestId('hot-wall-tile-art-2').click();
		expect(onSelect).toHaveBeenCalledWith(fiveArtworks[1]);
	});

	it.skip('calls onSelect when an overflow PolaroidCard is clicked', async () => {
		const overflowArtworks = [
			...fiveArtworks,
			makeArtwork('art-6', 'Overflow One', 'Artist Zeta', 10),
			makeArtwork('art-7', 'Overflow Two', 'Artist Eta', 5)
		];
		const onSelect = vi.fn();
		render(HotWallRoom, {
			artworks: overflowArtworks,
			onSelect
		});

		await page.getByTestId('hot-wall-polaroid-art-6').click();
		expect(onSelect).toHaveBeenCalledWith(overflowArtworks[5]);
	});

	it.skip('renders overflow PolaroidCards for artworks beyond the top 5', async () => {
		const overflowArtworks = [
			...fiveArtworks,
			makeArtwork('art-6', 'Overflow One', 'Artist Zeta', 10),
			makeArtwork('art-7', 'Overflow Two', 'Artist Eta', 5)
		];
		render(HotWallRoom, {
			artworks: overflowArtworks,
			onSelect: vi.fn()
		});

		await expect.element(page.getByTestId('hot-wall-polaroid-art-6')).toBeVisible();
		await expect.element(page.getByTestId('hot-wall-polaroid-art-7')).toBeVisible();
		// Overflow cards show their titles (PolaroidCard renders captions)
		await expect.element(page.getByText('Overflow One')).toBeVisible();
		await expect.element(page.getByText('Overflow Two')).toBeVisible();
	});

	it.skip('blurs NSFW artworks when adult content is disabled', async () => {
		const nsfwArtworks = [{ ...fiveArtworks[0], isNsfw: true }];
		render(HotWallRoom, {
			adultContentEnabled: false,
			artworks: nsfwArtworks,
			onSelect: vi.fn()
		});

		await expect.element(page.getByText('Sensitive artwork')).toBeVisible();
		await expect.element(page.getByText('18+')).toBeVisible();
	});

	it.skip('shows NSFW artworks unblurred when adult content is enabled', async () => {
		const nsfwArtworks = [{ ...fiveArtworks[0], isNsfw: true }];
		render(HotWallRoom, {
			adultContentEnabled: true,
			artworks: nsfwArtworks,
			onSelect: vi.fn()
		});

		await expect.element(page.getByText('Sensitive artwork')).not.toBeInTheDocument();
		await expect.element(page.getByAltText('Blazing Sun')).toBeVisible();
	});

	it.skip('handles single artwork gracefully with no empty grid slots', async () => {
		render(HotWallRoom, {
			artworks: [fiveArtworks[0]],
			onSelect: vi.fn()
		});

		await expect.element(page.getByAltText('Blazing Sun')).toBeVisible();
		await expect.element(page.getByText('Blazing Sun')).toBeVisible();
		await expect.element(page.getByText('Hottest')).toBeVisible();
	});
});
