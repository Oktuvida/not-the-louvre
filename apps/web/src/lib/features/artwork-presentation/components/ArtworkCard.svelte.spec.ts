import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ArtworkCard from './ArtworkCard.svelte';

const artwork = {
	artist: 'journey_artist',
	artistAvatar: undefined,
	commentCount: 0,
	comments: [],
	downvotes: 0,
	forkCount: 0,
	id: 'artwork-1',
	imageUrl: '/api/artworks/artwork-1/media',
	score: 12,
	timestamp: Date.now(),
	title: 'Framed Study',
	upvotes: 0,
	viewerVote: null
};

describe('ArtworkCard', () => {
	it('renders a stable standard frame by default', async () => {
		render(ArtworkCard, { artwork });

		const frame = page.getByTestId('artwork-card-frame');

		await expect.element(frame).toHaveAttribute('data-frame-tier', 'standard');
		await expect.element(frame).toHaveAttribute('data-premium-marker', 'false');
	});

	it('switches to a premium frame when rendered as a podium artwork', async () => {
		render(ArtworkCard, { artwork, podiumPosition: 1 });

		const frame = page.getByTestId('artwork-card-frame');

		await expect.element(frame).toHaveAttribute('data-frame-tier', 'premium');
		await expect.element(page.getByText('PREMIUM')).toBeVisible();
	});
});
