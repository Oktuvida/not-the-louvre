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
		await expect
			.element(page.getByTestId('film-reel'))
			.toHaveAttribute('data-reel-orientation', 'horizontal');
	});

	it('applies the tighter mystery mobile shell layout hooks', async () => {
		render(MysteryRoom, {
			artworks: sampleArtworks,
			onSelect: vi.fn()
		});

		const room = document.querySelector('[data-testid="mystery-room"]');
		expect(room).not.toBeNull();
		expect(room?.className).toContain('pt-28');
		expect(room?.className).toContain('gap-8');
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

		expect(document.querySelectorAll('img[alt="Sunset Dreams"]').length).toBeGreaterThan(0);
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

		expect(document.querySelectorAll('.nsfw-badge').length).toBeGreaterThan(0);
	});

	it('calls onRequestMore via idle cycle when hasMore is true', async () => {
		// The idle animation completes one cycle through all artworks, then
		// triggers onIdleCycleComplete → handleIdleCycleComplete → onRequestMore.
		// With 2 artworks and IDLE_DURATION_PER_FRAME=5, one cycle = 10s.
		// We use a tiny pool so the cycle finishes within the test timeout.
		const artworksPool = [makeArtwork('ic-0', 'Idle Cycle 0'), makeArtwork('ic-1', 'Idle Cycle 1')];
		const onRequestMore = vi.fn();
		const onApplyEviction = vi.fn();

		render(MysteryRoom, {
			artworks: artworksPool,
			hasMore: true,
			onApplyEviction,
			onRequestMore,
			onSelect: vi.fn()
		});

		// Wait for the idle cycle to complete (2 artworks × 5s = 10s + buffer)
		await vi.waitFor(
			() => {
				expect(onRequestMore).toHaveBeenCalledOnce();
			},
			{ timeout: 15000 }
		);

		// Eviction should also have been triggered before the load
		expect(onApplyEviction).toHaveBeenCalled();
	});

	it('does not call onRequestMore when hasMore is false', async () => {
		// With 2 artworks × 5s per frame, one idle cycle = 10s.
		// When hasMore is false, handleIdleCycleComplete should NOT call onRequestMore.
		const artworksPool = [makeArtwork('nm-0', 'No More 0'), makeArtwork('nm-1', 'No More 1')];
		const onRequestMore = vi.fn();
		const onApplyEviction = vi.fn();

		render(MysteryRoom, {
			artworks: artworksPool,
			hasMore: false,
			onApplyEviction,
			onRequestMore,
			onSelect: vi.fn()
		});

		// Wait for at least one idle cycle to complete (2 artworks × 5s = 10s + buffer).
		// onApplyEviction is always called; onRequestMore should NOT be called.
		await vi.waitFor(
			() => {
				expect(onApplyEviction).toHaveBeenCalled();
			},
			{ timeout: 15000 }
		);

		expect(onRequestMore).not.toHaveBeenCalled();
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
