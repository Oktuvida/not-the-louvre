import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ArtworkDetailPanel from './ArtworkDetailPanel.svelte';

const artwork = {
	artist: 'journey_artist',
	artistAvatar: undefined,
	commentCount: 0,
	comments: [],
	downvotes: 0,
	forkCount: 2,
	id: 'artwork-1',
	imageUrl: '/api/artworks/artwork-1/media',
	score: 4,
	timestamp: Date.now(),
	title: 'Detail artwork',
	upvotes: 0,
	viewerVote: null
};

describe('ArtworkDetailPanel', () => {
	it('links forking into the draw studio with the parent artwork id', async () => {
		render(ArtworkDetailPanel, {
			artwork,
			viewer: { id: 'user-1', role: 'user' }
		});

		await expect.element(page.getByRole('link', { name: 'Fork' })).toHaveAttribute(
			'href',
			'/draw?fork=artwork-1'
		);
		await expect.element(page.getByText('Forks: 2')).toBeVisible();
	});

	it('posts comments and syncs the artwork detail state', async () => {
		const onArtworkChange = vi.fn();
		vi.stubGlobal(
			'fetch',
			vi.fn(async () =>
				new Response(
					JSON.stringify({
						comment: {
							author: { nickname: 'journey_artist' },
							body: 'Great work',
							createdAt: '2026-03-28T12:00:00.000Z',
							id: 'comment-1'
						}
					}),
					{ status: 201 }
				)
			)
		);

		render(ArtworkDetailPanel, {
			artwork,
			onArtworkChange,
			viewer: { id: 'user-1', role: 'user' }
		});

		await page.getByPlaceholder('Say something about this piece').fill('Great work');
		await page.getByRole('button', { name: /Comment/ }).click();

		expect(onArtworkChange).toHaveBeenCalledWith(
			expect.objectContaining({
				commentCount: 1,
				comments: [expect.objectContaining({ id: 'comment-1', text: 'Great work' })]
			})
		);
	});
});
