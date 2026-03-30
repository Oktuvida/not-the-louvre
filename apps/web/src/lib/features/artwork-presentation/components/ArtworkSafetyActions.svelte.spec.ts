import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ArtworkSafetyActions from './ArtworkSafetyActions.svelte';
import type { Artwork } from '$lib/features/artwork-presentation/model/artwork';

const artwork = {
	artist: 'journey_artist',
	comments: [],
	downvotes: 0,
	id: 'artwork-1',
	imageUrl: '/api/artworks/artwork-1/media',
	isHidden: false,
	isNsfw: false,
	score: 8,
	timestamp: Date.now(),
	title: 'Safety study',
	upvotes: 0,
	viewerVote: null
} satisfies Artwork;

describe('ArtworkSafetyActions', () => {
	beforeEach(() => {
		vi.unstubAllGlobals?.();
	});

	it('lets authenticated viewers report an artwork by choosing a reason', async () => {
		const onArtworkPatch = vi.fn();
		const fetchSpy = vi.fn(
			async () =>
				new Response(JSON.stringify({ report: { id: 'report-1', reason: 'spam' } }), {
					status: 201
				})
		);
		vi.stubGlobal('fetch', fetchSpy);

		render(ArtworkSafetyActions, {
			artwork,
			viewer: { id: 'user-1', role: 'user' },
			onArtworkPatch
		});

		await page.getByRole('button', { name: 'Report artwork' }).click();
		await page.getByRole('button', { name: 'Spam' }).click();

		expect(fetchSpy).toHaveBeenCalledWith('/api/artworks/artwork-1/reports', {
			body: JSON.stringify({ reason: 'spam' }),
			headers: { 'content-type': 'application/json' },
			method: 'POST'
		});
		expect(onArtworkPatch).not.toHaveBeenCalled();
		await expect.element(page.getByText('Report submitted.')).toBeVisible();
	});

	it('shows admin quick moderation actions and patches artwork state after hide', async () => {
		const onArtworkPatch = vi.fn();
		const fetchSpy = vi.fn(
			async () =>
				new Response(
					JSON.stringify({ artwork: { id: 'artwork-1', isHidden: true, isNsfw: false } }),
					{
						status: 200
					}
				)
		);
		vi.stubGlobal('fetch', fetchSpy);

		render(ArtworkSafetyActions, {
			artwork,
			viewer: { id: 'admin-1', role: 'admin' },
			onArtworkPatch
		});

		await page.getByRole('button', { name: 'Hide artwork' }).click();

		expect(fetchSpy).toHaveBeenCalledWith('/api/artworks/artwork-1/moderation', {
			body: JSON.stringify({ action: 'hide' }),
			headers: { 'content-type': 'application/json' },
			method: 'PATCH'
		});
		expect(onArtworkPatch).toHaveBeenCalledWith({ isHidden: true, isNsfw: false });
	});
});
