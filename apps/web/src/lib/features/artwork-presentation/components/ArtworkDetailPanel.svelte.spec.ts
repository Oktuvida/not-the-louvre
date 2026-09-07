import { page } from 'vitest/browser';
import { writable } from 'svelte/store';
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
				headers: { accept: 'application/json', 'content-type': 'application/json' },
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

	it('never carries the lift or the tilt of the previous artwork into the next one', async () => {
		const { rerender } = render(ArtworkDetailPanel, {
			artwork,
			viewer: { id: 'admin-1', role: 'admin' }
		});

		await page.getByRole('button', { name: 'Read the comments' }).click();

		const card = () => document.querySelector('.postcard');
		await vi.waitFor(() => {
			expect(card()?.className).toContain('is-lifting');
		});

		// Closing mid-flip and opening another piece must not inherit the lift:
		// the moderation controls are gated on `!isLifting`.
		await rerender({ artwork: { ...artwork, id: 'artwork-2', title: 'Next artwork' } });

		expect(card()?.className).not.toContain('is-lifting');
		expect(card()?.className).not.toContain('is-flipped');
		await expect.element(page.getByRole('button', { name: 'Report artwork' })).toBeVisible();
	});

	it('opens the postcard window onto the LQIP instead of blank paper', async () => {
		render(ArtworkDetailPanel, {
			artwork: { ...artwork, imagePlaceholder: 'data:image/webp;base64,lqip' }
		});

		const photo = page.getByAltText('Detail artwork');

		await expect.element(photo).toHaveAttribute('loading', 'eager');
		await expect.element(photo).toHaveAttribute('decoding', 'async');
		await expect.element(photo).toHaveAttribute('fetchpriority', 'high');

		const placeholder = document.querySelector('.nsfw-placeholder');
		expect(placeholder?.getAttribute('src')).toBe('data:image/webp;base64,lqip');
	});

	it('censors the detail with the same treatment as every grid card', async () => {
		render(ArtworkDetailPanel, {
			artwork: {
				...artwork,
				imagePlaceholder: 'data:image/webp;base64,lqip',
				isNsfw: true
			},
			viewer: { id: 'user-other', role: 'user' }
		});

		await expect.element(page.getByText('Sensitive artwork')).toBeVisible();

		// The photo and the LQIP under it both carry the shared blur, so no sharp
		// thumbnail reads around the scrim.
		expect(page.getByAltText('Detail artwork').element().className).toContain('is-sensitive');
		expect(document.querySelector('.nsfw-placeholder')?.className).toContain('is-sensitive');

		// The panel paints its own scrim — the one with the reveal CTA — so the
		// shared component's badge must not be announced underneath it.
		await expect.element(page.getByText('Sensitive content')).not.toBeInTheDocument();
		expect(document.querySelector('.nsfw-scrim')).toBeNull();
		await expect.element(page.getByRole('button', { name: 'Reveal 18+ artworks' })).toBeVisible();
	});

	it('stops censoring a piece the visitor revealed in the grid', async () => {
		render(ArtworkDetailPanel, {
			artwork: { ...artwork, isNsfw: true },
			revealedArtworkIds: writable(new Set(['artwork-1'])),
			viewer: { id: 'user-other', role: 'user' }
		});

		await expect.element(page.getByText('Sensitive artwork')).not.toBeInTheDocument();
	});

	it('shows the viewer their own vote and locks both buttons while one is in flight', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(() => new Promise(() => undefined))
		);

		render(ArtworkDetailPanel, {
			artwork: { ...artwork, upvotes: 3, viewerVote: 'up' as const },
			viewer: { id: 'user-1', role: 'user' }
		});

		const upvote = page.getByRole('button', { name: /👍/ });
		const downvote = page.getByRole('button', { name: /👎/ });

		await expect.element(upvote).toBeVisible();
		expect(upvote.element().className).toContain('vote-cast');
		expect(downvote.element().className).not.toContain('vote-cast');

		await downvote.click();

		await expect.element(upvote).toBeDisabled();
		await expect.element(downvote).toBeDisabled();
	});

	it('exposes the cast vote as a pressed toggle, not only as a ring', async () => {
		render(ArtworkDetailPanel, {
			artwork: { ...artwork, upvotes: 3, viewerVote: 'up' as const },
			viewer: { id: 'user-1', role: 'user' }
		});

		// The ring is the only visual signal of the viewer's own vote, so without
		// aria-pressed a screen reader hears nothing at all about it.
		await expect
			.element(page.getByRole('button', { name: /👍/ }))
			.toHaveAttribute('aria-pressed', 'true');
		await expect
			.element(page.getByRole('button', { name: /👎/ }))
			.toHaveAttribute('aria-pressed', 'false');
	});

	it('answers a failed vote in the museum voice instead of the server code', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(
				async () =>
					new Response(JSON.stringify({ code: 'NOT_FOUND', message: 'Artwork not found' }), {
						status: 404
					})
			)
		);

		render(ArtworkDetailPanel, {
			artwork,
			viewer: { id: 'user-1', role: 'user' }
		});

		await page.getByRole('button', { name: /👍/ }).click();

		await expect.element(page.getByText('This piece has left the wall.')).toBeVisible();
		await expect.element(page.getByText('Artwork not found')).not.toBeInTheDocument();
	});

	it('keeps one notice for both faces of the postcard', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response(JSON.stringify({ code: 'PUBLISH_FAILED' }), { status: 500 }))
		);

		render(ArtworkDetailPanel, {
			artwork,
			viewer: { id: 'user-1', role: 'user' }
		});

		await page.getByRole('button', { name: /👍/ }).click();

		const notice = page.getByRole('alert');
		await expect.element(notice).toBeVisible();
		expect(document.querySelectorAll('.postcard-notice')).toHaveLength(1);

		// The message survives the flip instead of changing face with the card.
		await openCommentsSide();
		await expect.element(notice).toBeVisible();
	});

	it('hands failures to the host status region when one is wired up', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(
				async () =>
					new Response(JSON.stringify({ code: 'FORBIDDEN' }), {
						status: 403
					})
			)
		);
		const onNotify = vi.fn();

		render(ArtworkDetailPanel, {
			artwork,
			onNotify,
			viewer: { id: 'user-1', role: 'user' }
		});

		await page.getByRole('button', { name: /👍/ }).click();

		await vi.waitFor(() => {
			expect(onNotify).toHaveBeenCalledWith('The attendants will not let you do that.');
		});

		// Nothing is said twice: the panel's own line is not even reserved.
		expect(document.querySelectorAll('.postcard-notice')).toHaveLength(0);
		await expect
			.element(page.getByText('The attendants will not let you do that.'))
			.not.toBeInTheDocument();
	});

	it('keeps Tab inside the dialog instead of walking into the gallery behind it', async () => {
		render(ArtworkDetailPanel, {
			artwork,
			viewer: { id: 'user-1', role: 'user' }
		});

		await expect.element(page.getByRole('button', { name: 'Dismiss details' })).toBeVisible();

		const dialog = document.querySelector('[role="dialog"]');
		expect(dialog).toBeInstanceOf(HTMLElement);
		(dialog as HTMLElement).focus();

		const event = new KeyboardEvent('keydown', {
			bubbles: true,
			cancelable: true,
			key: 'Tab',
			shiftKey: true
		});
		document.activeElement?.dispatchEvent(event);

		expect(event.defaultPrevented).toBe(true);
		expect((dialog as HTMLElement).contains(document.activeElement)).toBe(true);
	});

	it('dismisses on Escape even when focus sits inside the postcard', async () => {
		const onClose = vi.fn();

		render(ArtworkDetailPanel, {
			artwork,
			onClose,
			viewer: { id: 'user-1', role: 'user' }
		});

		const flip = page.getByRole('button', { name: 'Read the comments' });
		await expect.element(flip).toBeVisible();
		(flip.element() as HTMLElement).focus();
		flip
			.element()
			.dispatchEvent(
				new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Escape' })
			);

		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it('hands focus back to the avatar that opened the seal preview', async () => {
		render(ArtworkDetailPanel, {
			artwork: { ...artwork, artistAvatar: '/avatars/journey.png' }
		});

		const trigger = page.getByRole('button', { name: 'Expand avatar for journey_artist' });
		await trigger.click();
		await expect
			.element(page.getByRole('dialog', { name: 'Expanded avatar for journey_artist' }))
			.toBeVisible();

		await page.getByRole('button', { name: 'Close' }).click();

		await vi.waitFor(() => {
			expect(document.activeElement).toBe(trigger.element());
		});
	});

	it('returns focus to the element that opened the panel once the outro is done', async () => {
		const opener = document.createElement('button');
		opener.textContent = 'Open artwork';
		document.body.append(opener);
		opener.focus();

		const { rerender } = render(ArtworkDetailPanel, { artwork });

		await vi.waitFor(() => {
			expect(document.activeElement).not.toBe(opener);
		});

		await rerender({ artwork: null });

		await vi.waitFor(
			() => {
				expect(document.activeElement).toBe(opener);
			},
			{ timeout: 2000 }
		);

		opener.remove();
	});

	it('announces async work in a live region', async () => {
		render(ArtworkDetailPanel, {
			artwork,
			isHydrating: true
		});

		const status = document.querySelector('[aria-live="polite"]');

		expect(status?.textContent).toContain('Loading this artwork…');
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
