import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import MysteryRoom from './MysteryRoom.svelte';
import type { Artwork } from '$lib/features/artwork-presentation/model/artwork';

const makeArtwork = (id: string, title: string): Artwork => ({
	artist: `artist-${id}`,
	artistAvatar: undefined,
	commentCount: 0,
	comments: [],
	downvotes: 0,
	forkCount: 0,
	id,
	imageUrl: `/api/artworks/${id}/media`,
	isNsfw: false,
	score: 10,
	timestamp: Date.now(),
	title,
	upvotes: 10,
	viewerVote: null
});

const sampleArtworks = [
	makeArtwork('a1', 'Sunset Dreams'),
	makeArtwork('a2', 'Ocean Waves'),
	makeArtwork('a3', 'Forest Path'),
	makeArtwork('a4', 'City Lights'),
	makeArtwork('a5', 'Desert Dunes')
];

describe('MysteryRoom', () => {
	it('renders a film reel with artwork frames visible on the strip', async () => {
		render(MysteryRoom, {
			artworks: sampleArtworks,
			onSelect: vi.fn()
		});

		await expect.element(page.getByTestId('film-reel')).toBeVisible();
		await expect.element(page.getByTestId('film-reel-track')).toBeVisible();
	});

	it('shows the spin button that triggers the reel animation', async () => {
		render(MysteryRoom, {
			artworks: sampleArtworks,
			onSelect: vi.fn()
		});

		await expect.element(page.getByRole('button', { name: /spin/i })).toBeVisible();
	});

	it('disables the spin button while the reel is spinning', async () => {
		render(MysteryRoom, {
			artworks: sampleArtworks,
			onSelect: vi.fn()
		});

		const spinButton = page.getByRole('button', { name: /spin/i });
		await spinButton.click();

		await expect.element(spinButton).toBeDisabled();
	});

	it('calls onSelect with the landed artwork after the spin completes', async () => {
		const onSelect = vi.fn();

		render(MysteryRoom, {
			artworks: sampleArtworks,
			onSelect
		});

		await page.getByRole('button', { name: /spin/i }).click();

		await vi.waitFor(
			() => {
				expect(onSelect).toHaveBeenCalledOnce();
			},
			{ timeout: 6000 }
		);

		const calledWith = onSelect.mock.calls[0]![0] as Artwork;
		expect(sampleArtworks.some((a) => a.id === calledWith.id)).toBe(true);
	});

	it('renders artwork images inside the reel viewport', async () => {
		render(MysteryRoom, {
			artworks: sampleArtworks,
			onSelect: vi.fn()
		});

		await expect.element(page.getByAltText('Sunset Dreams')).toBeVisible();
	});

	it('renders helper text explaining the feature', async () => {
		render(MysteryRoom, {
			artworks: sampleArtworks,
			onSelect: vi.fn()
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

		render(MysteryRoom, {
			adultContentEnabled: false,
			artworks: nsfwArtworks,
			onSelect: vi.fn()
		});

		await expect.element(page.getByText('18+')).toBeVisible();
	});

	it('shows nsfw artworks unblurred when adult content is enabled', async () => {
		const nsfwArtworks = [
			{ ...makeArtwork('nsfw-1', 'Spicy Art'), isNsfw: true },
			makeArtwork('safe-1', 'Safe Art'),
			makeArtwork('safe-2', 'Also Safe'),
			makeArtwork('safe-3', 'Very Safe'),
			makeArtwork('safe-4', 'Super Safe')
		];

		render(MysteryRoom, {
			adultContentEnabled: true,
			artworks: nsfwArtworks,
			onSelect: vi.fn()
		});

		await expect.element(page.getByText('18+')).not.toBeInTheDocument();
	});
});
