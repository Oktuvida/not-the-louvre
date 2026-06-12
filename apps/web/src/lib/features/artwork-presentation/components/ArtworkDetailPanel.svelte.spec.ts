import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';

const { goto } = vi.hoisted(() => ({ goto: vi.fn() }));

vi.mock('$app/navigation', () => ({ goto }));

import ArtworkDetailPanel from './ArtworkDetailPanel.svelte';

const artwork = {
	artist: 'journey_artist',
	authorId: 'user-test',
	artistAvatar: undefined,
	commentCount: 0,
	comments: [],
	downvotes: 0,
	forkCount: 2,
	id: 'artwork-1',
	imageUrl: '/api/artworks/artwork-1/media',
	isNsfw: false,
	lineage: { isFork: false, parent: null, parentStatus: 'none' as const },
	score: 4,
	timestamp: Date.now(),
	title: 'Detail artwork',
	upvotes: 0,
	viewerVote: null
};

describe('ArtworkDetailPanel', () => {
	// Clicking the back of the postcard mid-flip is unreliable: while the card
	// rotates, mousedown and mouseup can land on different targets and the
	// browser never synthesizes the click. Wait for the settled 180° transform
	// (rotateY(180deg) → matrix m11 = -1) and for the lift animation to end.
	const openCommentsSide = async () => {
		await page.getByRole('button', { name: 'Read the comments' }).click();
		await vi.waitFor(
			() => {
				const card = document.querySelector('.postcard');
				if (!card) throw new Error('postcard is missing');
				expect(card.className).not.toContain('is-lifting');
				const m11 = Number(getComputedStyle(card).transform.match(/matrix(?:3d)?\(([^,]+)/)?.[1]);
				expect(m11).toBeLessThanOrEqual(-0.9999);
			},
			{ timeout: 3000 }
		);
	};

	it('links forking into the draw studio with the parent artwork id', async () => {
		goto.mockReset();

		render(ArtworkDetailPanel, {
			artwork,
			viewer: { id: 'user-1', role: 'user' }
		});

		await page.getByRole('button', { name: 'Fork' }).click();
		expect(goto).toHaveBeenCalledWith('/draw?fork=artwork-1');
		await expect.element(page.getByText('Artwork details')).not.toBeInTheDocument();
		await expect.element(page.getByText('POWER SCORE')).not.toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Download' })).toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Dismiss details' })).toBeVisible();

		// The fork count is franked on the back of the postcard
		await page.getByRole('button', { name: 'Read the comments' }).click();
		await expect.element(page.getByText('2 forks')).toBeVisible();
	});

	it('shows fork attribution when the artwork comes from a parent artwork', async () => {
		render(ArtworkDetailPanel, {
			artwork: {
				...artwork,
				lineage: {
					isFork: true,
					parent: {
						author: { avatarUrl: null, id: 'user-parent', nickname: 'parent_artist' },
						id: 'artwork-parent',
						title: 'Parent artwork'
					},
					parentStatus: 'available'
				}
			}
		});

		await expect
			.element(page.getByText('Forked from Parent artwork by parent_artist'))
			.toBeVisible();
	});

	it('opens an enlarged author avatar preview from the detail view', async () => {
		render(ArtworkDetailPanel, {
			artwork: {
				...artwork,
				artistAvatar: '/avatars/journey.png'
			}
		});

		await page.getByRole('button', { name: 'Expand avatar for journey_artist' }).click();

		await expect
			.element(page.getByRole('dialog', { name: 'Expanded avatar for journey_artist' }))
			.toBeVisible();
		await page.getByRole('button', { name: 'Close' }).click();
		await expect
			.element(page.getByRole('dialog', { name: 'Expanded avatar for journey_artist' }))
			.not.toBeInTheDocument();
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

	it('keeps the visitor book scrollable inside the postcard back', async () => {
		render(ArtworkDetailPanel, {
			artwork: {
				...artwork,
				comments: [{ author: 'visitor_one', id: 'comment-1', text: 'hello', timestamp: Date.now() }]
			},
			viewer: null
		});

		const guestbook = [...document.querySelectorAll('div')].find(
			(element) =>
				element.className.includes('guestbook-pages') &&
				element.className.includes('overflow-y-auto')
		);
		expect(guestbook).toBeDefined();
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

		expect(document.querySelector('input[placeholder="Write a comment"]')?.id).toBe(
			'artwork-comment-body'
		);
		expect(
			document.querySelector('input[placeholder="Write a comment"]')?.getAttribute('name')
		).toBe('commentBody');

		// The comment form lives on the back of the postcard
		await openCommentsSide();
		await page.getByPlaceholder('Write a comment').fill('Great work');
		await page.getByRole('button', { name: 'Send comment' }).click();

		await vi.waitFor(() => {
			expect(onArtworkChange).toHaveBeenCalledWith(
				expect.objectContaining({
					commentCount: 1,
					comments: [expect.objectContaining({ id: 'comment-1', text: 'Great work' })]
				})
			);
		});
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

		await openCommentsSide();
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

		await openCommentsSide();
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

		await page.getByRole('button', { name: 'Moderation menu' }).click();
		await page.getByRole('button', { name: 'Mark artwork NSFW' }).click();

		await vi.waitFor(() => {
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

	it('blurs NSFW artwork for viewers without the 18+ preference', async () => {
		render(ArtworkDetailPanel, {
			artwork: { ...artwork, isNsfw: true },
			viewer: { id: 'user-other', role: 'user' }
		});

		await expect.element(page.getByText('Sensitive artwork')).toBeVisible();
	});

	it('never blurs the author viewing their own NSFW artwork', async () => {
		render(ArtworkDetailPanel, {
			artwork: { ...artwork, isNsfw: true },
			viewer: { id: 'user-test', role: 'user' }
		});

		await expect.element(page.getByText('Sensitive artwork')).not.toBeInTheDocument();
	});

	it('shows a comments skeleton while the detail is hydrating', async () => {
		render(ArtworkDetailPanel, {
			artwork,
			isHydrating: true
		});

		await expect.element(page.getByTestId('artwork-comments-loading')).toBeInTheDocument();
		await expect
			.element(page.getByText("The visitor's book is empty — be the first to sign it."))
			.not.toBeInTheDocument();
	});

	it('downloads the artwork image as a named file', async () => {
		const fetchSpy = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(new Blob(['fake-image'], { type: 'image/png' }), { status: 200 })
			);
		vi.stubGlobal('fetch', fetchSpy);

		const createObjectURL = vi.fn(() => 'blob:mock-url');
		const revokeObjectURL = vi.fn();
		vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL }));

		const anchorClick = vi
			.spyOn(HTMLAnchorElement.prototype, 'click')
			.mockImplementation(() => undefined);

		render(ArtworkDetailPanel, {
			artwork: { ...artwork, title: 'Detail Artwork!' }
		});

		await page.getByRole('button', { name: 'Download' }).click();

		await vi.waitFor(() => {
			expect(anchorClick).toHaveBeenCalledTimes(1);
		});
		expect(fetchSpy).toHaveBeenCalledWith('/api/artworks/artwork-1/media');
		expect(createObjectURL).toHaveBeenCalledTimes(1);
		expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');

		anchorClick.mockRestore();
	});
});
