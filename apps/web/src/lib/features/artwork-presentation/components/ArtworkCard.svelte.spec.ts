import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ArtworkCard from './ArtworkCard.svelte';
import type { Artwork } from '$lib/features/artwork-presentation/model/artwork';

const artwork = {
	artist: 'journey_artist',
	artistAvatar: undefined,
	commentCount: 0,
	comments: [],
	downvotes: 0,
	forkCount: 0,
	id: 'artwork-1',
	imageUrl: '/api/artworks/artwork-1/media',
	isNsfw: false,
	lineage: { isFork: false, parent: null, parentStatus: 'none' },
	score: 12,
	timestamp: Date.now(),
	title: 'Framed Study',
	upvotes: 0,
	viewerVote: null
} satisfies Artwork;

describe('ArtworkCard', () => {
	beforeEach(() => {
		vi.unstubAllGlobals?.();
	});

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

	it('shows fork lineage on forked artworks', async () => {
		render(ArtworkCard, {
			artwork: {
				...artwork,
				lineage: {
					isFork: true,
					parent: {
						author: { avatarUrl: null, id: 'user-parent', nickname: 'origin_artist' },
						id: 'artwork-parent',
						title: 'Original Piece'
					},
					parentStatus: 'available'
				}
			}
		});

		await expect.element(page.getByText('Forked')).toBeVisible();
		await expect.element(page.getByText('From Original Piece')).toBeVisible();
	});

	it('renders report and admin moderation controls without triggering card open', async () => {
		const onclick = vi.fn();
		const fetchSpy = vi.fn(
			async () =>
				new Response(
					JSON.stringify({ artwork: { id: 'artwork-1', isHidden: false, isNsfw: true } }),
					{
						status: 200
					}
				)
		);
		vi.stubGlobal('fetch', fetchSpy);

		render(ArtworkCard, {
			artwork,
			onclick,
			viewer: { id: 'admin-1', role: 'admin' }
		});

		await page.getByRole('button', { name: 'Mark artwork NSFW' }).click();

		expect(onclick).not.toHaveBeenCalled();
		expect(fetchSpy).toHaveBeenCalledWith('/api/artworks/artwork-1/moderation', {
			body: JSON.stringify({ action: 'mark_nsfw' }),
			headers: { 'content-type': 'application/json' },
			method: 'PATCH'
		});
	});
});
