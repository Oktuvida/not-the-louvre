import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';

const { goto } = vi.hoisted(() => ({ goto: vi.fn() }));

vi.mock('$app/navigation', () => ({ goto }));

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
	isNsfw: false,
	score: 4,
	timestamp: Date.now(),
	title: 'Detail artwork',
	upvotes: 0,
	viewerVote: null
};

describe('ArtworkDetailPanel', () => {
	it('links forking into the draw studio with the parent artwork id', async () => {
		goto.mockReset();

		render(ArtworkDetailPanel, {
			artwork,
			viewer: { id: 'user-1', role: 'user' }
		});

		await page.getByRole('button', { name: 'Fork' }).click();
		expect(goto).toHaveBeenCalledWith('/draw?fork=artwork-1');
		await expect.element(page.getByText('2 forks')).toBeVisible();
		await expect.element(page.getByText('Artwork details')).not.toBeInTheDocument();
		await expect.element(page.getByText('POWER SCORE')).not.toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Close' })).toBeVisible();
	});

	it('renders artwork detail as read-only for signed-out visitors', async () => {
		goto.mockReset();

		render(ArtworkDetailPanel, {
			artwork,
			viewer: null
		});

		await expect.element(page.getByRole('button', { name: 'Fork' })).not.toBeInTheDocument();
		await expect.element(page.getByPlaceholder('Write a comment')).not.toBeInTheDocument();
		await expect
			.element(page.getByText('Sign in to vote, fork, or leave a comment.'))
			.toBeVisible();
	});

	it('posts comments and syncs the artwork detail state', async () => {
		const onArtworkChange = vi.fn();
		const checkTextContent = vi.fn(async () => ({ status: 'allowed' as const }));
		vi.stubGlobal(
			'fetch',
			vi.fn(
				async () =>
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
			checkTextContent,
			artwork,
			onArtworkChange,
			viewer: { id: 'user-1', role: 'user' }
		});

		await page.getByPlaceholder('Write a comment').fill('Great work');
		await page.getByRole('button', { name: 'Send comment' }).click();

		expect(onArtworkChange).toHaveBeenCalledWith(
			expect.objectContaining({
				commentCount: 1,
				comments: [expect.objectContaining({ id: 'comment-1', text: 'Great work' })]
			})
		);
		expect(checkTextContent).toHaveBeenCalledWith('Great work', 'comment');
	});

	it('blocks comment submission when the text filter rejects the body', async () => {
		const onArtworkChange = vi.fn();
		const fetchSpy = vi.fn();
		const checkTextContent = vi.fn(async () => ({
			message: 'This comment breaks the gallery rules.',
			status: 'blocked' as const
		}));
		vi.stubGlobal('fetch', fetchSpy);

		render(ArtworkDetailPanel, {
			checkTextContent,
			artwork,
			onArtworkChange,
			viewer: { id: 'user-1', role: 'user' }
		});

		await page.getByPlaceholder('Write a comment').fill('blocked text');
		await page.getByRole('button', { name: 'Send comment' }).click();

		await expect.element(page.getByText('This comment breaks the gallery rules.')).toBeVisible();
		expect(fetchSpy).not.toHaveBeenCalled();
		expect(onArtworkChange).not.toHaveBeenCalled();
	});

	it('blocks comment submission when the text filter is unavailable', async () => {
		const onArtworkChange = vi.fn();
		const fetchSpy = vi.fn();
		const checkTextContent = vi.fn(async () => ({
			message: 'Comment safety check is unavailable right now. Please try again.',
			status: 'unavailable' as const
		}));
		vi.stubGlobal('fetch', fetchSpy);

		render(ArtworkDetailPanel, {
			checkTextContent,
			artwork,
			onArtworkChange,
			viewer: { id: 'user-1', role: 'user' }
		});

		await page.getByPlaceholder('Write a comment').fill('retry later');
		await page.getByRole('button', { name: 'Send comment' }).click();

		await expect
			.element(page.getByText('Comment safety check is unavailable right now. Please try again.'))
			.toBeVisible();
		expect(fetchSpy).not.toHaveBeenCalled();
		expect(onArtworkChange).not.toHaveBeenCalled();
	});

	it('shows compact moderation controls for admins inside the artwork action bar', async () => {
		const onArtworkChange = vi.fn();
		const fetchSpy = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({ artwork: { id: 'artwork-1', isHidden: true, isNsfw: true } }),
					{ status: 200 }
				)
			);
		vi.stubGlobal('fetch', fetchSpy);

		render(ArtworkDetailPanel, {
			artwork,
			onArtworkChange,
			viewer: { id: 'admin-1', role: 'admin' }
		});

		await expect.element(page.getByRole('button', { name: 'Report artwork' })).toBeVisible();

		await page.getByRole('button', { name: 'Mark artwork NSFW' }).click();

		expect(fetchSpy).toHaveBeenNthCalledWith(1, '/api/artworks/artwork-1/moderation', {
			body: JSON.stringify({ action: 'mark_nsfw' }),
			headers: { 'content-type': 'application/json' },
			method: 'PATCH'
		});
		expect(onArtworkChange).toHaveBeenCalledWith(
			expect.objectContaining({ isHidden: true, isNsfw: true })
		);
	});
});
