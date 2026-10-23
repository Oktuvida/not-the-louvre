import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakePage } from '#lib/testing/fake-page-state.svelte.js';
import { render } from 'vitest-browser-svelte';

const { createRealtimeClient, goto, getBrowserRealtimeClient, refreshAll } = vi.hoisted(() => {
	type RealtimeClientOptions = {
		onChannelEvent?: (table: string | undefined, handler: (payload: unknown) => void) => void;
		onSubscribe?: (callback?: (status: string) => void) => void;
	};

	const createRealtimeClient = (
		options: RealtimeClientOptions | ((callback?: (status: string) => void) => void) = {}
	) => {
		const normalizedOptions = typeof options === 'function' ? { onSubscribe: options } : options;

		const channel = {
			on: vi.fn(
				(_event: string, filter: { table?: string }, handler: (payload: unknown) => void) => {
					normalizedOptions.onChannelEvent?.(filter.table, handler);
					return channel;
				}
			),
			subscribe: vi.fn((callback?: (status: string) => void) => {
				normalizedOptions.onSubscribe?.(callback);
				return channel;
			})
		};

		return {
			channel: vi.fn(() => channel),
			removeChannel: vi.fn(),
			realtime: {
				setAuth: vi.fn(async () => {})
			}
		};
	};

	return {
		createRealtimeClient,
		// A shallow goto (SvelteKit 3's pushState/replaceState) moves the page the
		// way the router would.
		goto: vi.fn(
			async (
				url: string | URL,
				options: { replace?: boolean; shallow?: boolean; state?: Record<string, unknown> } = {}
			) => {
				if (options.shallow) fakePage.set({ state: options.state ?? {}, url });
			}
		),
		getBrowserRealtimeClient: vi.fn(() => createRealtimeClient()),
		refreshAll: vi.fn(async () => {})
	};
});

const setPageValue = (url: string, state: Record<string, unknown> = {}) =>
	fakePage.set({ state, url: new URL(url, 'http://localhost') });

vi.mock('$app/navigation', async () => ({
	...(await import('#lib/testing/fake-navigation.js')).fakeNavigation,
	goto,
	refreshAll
}));

vi.mock(
	'$app/state',
	async () => (await import('#lib/testing/fake-page-state.svelte.js')).fakeAppState
);

vi.mock('#lib/features/realtime/browser-client.js', () => ({
	getBrowserRealtimeClient
}));

import GalleryExplorationPage from './GalleryExplorationPageLayoutHarness.svelte';
import { clearRoomFeedCache, writeRoomFeedSnapshot } from './model/feed-cache';
import { getGalleryRoom } from './model/rooms';
import type { Artwork } from '#lib/features/artwork-presentation/model/artwork.js';

const baseArtwork: Artwork = {
	artist: 'journey_artist',
	authorId: 'user-test',
	artistAvatar: undefined,
	commentCount: 0,
	comments: [],
	downvotes: 0,
	forkCount: 0,
	id: 'base-artwork',
	imageUrl: '/api/artworks/artwork-1/media',
	isNsfw: false,
	score: 42,
	timestamp: Date.now(),
	title: 'Base Artwork',
	upvotes: 0,
	viewerVote: null
};

const createDeferred = <T>() => {
	let resolve!: (value: T) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((innerResolve, innerReject) => {
		resolve = innerResolve;
		reject = innerReject;
	});

	return { promise, reject, resolve };
};

describe('GalleryExplorationPage', () => {
	beforeEach(() => {
		// The per-room feed cache is module scope on purpose (it has to survive
		// the layout's keyed remount); tests must not inherit each other's feeds.
		clearRoomFeedCache();
		vi.unstubAllGlobals?.();
		goto.mockReset();
		getBrowserRealtimeClient.mockReset();
		getBrowserRealtimeClient.mockImplementation(() => createRealtimeClient());
		refreshAll.mockReset();
		setPageValue('/gallery');
		window.scrollTo(0, 0);
	});

	it('cleans the home return query param only once', async () => {
		setPageValue('/gallery?from=home');

		await render(GalleryExplorationPage, {
			artworks: [],
			emptyStateMessage: 'No artworks have reached this gallery room yet.',
			room: getGalleryRoom('hall-of-fame'),
			roomId: 'hall-of-fame'
		});

		await expect
			.element(page.getByText('No artworks have reached this gallery room yet.'))
			.toBeVisible();
		// Cleaning `?from=` off the URL is a shallow, replacing goto.
		expect(goto).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({ replace: true, shallow: true })
		);
	});

	it('renders real discovery artwork cards from route data', async () => {
		await render(GalleryExplorationPage, {
			artworks: [
				{ ...baseArtwork, id: 'artwork-1', title: 'Deterministic Gallery Study' },
				{ ...baseArtwork, id: 'artwork-2', title: 'Second Work' }
			],
			emptyStateMessage: null,
			room: getGalleryRoom('your-studio'),
			roomId: 'your-studio',
			viewer: { id: 'user-1', role: 'user' }
		});

		await expect.element(page.getByText('Deterministic Gallery Study')).toBeVisible();
		await expect.element(page.getByText('Second Work')).toBeVisible();
	});

	it('includes the tightened mobile gallery header shell', async () => {
		await render(GalleryExplorationPage, {
			artworks: [{ ...baseArtwork, id: 'artwork-1', title: 'Deterministic Gallery Study' }],
			emptyStateMessage: null,
			room: getGalleryRoom('hall-of-fame'),
			roomId: 'hall-of-fame'
		});

		const header = document.querySelector('[data-testid="gallery-room-header"]');
		expect(header).not.toBeNull();
		expect(header?.className).toContain('px-3');
	});

	it('renders the hot wall with a lead artwork and supporting grid', async () => {
		await render(GalleryExplorationPage, {
			artworks: [
				{ ...baseArtwork, id: 'artwork-1', title: 'Lead Heat' },
				{ ...baseArtwork, id: 'artwork-2', title: 'Second Spark' },
				{ ...baseArtwork, id: 'artwork-3', title: 'Third Spark' }
			],
			emptyStateMessage: null,
			room: getGalleryRoom('hot-wall'),
			roomId: 'hot-wall'
		});

		await expect.element(page.getByTestId('hot-wall-room')).toBeVisible();
		await expect.element(page.getByTestId('hot-wall-lead')).toBeVisible();
		await expect.element(page.getByText('Hottest right now')).toBeVisible();
		await expect.element(page.getByText('Lead Heat')).toBeVisible();
	});

	it('renders the hot wall own empty state instead of a generic empty state', async () => {
		await render(GalleryExplorationPage, {
			artworks: [],
			emptyStateMessage: 'No artworks have reached this gallery room yet.',
			room: getGalleryRoom('hot-wall'),
			roomId: 'hot-wall'
		});

		await expect.element(page.getByTestId('hot-wall-empty')).toBeVisible();
		await expect.element(page.getByText('Nothing heating up right now')).toBeVisible();
		await expect
			.element(page.getByText('No artworks have reached this gallery room yet.'))
			.not.toBeInTheDocument();
	});

	it('renders the mystery room directly when switching from another room', async () => {
		const screen = await render(GalleryExplorationPage, {
			artworks: [
				{ ...baseArtwork, id: 'public-1', rank: 1, title: 'Champion' },
				{ ...baseArtwork, id: 'public-2', rank: 2, title: 'Runner Up' },
				{ ...baseArtwork, id: 'public-3', rank: 3, title: 'Bronze Star' },
				{ ...baseArtwork, id: 'public-4', rank: 4, title: 'Gallery Favorite' }
			],
			emptyStateMessage: null,
			room: getGalleryRoom('hall-of-fame'),
			roomId: 'hall-of-fame'
		});

		await expect.element(page.getByTestId('podium-artwork-1')).toBeVisible();

		await screen.rerender({
			artworks: [{ ...baseArtwork, id: 'artwork-1', title: 'Mystery Pick' }],
			emptyStateMessage: null,
			room: getGalleryRoom('mystery'),
			roomId: 'mystery'
		});

		await expect.element(page.getByTestId('film-reel')).toBeVisible();
		await expect.element(page.getByTestId('podium-artwork-1')).not.toBeInTheDocument();
	});

	it('reseeds mystery from mystery data after navigating from your-studio', async () => {
		const screen = await render(GalleryExplorationPage, {
			artworks: [{ ...baseArtwork, id: 'studio-1', title: 'My Studio Piece' }],
			discovery: {
				pageInfo: { hasMore: true, nextCursor: 'studio-cursor-1' },
				request: { authorId: 'user-1', limit: 24, sort: 'recent', window: null }
			},
			emptyStateMessage: null,
			room: getGalleryRoom('your-studio'),
			roomId: 'your-studio',
			viewer: { id: 'user-1', role: 'user' }
		});

		await expect.element(page.getByText('My Studio Piece')).toBeVisible();

		await screen.rerender({
			artworks: [{ ...baseArtwork, id: 'mystery-1', title: 'Mystery Arrival' }],
			discovery: {
				pageInfo: { hasMore: true, nextCursor: 'mystery-cursor-1' },
				request: { authorId: null, limit: 12, sort: 'recent', window: null }
			},
			emptyStateMessage: null,
			room: getGalleryRoom('mystery'),
			roomId: 'mystery'
		});

		await expect.element(page.getByTestId('film-reel')).toBeVisible();
		expect(document.querySelectorAll('img[alt="Mystery Arrival"]').length).toBeGreaterThan(0);
		expect(document.querySelectorAll('img[alt="My Studio Piece"]').length).toBe(0);
	});

	it('reseeds your-studio from viewer-scoped data after navigating from hall-of-fame', async () => {
		const screen = await render(GalleryExplorationPage, {
			artworks: [
				{ ...baseArtwork, id: 'public-1', rank: 1, title: 'Public Champion' },
				{ ...baseArtwork, id: 'public-2', rank: 2, title: 'Public Runner Up' },
				{ ...baseArtwork, id: 'public-3', rank: 3, title: 'Public Bronze' },
				{ ...baseArtwork, id: 'public-4', rank: 4, title: 'Public Ranked 4' }
			],
			discovery: {
				pageInfo: { hasMore: false, nextCursor: null },
				request: { authorId: null, limit: 12, sort: 'top', window: 'all' }
			},
			emptyStateMessage: null,
			room: getGalleryRoom('hall-of-fame'),
			roomId: 'hall-of-fame'
		});

		await expect.element(page.getByTestId('podium-artwork-1')).toBeVisible();

		await screen.rerender({
			artworks: [{ ...baseArtwork, id: 'mine-1', title: 'Only Mine' }],
			discovery: {
				pageInfo: { hasMore: false, nextCursor: null },
				request: { authorId: 'user-1', limit: 24, sort: 'recent', window: null }
			},
			emptyStateMessage: null,
			room: getGalleryRoom('your-studio'),
			roomId: 'your-studio',
			viewer: { id: 'user-1', role: 'user' }
		});

		await expect.element(page.getByText('Only Mine')).toBeVisible();
		await expect.element(page.getByText('Public Champion')).not.toBeInTheDocument();
		await expect.element(page.getByText('Public Ranked 4')).not.toBeInTheDocument();
	});

	it('does not leak continuation state into your-studio after navigating from hall-of-fame', async () => {
		const loadMoreArtworks = vi.fn(async () => ({
			artworks: [{ ...baseArtwork, id: 'mine-2', title: 'Loaded Mine 2' }],
			pageInfo: { hasMore: false, nextCursor: null }
		}));

		const screen = await render(GalleryExplorationPage, {
			artworks: [
				{ ...baseArtwork, id: 'public-1', rank: 1, title: 'Public Champion' },
				{ ...baseArtwork, id: 'public-2', rank: 2, title: 'Public Runner Up' },
				{ ...baseArtwork, id: 'public-3', rank: 3, title: 'Public Bronze' },
				{ ...baseArtwork, id: 'public-4', rank: 4, title: 'Public Ranked 4' }
			],
			discovery: {
				pageInfo: { hasMore: false, nextCursor: null },
				request: { authorId: null, limit: 12, sort: 'top', window: 'all' }
			},
			emptyStateMessage: null,
			loadMoreArtworks,
			room: getGalleryRoom('hall-of-fame'),
			roomId: 'hall-of-fame'
		});

		await expect.element(page.getByTestId('podium-artwork-1')).toBeVisible();

		await screen.rerender({
			artworks: [{ ...baseArtwork, id: 'mine-1', title: 'Only Mine' }],
			discovery: {
				pageInfo: { hasMore: true, nextCursor: 'studio-cursor-1' },
				request: { authorId: 'user-1', limit: 24, sort: 'recent', window: null }
			},
			emptyStateMessage: null,
			loadMoreArtworks,
			room: getGalleryRoom('your-studio'),
			roomId: 'your-studio',
			viewer: { id: 'user-1', role: 'user' }
		});

		await expect.element(page.getByText('Only Mine')).toBeVisible();

		const sentinel = document.querySelector('[data-testid="scroll-sentinel"]');
		if (loadMoreArtworks.mock.calls.length === 0) {
			sentinel?.scrollIntoView({ behavior: 'instant', block: 'center' });
		}

		await vi.waitFor(
			() => {
				// Re-issue the scroll on every poll: on a saturated CI runner a single
				// scrollIntoView can land before layout and never intersect.
				document
					.querySelector('[data-testid="scroll-sentinel"]')
					?.scrollIntoView({ behavior: 'instant', block: 'center' });
				expect(loadMoreArtworks).toHaveBeenCalledTimes(1);
			},
			{ timeout: 10_000 }
		);

		expect(loadMoreArtworks).toHaveBeenCalledWith({
			authorId: 'user-1',
			cursor: 'studio-cursor-1',
			limit: 24,
			sort: 'recent',
			window: null
		});
	});

	it('keeps the current room buffer when same-room metadata changes do not change the seed identity', async () => {
		const loadMoreArtworks = vi.fn(async () => ({
			artworks: [{ ...baseArtwork, id: 'mine-2', title: 'Loaded Mine 2' }],
			pageInfo: { hasMore: false, nextCursor: null }
		}));

		const screen = await render(GalleryExplorationPage, {
			artworks: [{ ...baseArtwork, id: 'mine-1', title: 'Only Mine', score: 10 }],
			discovery: {
				pageInfo: { hasMore: true, nextCursor: 'studio-cursor-1' },
				request: { authorId: 'user-1', limit: 24, sort: 'recent', window: null }
			},
			emptyStateMessage: null,
			loadMoreArtworks,
			room: getGalleryRoom('your-studio'),
			roomId: 'your-studio',
			viewer: { id: 'user-1', role: 'user' }
		});

		await expect.element(page.getByText('Only Mine')).toBeVisible();

		const sentinel = document.querySelector('[data-testid="scroll-sentinel"]');
		if (loadMoreArtworks.mock.calls.length === 0) {
			sentinel?.scrollIntoView({ behavior: 'instant', block: 'center' });
		}

		await vi.waitFor(
			() => {
				// Re-issue the scroll on every poll: on a saturated CI runner a single
				// scrollIntoView can land before layout and never intersect.
				document
					.querySelector('[data-testid="scroll-sentinel"]')
					?.scrollIntoView({ behavior: 'instant', block: 'center' });
				expect(loadMoreArtworks).toHaveBeenCalledTimes(1);
			},
			{ timeout: 10_000 }
		);

		await expect.element(page.getByText('Loaded Mine 2')).toBeVisible();

		await screen.rerender({
			artworks: [{ ...baseArtwork, commentCount: 7, id: 'mine-1', title: 'Only Mine', score: 999 }],
			discovery: {
				pageInfo: { hasMore: true, nextCursor: 'studio-cursor-1' },
				request: { authorId: 'user-1', limit: 24, sort: 'recent', window: null }
			},
			emptyStateMessage: null,
			loadMoreArtworks,
			room: getGalleryRoom('your-studio'),
			roomId: 'your-studio',
			viewer: { id: 'user-1', role: 'user' }
		});

		await expect.element(page.getByText('Loaded Mine 2')).toBeVisible();
		await expect.element(page.getByText('⭐ 999')).toBeVisible();
		await expect.element(page.getByText('💬 7')).toBeVisible();
	});

	it('prioritizes the hall-of-fame podium and lets the virtualizer drive ranked card loading', async () => {
		await render(GalleryExplorationPage, {
			artworks: [
				{ ...baseArtwork, id: 'artwork-1', rank: 1, title: 'Champion' },
				{ ...baseArtwork, id: 'artwork-2', rank: 2, title: 'Runner Up' },
				{ ...baseArtwork, id: 'artwork-3', rank: 3, title: 'Bronze Star' },
				{ ...baseArtwork, id: 'artwork-4', rank: 4, title: 'Gallery Favorite' }
			],
			emptyStateMessage: null,
			room: getGalleryRoom('hall-of-fame'),
			roomId: 'hall-of-fame'
		});

		await expect.element(page.getByAltText('Champion')).toHaveAttribute('loading', 'eager');
		await expect.element(page.getByAltText('Champion')).toHaveAttribute('decoding', 'async');
		await expect.element(page.getByAltText('Champion')).toHaveAttribute('fetchpriority', 'high');
		// The whole podium sits above the fold, so all three medalists fetch
		// eagerly at high priority instead of lazy-loading below the hero.
		await expect.element(page.getByAltText('Runner Up')).toHaveAttribute('loading', 'eager');
		await expect.element(page.getByAltText('Runner Up')).toHaveAttribute('fetchpriority', 'high');
		// Ranked cards are mounted by the window virtualizer only when near the
		// viewport, so they load eagerly once mounted instead of double-deferring.
		await expect.element(page.getByAltText('Gallery Favorite')).toHaveAttribute('loading', 'eager');
		await expect
			.element(page.getByAltText('Gallery Favorite'))
			.toHaveAttribute('decoding', 'async');
	});

	it('shows a product empty state instead of fixture content', async () => {
		await render(GalleryExplorationPage, {
			artworks: [],
			emptyStateMessage: 'No artworks have reached this gallery room yet.',
			room: getGalleryRoom('hall-of-fame'),
			roomId: 'hall-of-fame'
		});

		await expect
			.element(page.getByText('No artworks have reached this gallery room yet.'))
			.toBeVisible();
		await expect.element(page.getByText('Sunset Over Mountains')).not.toBeInTheDocument();
	});

	it('hides authenticated-only gallery chrome from signed-out visitors', async () => {
		await render(GalleryExplorationPage, {
			artworks: [],
			emptyStateMessage: 'No artworks have reached this gallery room yet.',
			room: getGalleryRoom('hall-of-fame'),
			roomId: 'hall-of-fame',
			viewer: null
		});

		await expect.element(page.getByRole('link', { name: 'Your Studio' })).not.toBeInTheDocument();
		await expect.element(page.getByRole('link', { name: 'Create Art' })).not.toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Refresh' })).not.toBeInTheDocument();
		await expect
			.element(page.getByText('New pieces will appear here as artists publish them.'))
			.toBeVisible();
	});

	it('shows authenticated gallery chrome and personal empty-state guidance for users', async () => {
		refreshAll.mockReset();

		await render(GalleryExplorationPage, {
			artworks: [],
			emptyStateMessage: 'You have not published any artworks yet.',
			room: getGalleryRoom('your-studio'),
			roomId: 'your-studio',
			viewer: { id: 'user-1', role: 'user' }
		});

		await expect.element(page.getByRole('link', { name: 'Create Art' })).toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Refresh' })).toBeVisible();
		expect(page.getByRole('button', { name: 'Refresh' })).toBeDefined();
		const refreshButton = document.querySelector('[data-sticker-variant="secondary"]');
		expect(refreshButton?.className).toContain('z-20');
		await expect
			.element(page.getByText('Publish a new piece from the studio and it will show up here.'))
			.toBeVisible();

		await page.getByRole('button', { name: 'Refresh' }).click();
		expect(refreshAll).toHaveBeenCalledTimes(1);
	});

	it('renders the your studio room note in normal flow above the artworks', async () => {
		await render(GalleryExplorationPage, {
			artworks: [{ ...baseArtwork, id: 'artwork-1', title: 'Desk Study' }],
			emptyStateMessage: null,
			room: getGalleryRoom('your-studio'),
			roomId: 'your-studio',
			viewer: { id: 'user-1', role: 'user' }
		});

		await expect.element(page.getByTestId('your-studio-room-note-flow')).toBeVisible();
		await expect.element(page.getByText(getGalleryRoom('your-studio').description)).toBeVisible();
		await expect.element(page.getByRole('button', { name: /Desk Study/ })).toBeVisible();
	});

	it('does not request artwork detail during initial gallery render', async () => {
		const loadArtworkDetail = vi.fn(async () => ({
			...baseArtwork,
			forkCount: 0,
			id: 'artwork-1',
			title: 'Deterministic Gallery Study'
		}));

		await render(GalleryExplorationPage, {
			artworks: [{ ...baseArtwork, id: 'artwork-1', title: 'Deterministic Gallery Study' }],
			emptyStateMessage: null,
			loadArtworkDetail,
			room: getGalleryRoom('your-studio'),
			roomId: 'your-studio',
			viewer: { id: 'user-1', role: 'user' }
		});

		await expect
			.element(page.getByRole('button', { name: /Deterministic Gallery Study/ }))
			.toBeVisible();
		expect(loadArtworkDetail).not.toHaveBeenCalled();
	});

	it('does not request artwork detail while scrolling the virtualized studio grid', async () => {
		const loadArtworkDetail = vi.fn(async () => ({
			...baseArtwork,
			forkCount: 0,
			id: 'artwork-1',
			title: 'Artwork 1'
		}));
		const loadMoreArtworks = vi.fn(async () => ({
			artworks: Array.from({ length: 12 }, (_, index) => ({
				...baseArtwork,
				id: `artwork-${index + 4}`,
				title: `Artwork ${index + 4}`
			})),
			pageInfo: { hasMore: false, nextCursor: null }
		}));

		await render(GalleryExplorationPage, {
			artworks: Array.from({ length: 3 }, (_, index) => ({
				...baseArtwork,
				id: `artwork-${index + 1}`,
				title: `Artwork ${index + 1}`
			})),
			discovery: {
				pageInfo: { hasMore: true, nextCursor: 'cursor-1' },
				request: { authorId: 'user-1', limit: 24, sort: 'recent', window: null }
			},
			emptyStateMessage: null,
			loadArtworkDetail,
			loadMoreArtworks,
			room: getGalleryRoom('your-studio'),
			roomId: 'your-studio',
			viewer: { id: 'user-1', role: 'user' }
		});

		// Wait for artworks to render, then scroll sentinel into view
		await expect.element(page.getByRole('button', { name: /Artwork 1/ })).toBeVisible();

		const sentinel = document.querySelector('[data-testid="scroll-sentinel"]');
		sentinel?.scrollIntoView({ behavior: 'instant', block: 'center' });

		await vi.waitFor(
			() => {
				// Re-issue the scroll on every poll: on a saturated CI runner a single
				// scrollIntoView can land before layout and never intersect.
				document
					.querySelector('[data-testid="scroll-sentinel"]')
					?.scrollIntoView({ behavior: 'instant', block: 'center' });
				expect(loadMoreArtworks).toHaveBeenCalledTimes(1);
			},
			{ timeout: 10_000 }
		);
		expect(loadArtworkDetail).not.toHaveBeenCalled();
	});

	it('loads and opens real artwork detail when a user selects a card', async () => {
		const loadArtworkDetail = vi.fn(async () => ({
			...baseArtwork,
			forkCount: 0,
			id: 'artwork-1',
			title: 'Deterministic Gallery Study'
		}));

		await render(GalleryExplorationPage, {
			artworks: [{ ...baseArtwork, id: 'artwork-1', title: 'Deterministic Gallery Study' }],
			emptyStateMessage: null,
			loadArtworkDetail,
			room: getGalleryRoom('your-studio'),
			roomId: 'your-studio',
			viewer: { id: 'user-1', role: 'user' }
		});

		await page.getByRole('button', { name: /Deterministic Gallery Study/ }).click();
		await vi.waitFor(() => {
			expect(loadArtworkDetail).toHaveBeenCalledWith('artwork-1');
		});
		await expect
			.element(
				page.getByRole('dialog', { name: 'Artwork details for Deterministic Gallery Study' })
			)
			.toBeVisible();
	});

	it('records local detail history and closes the overlay when browser state returns to the room', async () => {
		const loadArtworkDetail = vi.fn(async () => ({
			...baseArtwork,
			forkCount: 0,
			id: 'artwork-1',
			title: 'Deterministic Gallery Study'
		}));

		setPageValue('/gallery/your-studio');

		await render(GalleryExplorationPage, {
			artworks: [{ ...baseArtwork, id: 'artwork-1', title: 'Deterministic Gallery Study' }],
			emptyStateMessage: null,
			loadArtworkDetail,
			room: getGalleryRoom('your-studio'),
			roomId: 'your-studio',
			viewer: { id: 'user-1', role: 'user' }
		});

		await page.getByRole('button', { name: /Deterministic Gallery Study/ }).click();

		await expect
			.element(
				page.getByRole('dialog', { name: 'Artwork details for Deterministic Gallery Study' })
			)
			.toBeVisible();
		expect(goto).toHaveBeenCalledWith(
			'/gallery/your-studio',
			expect.objectContaining({
				shallow: true,
				state: expect.objectContaining({
					galleryDetail: expect.objectContaining({
						artworkId: 'artwork-1',
						roomId: 'your-studio',
						source: 'local-room-selection'
					})
				})
			})
		);

		setPageValue('/gallery/your-studio', {});

		await expect
			.element(
				page.getByRole('dialog', { name: 'Artwork details for Deterministic Gallery Study' })
			)
			.not.toBeInTheDocument();
		await expect
			.element(page.getByRole('button', { name: /Deterministic Gallery Study/ }))
			.toBeVisible();
	});

	it('keeps non-local detail states on normal close semantics instead of forcing browser back', async () => {
		const historyBack = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
		const loadArtworkDetail = vi.fn(async () => ({
			...baseArtwork,
			forkCount: 0,
			id: 'artwork-1',
			title: 'Deterministic Gallery Study'
		}));

		setPageValue('/gallery/your-studio', {
			galleryDetail: {
				artworkId: 'artwork-1',
				roomId: 'your-studio',
				source: 'external'
			}
		});

		await render(GalleryExplorationPage, {
			artworks: [{ ...baseArtwork, id: 'artwork-1', title: 'Deterministic Gallery Study' }],
			emptyStateMessage: null,
			loadArtworkDetail,
			room: getGalleryRoom('your-studio'),
			roomId: 'your-studio',
			viewer: { id: 'user-1', role: 'user' }
		});

		await expect
			.element(
				page.getByRole('dialog', { name: 'Artwork details for Deterministic Gallery Study' })
			)
			.toBeVisible();

		await page.getByRole('button', { name: 'Dismiss details' }).click();

		expect(historyBack).not.toHaveBeenCalled();
		expect(goto).toHaveBeenCalledWith(
			'/gallery/your-studio',
			expect.objectContaining({ replace: true, shallow: true, state: {} })
		);
		await expect
			.element(
				page.getByRole('dialog', { name: 'Artwork details for Deterministic Gallery Study' })
			)
			.not.toBeInTheDocument();
	});

	it('keeps realtime subscription failures silent in artwork detail', async () => {
		const fetchSpy = vi.fn(
			async () => new Response(JSON.stringify({ token: 'realtime-token' }), { status: 200 })
		);
		const loadArtworkDetail = vi.fn(async () => ({
			...baseArtwork,
			forkCount: 0,
			id: 'artwork-1',
			title: 'Deterministic Gallery Study'
		}));

		vi.stubGlobal('fetch', fetchSpy);
		getBrowserRealtimeClient.mockImplementation(() =>
			createRealtimeClient((callback) => {
				callback?.('CHANNEL_ERROR');
			})
		);

		await render(GalleryExplorationPage, {
			artworks: [{ ...baseArtwork, id: 'artwork-1', title: 'Deterministic Gallery Study' }],
			emptyStateMessage: null,
			loadArtworkDetail,
			realtimeConfig: { anonKey: 'anon-key', url: 'https://example.supabase.co' },
			room: getGalleryRoom('your-studio'),
			roomId: 'your-studio',
			viewer: { id: 'user-1', role: 'user' }
		});

		await page.getByRole('button', { name: /Deterministic Gallery Study/ }).click();
		await expect
			.element(
				page.getByRole('dialog', { name: 'Artwork details for Deterministic Gallery Study' })
			)
			.toBeVisible();
		await vi.waitFor(() => {
			expect(fetchSpy).toHaveBeenCalledTimes(1);
		});
		await expect
			.element(page.getByText('Realtime updates are temporarily unavailable.'))
			.not.toBeInTheDocument();
	});

	it('propagates realtime detail refreshes back into the visible room card metadata', async () => {
		let voteRefreshHandler: ((payload: unknown) => void) | undefined;
		const fetchSpy = vi.fn(
			async () => new Response(JSON.stringify({ token: 'realtime-token' }), { status: 200 })
		);
		const loadArtworkDetail = vi
			.fn<(...args: [string]) => Promise<Artwork>>()
			.mockResolvedValueOnce({
				...baseArtwork,
				commentCount: 0,
				forkCount: 0,
				id: 'artwork-1',
				score: 0,
				title: 'Deterministic Gallery Study',
				upvotes: 0
			})
			.mockResolvedValueOnce({
				...baseArtwork,
				commentCount: 1,
				comments: [
					{ author: 'guest_artist', id: 'comment-1', text: 'Realtime hello', timestamp: 1 }
				],
				forkCount: 0,
				id: 'artwork-1',
				score: 1,
				title: 'Deterministic Gallery Study',
				upvotes: 1
			});

		vi.stubGlobal('fetch', fetchSpy);
		getBrowserRealtimeClient.mockImplementation(() =>
			createRealtimeClient({
				onChannelEvent: (table, handler) => {
					if (table === 'artwork_vote_realtime') {
						voteRefreshHandler = handler;
					}
				}
			})
		);

		await render(GalleryExplorationPage, {
			artworks: [
				{
					...baseArtwork,
					commentCount: 0,
					id: 'artwork-1',
					score: 0,
					title: 'Deterministic Gallery Study'
				}
			],
			emptyStateMessage: null,
			loadArtworkDetail,
			realtimeConfig: { anonKey: 'anon-key', url: 'https://example.supabase.co' },
			room: getGalleryRoom('your-studio'),
			roomId: 'your-studio',
			viewer: { id: 'user-1', role: 'user' }
		});

		const roomCard = page.getByTestId('virtualized-artwork-card-artwork-1');

		await page.getByRole('button', { name: /Deterministic Gallery Study/ }).click();
		await expect
			.element(
				page.getByRole('dialog', { name: 'Artwork details for Deterministic Gallery Study' })
			)
			.toBeVisible();
		await expect.element(roomCard.getByText('⭐ 0')).toBeVisible();
		await expect.element(roomCard.getByText('💬 0')).toBeVisible();

		voteRefreshHandler?.({ new: { artwork_id: 'artwork-1' } });

		await vi.waitFor(() => {
			expect(loadArtworkDetail).toHaveBeenCalledTimes(2);
		});

		await expect.element(page.getByRole('button', { name: /👍\s*1/ })).toBeVisible();
		await expect.element(roomCard.getByText('⭐ 1')).toBeVisible();
		await expect.element(roomCard.getByText('💬 1')).toBeVisible();
		// The visitor's book is on the back of the postcard, inert until it turns.
		await page.getByRole('button', { name: 'Read the comments' }).click();
		await expect.element(page.getByText('Realtime hello', { exact: false })).toBeVisible();
	});

	it('opens artwork detail from a visible virtualized studio card without losing room context', async () => {
		const loadArtworkDetail = vi.fn(async () => ({
			...baseArtwork,
			forkCount: 0,
			id: 'artwork-3',
			title: 'Artwork 3'
		}));

		await render(GalleryExplorationPage, {
			artworks: Array.from({ length: 6 }, (_, index) => ({
				...baseArtwork,
				id: `artwork-${index + 1}`,
				title: `Artwork ${index + 1}`
			})),
			discovery: {
				pageInfo: { hasMore: false, nextCursor: null },
				request: { authorId: 'user-1', limit: 24, sort: 'recent', window: null }
			},
			emptyStateMessage: null,
			loadArtworkDetail,
			room: getGalleryRoom('your-studio'),
			roomId: 'your-studio',
			viewer: { id: 'user-1', role: 'user' }
		});

		await expect.element(page.getByRole('button', { name: /Artwork 3/ })).toBeVisible();
		await page.getByRole('button', { name: /Artwork 3/ }).click();

		await expect
			.element(page.getByRole('dialog', { name: 'Artwork details for Artwork 3' }))
			.toBeVisible();
		expect(document.querySelector('[data-testid="your-studio-room-note-flow"]')).not.toBeNull();
		expect(loadArtworkDetail).toHaveBeenCalledWith('artwork-3');
	});

	it('shows end-of-list indicator in your-studio when all artworks are loaded', async () => {
		await render(GalleryExplorationPage, {
			artworks: Array.from({ length: 6 }, (_, index) => ({
				...baseArtwork,
				id: `artwork-${index + 1}`,
				title: `Artwork ${index + 1}`
			})),
			discovery: {
				pageInfo: { hasMore: false, nextCursor: null },
				request: { authorId: 'user-1', limit: 24, sort: 'recent', window: null }
			},
			emptyStateMessage: null,
			room: getGalleryRoom('your-studio'),
			roomId: 'your-studio',
			viewer: { id: 'user-1', role: 'user' }
		});

		await expect.element(page.getByRole('button', { name: /Artwork 1/ })).toBeVisible();
		await expect.element(page.getByTestId('scroll-sentinel-end')).toBeVisible();
	});

	it('shows skeleton loading cards in your-studio while fetching more artworks', async () => {
		const deferred = createDeferred<{
			artworks: (typeof baseArtwork)[];
			pageInfo: { hasMore: boolean; nextCursor: string | null };
		}>();
		const loadMoreArtworks = vi.fn(() => deferred.promise);

		await render(GalleryExplorationPage, {
			artworks: Array.from({ length: 3 }, (_, index) => ({
				...baseArtwork,
				id: `artwork-${index + 1}`,
				title: `Artwork ${index + 1}`
			})),
			discovery: {
				pageInfo: { hasMore: true, nextCursor: 'cursor-1' },
				request: { authorId: 'user-1', limit: 24, sort: 'recent', window: null }
			},
			emptyStateMessage: null,
			loadMoreArtworks,
			room: getGalleryRoom('your-studio'),
			roomId: 'your-studio',
			viewer: { id: 'user-1', role: 'user' }
		});

		// Wait for artworks to render first
		await expect.element(page.getByRole('button', { name: /Artwork 1/ })).toBeVisible();

		// The sentinel may already be in the viewport on a mobile screen (414px wide,
		// 1-column layout with ~120px initial virtua item heights). If the observer
		// already fired, loadMoreArtworks is already called. Otherwise scroll it in.
		const sentinel = document.querySelector('[data-testid="scroll-sentinel"]');
		if (loadMoreArtworks.mock.calls.length === 0) {
			sentinel?.scrollIntoView({ behavior: 'instant', block: 'center' });
		}

		await vi.waitFor(
			() => {
				// Re-issue the scroll on every poll: on a saturated CI runner a single
				// scrollIntoView can land before layout and never intersect.
				document
					.querySelector('[data-testid="scroll-sentinel"]')
					?.scrollIntoView({ behavior: 'instant', block: 'center' });
				expect(loadMoreArtworks).toHaveBeenCalledTimes(1);
			},
			{ timeout: 10_000 }
		);

		// Verify skeleton cards are rendered in the DOM while the fetch is in flight.
		// Note: we check DOM presence rather than visibility because Tailwind's
		// aspect-square utility resolves to zero height in the test environment.
		await expect.element(page.getByTestId('scroll-sentinel-skeleton')).toBeInTheDocument();
		await expect.element(page.getByTestId('skeleton-card-0')).toBeInTheDocument();

		deferred.resolve({
			artworks: [{ ...baseArtwork, id: 'artwork-4', title: 'Artwork 4' }],
			pageInfo: { hasMore: false, nextCursor: null }
		});

		await expect.element(page.getByTestId('scroll-sentinel-end')).toBeVisible();
		await expect.element(page.getByRole('button', { name: /Artwork 4/ })).toBeVisible();
	});

	it('shows error with retry in your-studio when fetching more artworks fails', async () => {
		const loadMoreArtworks = vi.fn(
			async (): Promise<{
				artworks: (typeof baseArtwork)[];
				pageInfo: { hasMore: boolean; nextCursor: string | null };
			}> => {
				throw new Error('Gallery discovery could not be loaded');
			}
		);

		await render(GalleryExplorationPage, {
			artworks: Array.from({ length: 3 }, (_, index) => ({
				...baseArtwork,
				id: `artwork-${index + 1}`,
				title: `Artwork ${index + 1}`
			})),
			discovery: {
				pageInfo: { hasMore: true, nextCursor: 'cursor-1' },
				request: { authorId: 'user-1', limit: 24, sort: 'recent', window: null }
			},
			emptyStateMessage: null,
			loadMoreArtworks,
			room: getGalleryRoom('your-studio'),
			roomId: 'your-studio',
			viewer: { id: 'user-1', role: 'user' }
		});

		// Wait for artworks to render
		await expect.element(page.getByRole('button', { name: /Artwork 1/ })).toBeVisible();

		// The sentinel may already be visible (mobile viewport). If not, scroll it in.
		const sentinel = document.querySelector('[data-testid="scroll-sentinel"]');
		if (loadMoreArtworks.mock.calls.length === 0) {
			sentinel?.scrollIntoView({ behavior: 'instant', block: 'center' });
		}

		// Wait for the failed fetch to complete
		await vi.waitFor(
			() => {
				// Re-issue the scroll on every poll: on a saturated CI runner a single
				// scrollIntoView can land before layout and never intersect.
				document
					.querySelector('[data-testid="scroll-sentinel"]')
					?.scrollIntoView({ behavior: 'instant', block: 'center' });
				expect(loadMoreArtworks).toHaveBeenCalledTimes(1);
			},
			{ timeout: 10_000 }
		);

		// Error message and retry button should be visible
		await expect.element(page.getByTestId('scroll-sentinel-error')).toBeVisible();
		await expect.element(page.getByText('Gallery discovery could not be loaded')).toBeVisible();
		await expect.element(page.getByRole('button', { name: /retry/i })).toBeVisible();

		// Click retry — should call loadMoreArtworks again
		loadMoreArtworks.mockResolvedValueOnce({
			artworks: [{ ...baseArtwork, id: 'artwork-4', title: 'Artwork 4' }],
			pageInfo: { hasMore: false, nextCursor: null }
		});

		await page.getByRole('button', { name: /retry/i }).click();

		await vi.waitFor(
			() => {
				expect(loadMoreArtworks).toHaveBeenCalledTimes(2);
			},
			{ timeout: 10_000 }
		);

		// After successful retry, error should be gone and new artwork visible
		await expect.element(page.getByTestId('scroll-sentinel-error')).not.toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: /Artwork 4/ })).toBeVisible();
		await expect.element(page.getByTestId('scroll-sentinel-end')).toBeVisible();
	});

	it('renders your-studio grid rows matching the responsive column count', async () => {
		await render(GalleryExplorationPage, {
			artworks: Array.from({ length: 6 }, (_, index) => ({
				...baseArtwork,
				id: `artwork-${index + 1}`,
				title: `Artwork ${index + 1}`
			})),
			discovery: {
				pageInfo: { hasMore: false, nextCursor: null },
				request: { authorId: 'user-1', limit: 24, sort: 'recent', window: null }
			},
			emptyStateMessage: null,
			room: getGalleryRoom('your-studio'),
			roomId: 'your-studio',
			viewer: { id: 'user-1', role: 'user' }
		});

		// At 414px viewport width (< 768px), grid should use 1-column layout.
		// Each artwork should be in its own row, so 6 artworks = 6 rows.
		await expect.element(page.getByRole('button', { name: /Artwork 1/ })).toBeVisible();
		await expect.element(page.getByRole('button', { name: /Artwork 6/ })).toBeVisible();

		// With 1-column layout, each virtualized row should contain exactly 1 artwork.
		// Verify all 6 artworks are in the DOM (meaning 6 rows were created).
		const cards = document.querySelectorAll('[data-testid^="virtualized-artwork-card-"]');
		expect(cards.length).toBe(6);
	});

	it('renders a partially-filled hall-of-fame podium without duplicate key crashes', async () => {
		await render(GalleryExplorationPage, {
			artworks: [
				{ ...baseArtwork, id: 'artwork-1', rank: 1, title: 'Champion' },
				{ ...baseArtwork, id: 'artwork-2', rank: 2, title: 'Runner Up' }
			],
			emptyStateMessage: null,
			room: getGalleryRoom('hall-of-fame'),
			roomId: 'hall-of-fame'
		});

		await expect.element(page.getByTestId('podium-artwork-1')).toBeVisible();
		await expect.element(page.getByTestId('podium-artwork-2')).toBeVisible();
	});

	it('loads more ranked artworks in hall-of-fame when scrolling to sentinel', async () => {
		const loadMoreArtworks = vi.fn(async () => ({
			artworks: Array.from({ length: 4 }, (_, index) => ({
				...baseArtwork,
				id: `artwork-${index + 8}`,
				rank: index + 8,
				title: `Ranked ${index + 8}`
			})),
			pageInfo: { hasMore: false, nextCursor: null }
		}));

		await render(GalleryExplorationPage, {
			artworks: [
				{ ...baseArtwork, id: 'artwork-1', rank: 1, title: 'Champion' },
				{ ...baseArtwork, id: 'artwork-2', rank: 2, title: 'Runner Up' },
				{ ...baseArtwork, id: 'artwork-3', rank: 3, title: 'Bronze Star' },
				{ ...baseArtwork, id: 'artwork-4', rank: 4, title: 'Ranked 4' },
				{ ...baseArtwork, id: 'artwork-5', rank: 5, title: 'Ranked 5' },
				{ ...baseArtwork, id: 'artwork-6', rank: 6, title: 'Ranked 6' },
				{ ...baseArtwork, id: 'artwork-7', rank: 7, title: 'Ranked 7' }
			],
			discovery: {
				pageInfo: { hasMore: true, nextCursor: 'fame-cursor-1' },
				request: { authorId: null, limit: 12, sort: 'top', window: 'all' }
			},
			emptyStateMessage: null,
			loadMoreArtworks,
			room: getGalleryRoom('hall-of-fame'),
			roomId: 'hall-of-fame'
		});

		// Podium should be visible
		await expect.element(page.getByTestId('podium-artwork-1')).toBeVisible();

		// Ranked grid should show artworks 4-7
		await expect.element(page.getByRole('button', { name: /Ranked 4/ })).toBeVisible();

		// Scroll sentinel into view to trigger load-more
		const sentinel = document.querySelector('[data-testid="scroll-sentinel"]');
		if (loadMoreArtworks.mock.calls.length === 0) {
			sentinel?.scrollIntoView({ behavior: 'instant', block: 'center' });
		}

		await vi.waitFor(
			() => {
				// Re-issue the scroll on every poll: on a saturated CI runner a single
				// scrollIntoView can land before layout and never intersect.
				document
					.querySelector('[data-testid="scroll-sentinel"]')
					?.scrollIntoView({ behavior: 'instant', block: 'center' });
				expect(loadMoreArtworks).toHaveBeenCalledTimes(1);
			},
			{ timeout: 10_000 }
		);

		// New artworks should appear
		await expect.element(page.getByRole('button', { name: /Ranked 8/ })).toBeVisible();
		await expect.element(page.getByTestId('scroll-sentinel-end')).toBeVisible();
	});

	it('keeps hall-of-fame podium visible while loading more ranked artworks', async () => {
		const deferred = createDeferred<{
			artworks: (typeof baseArtwork)[];
			pageInfo: { hasMore: boolean; nextCursor: string | null };
		}>();
		const loadMoreArtworks = vi.fn(() => deferred.promise);

		await render(GalleryExplorationPage, {
			artworks: [
				{ ...baseArtwork, id: 'artwork-1', rank: 1, title: 'Champion' },
				{ ...baseArtwork, id: 'artwork-2', rank: 2, title: 'Runner Up' },
				{ ...baseArtwork, id: 'artwork-3', rank: 3, title: 'Bronze Star' },
				{ ...baseArtwork, id: 'artwork-4', rank: 4, title: 'Ranked 4' }
			],
			discovery: {
				pageInfo: { hasMore: true, nextCursor: 'fame-cursor-1' },
				request: { authorId: null, limit: 12, sort: 'top', window: 'all' }
			},
			emptyStateMessage: null,
			loadMoreArtworks,
			room: getGalleryRoom('hall-of-fame'),
			roomId: 'hall-of-fame'
		});

		await expect.element(page.getByTestId('podium-artwork-1')).toBeVisible();
		await expect.element(page.getByRole('button', { name: /Ranked 4/ })).toBeVisible();

		// Trigger load-more
		const sentinel = document.querySelector('[data-testid="scroll-sentinel"]');
		if (loadMoreArtworks.mock.calls.length === 0) {
			sentinel?.scrollIntoView({ behavior: 'instant', block: 'center' });
		}

		await vi.waitFor(
			() => {
				// Re-issue the scroll on every poll: on a saturated CI runner a single
				// scrollIntoView can land before layout and never intersect.
				document
					.querySelector('[data-testid="scroll-sentinel"]')
					?.scrollIntoView({ behavior: 'instant', block: 'center' });
				expect(loadMoreArtworks).toHaveBeenCalledTimes(1);
			},
			{ timeout: 10_000 }
		);

		// Podium is still visible while loading
		await expect.element(page.getByTestId('podium-artwork-1')).toBeVisible();
		await expect.element(page.getByTestId('scroll-sentinel-skeleton')).toBeInTheDocument();

		deferred.resolve({
			artworks: [{ ...baseArtwork, id: 'artwork-5', rank: 5, title: 'Ranked 5' }],
			pageInfo: { hasMore: false, nextCursor: null }
		});

		await expect.element(page.getByRole('button', { name: /Ranked 5/ })).toBeVisible();
		await expect.element(page.getByTestId('podium-artwork-1')).toBeVisible();
	});

	it('shows end-of-list in hall-of-fame when all ranked artworks are loaded', async () => {
		await render(GalleryExplorationPage, {
			artworks: [
				{ ...baseArtwork, id: 'artwork-1', rank: 1, title: 'Champion' },
				{ ...baseArtwork, id: 'artwork-2', rank: 2, title: 'Runner Up' },
				{ ...baseArtwork, id: 'artwork-3', rank: 3, title: 'Bronze Star' },
				{ ...baseArtwork, id: 'artwork-4', rank: 4, title: 'Ranked 4' }
			],
			discovery: {
				pageInfo: { hasMore: false, nextCursor: null },
				request: { authorId: null, limit: 12, sort: 'top', window: 'all' }
			},
			emptyStateMessage: null,
			room: getGalleryRoom('hall-of-fame'),
			roomId: 'hall-of-fame'
		});

		await expect.element(page.getByTestId('podium-artwork-1')).toBeVisible();
		await expect.element(page.getByTestId('scroll-sentinel-end')).toBeVisible();
	});

	it('shows error with retry in hall-of-fame when fetching more artworks fails', async () => {
		const loadMoreArtworks = vi.fn(async () => {
			throw new Error('Gallery discovery could not be loaded');
		});

		await render(GalleryExplorationPage, {
			artworks: [
				{ ...baseArtwork, id: 'artwork-1', rank: 1, title: 'Champion' },
				{ ...baseArtwork, id: 'artwork-2', rank: 2, title: 'Runner Up' },
				{ ...baseArtwork, id: 'artwork-3', rank: 3, title: 'Bronze Star' },
				{ ...baseArtwork, id: 'artwork-4', rank: 4, title: 'Ranked 4' }
			],
			discovery: {
				pageInfo: { hasMore: true, nextCursor: 'fame-cursor-1' },
				request: { authorId: null, limit: 12, sort: 'top', window: 'all' }
			},
			emptyStateMessage: null,
			loadMoreArtworks,
			room: getGalleryRoom('hall-of-fame'),
			roomId: 'hall-of-fame'
		});

		await expect.element(page.getByTestId('podium-artwork-1')).toBeVisible();

		// Wait for ranked grid to render so the sentinel observer is set up
		await expect.element(page.getByRole('button', { name: /Ranked 4/ })).toBeVisible();

		const sentinel = document.querySelector('[data-testid="scroll-sentinel"]');
		if (loadMoreArtworks.mock.calls.length === 0) {
			sentinel?.scrollIntoView({ behavior: 'instant', block: 'center' });
		}

		await vi.waitFor(
			() => {
				// Re-issue the scroll on every poll: on a saturated CI runner a single
				// scrollIntoView can land before layout and never intersect.
				document
					.querySelector('[data-testid="scroll-sentinel"]')
					?.scrollIntoView({ behavior: 'instant', block: 'center' });
				expect(loadMoreArtworks).toHaveBeenCalledTimes(1);
			},
			{ timeout: 10_000 }
		);

		await expect.element(page.getByTestId('scroll-sentinel-error')).toBeVisible();
		await expect.element(page.getByText('Gallery discovery could not be loaded')).toBeVisible();
		await expect.element(page.getByRole('button', { name: /retry/i })).toBeVisible();
	});

	it('blurs nsfw artworks until the viewer enables 18+ content', async () => {
		const fetchSpy = vi.fn(
			async () => new Response(JSON.stringify({ adultContentEnabled: true }), { status: 200 })
		);
		vi.stubGlobal('fetch', fetchSpy);

		await render(GalleryExplorationPage, {
			adultContentEnabled: false,
			artworks: [
				{ ...baseArtwork, id: 'artwork-1', isNsfw: true, rank: 1, title: 'Adults only study' }
			],
			emptyStateMessage: null,
			loadArtworkDetail: async () => ({
				...baseArtwork,
				id: 'artwork-1',
				isNsfw: true,
				title: 'Adults only study'
			}),
			room: getGalleryRoom('hall-of-fame'),
			roomId: 'hall-of-fame',
			viewer: { id: 'user-1', role: 'user' }
		});

		await expect.element(page.getByText('18+ artworks', { exact: true })).toBeVisible();
		await expect.element(page.getByLabelText('Sensitive artwork, click to reveal')).toBeVisible();
		await page.getByRole('button', { exact: true, name: 'Reveal 18+ artworks' }).click();

		expect(fetchSpy).toHaveBeenCalledWith('/api/viewer/content-preferences', {
			body: JSON.stringify({ adultContentEnabled: true }),
			headers: { accept: 'application/json', 'content-type': 'application/json' },
			method: 'PATCH'
		});
		await expect.element(page.getByRole('button', { name: /Adults only study/ })).toBeVisible();
	});

	it('does not show the 18+ note in your studio', async () => {
		await render(GalleryExplorationPage, {
			adultContentEnabled: false,
			artworks: [{ ...baseArtwork, id: 'artwork-1', isNsfw: true, title: 'Private Study' }],
			emptyStateMessage: null,
			room: getGalleryRoom('your-studio'),
			roomId: 'your-studio',
			viewer: { id: 'user-1', role: 'user' }
		});

		await expect.element(page.getByRole('button', { name: /Private Study/ })).toBeVisible();
		await expect.element(page.getByText('18+ artworks', { exact: true })).not.toBeInTheDocument();
	});

	it('uses frames only for the top-three podium artworks in hall of fame', async () => {
		await render(GalleryExplorationPage, {
			artworks: [
				{ ...baseArtwork, id: 'artwork-1', rank: 1, title: 'Champion' },
				{ ...baseArtwork, id: 'artwork-2', rank: 2, title: 'Runner Up' },
				{ ...baseArtwork, id: 'artwork-3', rank: 3, title: 'Bronze Star' },
				{ ...baseArtwork, id: 'artwork-4', rank: 4, title: 'Gallery Favorite' }
			],
			emptyStateMessage: null,
			room: getGalleryRoom('hall-of-fame'),
			roomId: 'hall-of-fame'
		});

		await expect
			.element(page.getByTestId('podium-frame-1'))
			.toHaveAttribute('data-frame-tier', 'premium');
		await expect
			.element(page.getByTestId('podium-frame-2'))
			.toHaveAttribute('data-frame-tier', 'premium');
		await expect
			.element(page.getByTestId('podium-frame-3'))
			.toHaveAttribute('data-frame-tier', 'premium');
		await expect.element(page.getByTestId('podium-plaque-1')).toBeVisible();
		await expect.element(page.getByTestId('podium-plaque-2')).toBeVisible();
		await expect.element(page.getByTestId('podium-plaque-3')).toBeVisible();
		await expect.element(page.getByTestId('ranked-polaroid-artwork-4')).toBeVisible();
		await expect.element(page.getByTestId('ranked-frame-artwork-4')).not.toBeInTheDocument();
	});

	it('passes continuation props to the mystery room so it can request more artworks', async () => {
		// MysteryRoom owns its StreamingAccumulator and calls loadMore internally
		// during idle progress. The parent binds discovery request context via roomLoadMoreArtworks.
		const mysteryArtworks = [
			{ ...baseArtwork, id: 'mystery-0', title: 'Mystery Art 0' },
			{ ...baseArtwork, id: 'mystery-1', title: 'Mystery Art 1' }
		];

		const loadMoreArtworks = vi.fn(async () => ({
			artworks: Array.from({ length: 12 }, (_, i) => ({
				...baseArtwork,
				id: `mystery-next-${i}`,
				title: `Mystery Next ${i}`
			})),
			pageInfo: { hasMore: false, nextCursor: null }
		}));

		await render(GalleryExplorationPage, {
			artworks: mysteryArtworks,
			discovery: {
				pageInfo: { hasMore: true, nextCursor: 'mystery-cursor-1' },
				request: { authorId: null, limit: 12, sort: 'recent', window: null }
			},
			emptyStateMessage: null,
			loadMoreArtworks,
			room: getGalleryRoom('mystery'),
			roomId: 'mystery'
		});

		await expect.element(page.getByTestId('film-reel')).toBeVisible();

		// Wait for the idle cycle to trigger loadMoreArtworks via the room's StreamingAccumulator
		await vi.waitFor(
			() => {
				expect(loadMoreArtworks).toHaveBeenCalledOnce();
			},
			{ timeout: 15000 }
		);

		expect(loadMoreArtworks).toHaveBeenCalledWith({
			authorId: null,
			cursor: 'mystery-cursor-1',
			limit: 12,
			sort: 'recent',
			window: null
		});
	});

	it('opens artwork detail when the mystery reel spin lands', async () => {
		const landedArtwork = { ...baseArtwork, id: 'mystery-landed', title: 'Landed Artwork' };
		const fetchRandomArtwork = vi.fn(async () => landedArtwork);
		const loadArtworkDetail = vi.fn(async () => landedArtwork);

		await render(GalleryExplorationPage, {
			artworks: [
				{ ...baseArtwork, id: 'mystery-0', title: 'Mystery Art 0' },
				{ ...baseArtwork, id: 'mystery-1', title: 'Mystery Art 1' }
			],
			discovery: {
				pageInfo: { hasMore: false, nextCursor: null },
				request: { authorId: null, limit: 12, sort: 'recent', window: null }
			},
			emptyStateMessage: null,
			fetchRandomArtwork,
			loadArtworkDetail,
			room: getGalleryRoom('mystery'),
			roomId: 'mystery'
		});

		await expect.element(page.getByTestId('film-reel')).toBeVisible();

		const spinButton = page.getByRole('button', { name: /spin/i });
		await spinButton.click();

		await vi.waitFor(
			() => {
				expect(fetchRandomArtwork).toHaveBeenCalledOnce();
			},
			{ timeout: 6000 }
		);

		// After landing, onSelect fires which calls loadArtworkDetail
		await vi.waitFor(
			() => {
				expect(loadArtworkDetail).toHaveBeenCalledWith('mystery-landed');
			},
			{ timeout: 6000 }
		);

		await expect
			.element(page.getByRole('dialog', { name: 'Artwork details for Landed Artwork' }))
			.toBeVisible();
	});

	it('continues cycling the reel after full catalog traversal (hasMore becomes false)', async () => {
		// MysteryRoom's StreamingAccumulator calls loadMore during idle progress.
		// After catalog exhaustion (hasMore: false), the reel remains functional.
		const mysteryArtworks = [
			{ ...baseArtwork, id: 'mystery-0', title: 'Mystery Art 0' },
			{ ...baseArtwork, id: 'mystery-1', title: 'Mystery Art 1' }
		];

		const loadMoreArtworks = vi.fn(async () => ({
			artworks: Array.from({ length: 6 }, (_, i) => ({
				...baseArtwork,
				id: `mystery-last-${i}`,
				title: `Mystery Last ${i}`
			})),
			pageInfo: { hasMore: false, nextCursor: null }
		}));

		await render(GalleryExplorationPage, {
			artworks: mysteryArtworks,
			discovery: {
				pageInfo: { hasMore: true, nextCursor: 'mystery-cursor-1' },
				request: { authorId: null, limit: 12, sort: 'recent', window: null }
			},
			emptyStateMessage: null,
			loadMoreArtworks,
			room: getGalleryRoom('mystery'),
			roomId: 'mystery'
		});

		await expect.element(page.getByTestId('film-reel')).toBeVisible();

		// Wait for the idle cycle to trigger loadMoreArtworks via StreamingAccumulator
		await vi.waitFor(
			() => {
				expect(loadMoreArtworks).toHaveBeenCalledOnce();
			},
			{ timeout: 15000 }
		);

		// After catalog exhausted, reel should still be functional
		const spinButton = page.getByRole('button', { name: /spin/i });
		await expect.element(spinButton).toBeVisible();
		// No additional fetch should have been made (hasMore was false)
		expect(loadMoreArtworks).toHaveBeenCalledTimes(1);
		// Reel is still visible and interactive
		await expect.element(page.getByTestId('film-reel')).toBeVisible();
	});
	it('reserves the podium shape while the hall of fame room streams', async () => {
		const pending = createDeferred<never>();

		await render(GalleryExplorationPage, {
			room: getGalleryRoom('hall-of-fame'),
			roomContent: pending.promise,
			roomId: 'hall-of-fame'
		});

		const skeleton = page.getByTestId('room-loading-skeleton');
		await expect.element(skeleton).toBeInTheDocument();
		await expect.element(skeleton).toHaveAttribute('data-room-skeleton', 'hall-of-fame');

		// A skeleton earns its keep by reserving the shape that arrives: the
		// podium row above the polaroid grid, not eight uniform cards.
		expect(
			document.querySelectorAll('[data-room-skeleton="hall-of-fame"] .animate-pulse').length
		).toBeGreaterThan(3);
		expect(document.querySelector('[data-testid="room-loading-skeleton-grid"]')).not.toBeNull();
	});

	it('reserves the reel shape — and no grid — while the mystery room streams', async () => {
		const pending = createDeferred<never>();

		await render(GalleryExplorationPage, {
			room: getGalleryRoom('mystery'),
			roomContent: pending.promise,
			roomId: 'mystery'
		});

		await expect
			.element(page.getByTestId('room-loading-skeleton'))
			.toHaveAttribute('data-room-skeleton', 'mystery');
		expect(document.querySelector('[data-testid="room-loading-skeleton-grid"]')).toBeNull();
	});

	it('swaps the skeleton for the streamed room inside a single page instance', async () => {
		const deferred = createDeferred<{
			adultContentEnabled: boolean;
			artworks: Artwork[];
			discovery: {
				pageInfo: { hasMore: boolean; nextCursor: string | null };
				request: { authorId: string | null; limit: number; sort: 'recent'; window: null };
			};
			emptyStateMessage: string | null;
		}>();

		await render(GalleryExplorationPage, {
			room: getGalleryRoom('your-studio'),
			roomContent: deferred.promise,
			roomId: 'your-studio',
			viewer: { id: 'user-1', role: 'user' }
		});

		await expect.element(page.getByTestId('room-loading-skeleton')).toBeInTheDocument();
		expect(document.querySelectorAll('[data-testid="gallery-room-content"]')).toHaveLength(1);

		deferred.resolve({
			adultContentEnabled: false,
			artworks: [{ ...baseArtwork, id: 'artwork-1', title: 'Streamed Study' }],
			discovery: {
				pageInfo: { hasMore: false, nextCursor: null },
				request: { authorId: 'user-1', limit: 24, sort: 'recent', window: null }
			},
			emptyStateMessage: null
		});

		await expect.element(page.getByRole('button', { name: /Streamed Study/ })).toBeVisible();
		await expect.element(page.getByTestId('room-loading-skeleton')).not.toBeInTheDocument();
		// One instance across the hand-off: the entry fade and the layout bindings
		// belong to the component that is still on screen afterwards.
		expect(document.querySelectorAll('[data-testid="gallery-room-content"]')).toHaveLength(1);
	});

	it('announces a detail failure in the status region without moving the grid', async () => {
		const loadArtworkDetail = vi.fn(async () => {
			throw new Error('Artwork details could not be loaded');
		});

		await render(GalleryExplorationPage, {
			artworks: [{ ...baseArtwork, id: 'artwork-1', title: 'Deterministic Gallery Study' }],
			emptyStateMessage: null,
			loadArtworkDetail,
			room: getGalleryRoom('your-studio'),
			roomId: 'your-studio',
			viewer: { id: 'user-1', role: 'user' }
		});

		await page.getByRole('button', { name: /Deterministic Gallery Study/ }).click();

		const statusRegion = page.getByTestId('gallery-status-region');
		await expect.element(statusRegion).toMatchTextContent('Artwork details could not be loaded');
		// A failure is worth interrupting for — and it says so from a fixed
		// region, so the room is not shoved down to make room for the notice.
		await expect.element(statusRegion).toHaveAttribute('role', 'alert');
		expect(statusRegion.element().className).toContain('fixed');
	});

	it('keeps the pages a room paged in when its streamed seed lands', async () => {
		writeRoomFeedSnapshot('hot-wall', {
			artworks: [
				{ ...baseArtwork, id: 'cached-1', title: 'Cached Lead' },
				{ ...baseArtwork, id: 'cached-2', title: 'Cached Second' },
				{ ...baseArtwork, id: 'cached-3', title: 'Cached Third' }
			],
			pageInfo: { hasMore: true, nextCursor: 'cursor-9' },
			scrollY: 0
		});

		const deferred = createDeferred<{
			adultContentEnabled: boolean;
			artworks: Artwork[];
			discovery: {
				pageInfo: { hasMore: boolean; nextCursor: string | null };
				request: { authorId: string | null; limit: number; sort: 'hot'; window: null };
			};
			emptyStateMessage: string | null;
		}>();

		await render(GalleryExplorationPage, {
			room: getGalleryRoom('hot-wall'),
			roomContent: deferred.promise,
			roomId: 'hot-wall',
			viewer: { id: 'user-1', role: 'user' }
		});

		deferred.resolve({
			adultContentEnabled: false,
			artworks: [{ ...baseArtwork, id: 'fresh-1', title: 'Fresh Study' }],
			discovery: {
				pageInfo: { hasMore: true, nextCursor: 'cursor-1' },
				request: { authorId: null, limit: 24, sort: 'hot', window: null }
			},
			emptyStateMessage: null
		});

		// The room is built inside the resolved `{#await}` branch, before the page
		// has filled its own `artworks` state — so the seed lands one flush after
		// the restore. It must merge into the restored feed, not replace it.
		await expect.element(page.getByText('Fresh Study')).toBeVisible();
		await vi.waitFor(() => {
			expect(document.querySelector('[data-testid="hot-wall-card-cached-1"]')).not.toBeNull();
			expect(document.querySelector('[data-testid="hot-wall-card-cached-3"]')).not.toBeNull();
		});
	});

	it('announces the streamed room from a region that outlives the skeleton', async () => {
		const deferred = createDeferred<{
			adultContentEnabled: boolean;
			artworks: Artwork[];
			discovery: {
				pageInfo: { hasMore: boolean; nextCursor: string | null };
				request: { authorId: string | null; limit: number; sort: 'recent'; window: null };
			};
			emptyStateMessage: string | null;
		}>();

		await render(GalleryExplorationPage, {
			room: getGalleryRoom('your-studio'),
			roomContent: deferred.promise,
			roomId: 'your-studio',
			viewer: { id: 'user-1', role: 'user' }
		});

		const status = page.getByTestId('gallery-room-status');
		await expect.element(status).toMatchTextContent('Loading artworks');
		// The region predates its message and survives the skeleton it describes.
		expect(
			document.querySelector('[data-testid="room-loading-skeleton"] [role="status"]')
		).toBeNull();
		expect(
			document.querySelector('[aria-busy="true"] [data-testid="room-loading-skeleton"]')
		).not.toBeNull();

		deferred.resolve({
			adultContentEnabled: false,
			artworks: [
				{ ...baseArtwork, id: 'artwork-1', title: 'Streamed Study' },
				{ ...baseArtwork, id: 'artwork-2', title: 'Second Streamed Study' }
			],
			discovery: {
				pageInfo: { hasMore: false, nextCursor: null },
				request: { authorId: 'user-1', limit: 24, sort: 'recent', window: null }
			},
			emptyStateMessage: null
		});

		// The end of the wait is announced too, from the same region.
		await expect.element(status).toMatchTextContent('2 artworks loaded.');
	});

	it('announces a room that failed to stream as an alert', async () => {
		const deferred = createDeferred<never>();
		deferred.promise.catch(() => {});

		await render(GalleryExplorationPage, {
			room: getGalleryRoom('hot-wall'),
			roomContent: deferred.promise,
			roomId: 'hot-wall',
			viewer: { id: 'user-1', role: 'user' }
		});

		deferred.reject(new Error('stream failed'));

		await expect.element(page.getByTestId('gallery-room-error')).toHaveAttribute('role', 'alert');
		// One event, one announcement: the polite region stays quiet.
		await expect.element(page.getByTestId('gallery-room-status')).toHaveTextContent('');
	});

	it('tells a hot wall failure apart from a quiet hot wall', async () => {
		refreshAll.mockReset();
		const deferred = createDeferred<never>();
		deferred.promise.catch(() => {});

		await render(GalleryExplorationPage, {
			room: getGalleryRoom('hot-wall'),
			roomContent: deferred.promise,
			roomId: 'hot-wall',
			viewer: { id: 'user-1', role: 'user' }
		});

		deferred.reject(new Error('stream failed'));

		await expect.element(page.getByTestId('gallery-room-error')).toBeVisible();
		await expect.element(page.getByText('Something went wrong')).toBeVisible();
		// Not the themed "nothing is heating up" panel, which would tell the
		// visitor the product is empty rather than broken.
		expect(document.querySelector('[data-testid="hot-wall-empty"]')).toBeNull();

		await page.getByRole('button', { name: 'Try again' }).click();
		await vi.waitFor(() => {
			expect(refreshAll).toHaveBeenCalledTimes(1);
		});
	});

	it('warms the artwork detail on pointerdown so the click has nothing left to fetch', async () => {
		const loadArtworkDetail = vi.fn(async (artworkId: string) => ({
			...baseArtwork,
			id: artworkId,
			title: 'Champion Study'
		}));

		await render(GalleryExplorationPage, {
			artworks: [
				{ ...baseArtwork, id: 'artwork-1', rank: 1, title: 'Champion Study' },
				{ ...baseArtwork, id: 'artwork-2', title: 'Runner Up Study' },
				{ ...baseArtwork, id: 'artwork-3', title: 'Bronze Study' }
			],
			emptyStateMessage: null,
			loadArtworkDetail,
			room: getGalleryRoom('hall-of-fame'),
			roomId: 'hall-of-fame',
			viewer: { id: 'user-1', role: 'user' }
		});

		const podium = page.getByTestId('podium-artwork-1');
		await expect.element(podium).toBeVisible();

		podium.element().dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));

		await vi.waitFor(() => {
			expect(loadArtworkDetail).toHaveBeenCalledTimes(1);
		});

		await podium.click();

		await expect
			.element(page.getByRole('dialog', { name: 'Artwork details for Champion Study' }))
			.toBeVisible();

		// The open consumed the warm entry instead of firing a second round trip.
		expect(loadArtworkDetail).toHaveBeenCalledTimes(1);
	});

	it('warms the detail from a grid card too, not just the room heroes', async () => {
		const loadArtworkDetail = vi.fn(async (artworkId: string) => ({
			...baseArtwork,
			id: artworkId,
			title: 'Artwork 3'
		}));

		await render(GalleryExplorationPage, {
			artworks: Array.from({ length: 6 }, (_, index) => ({
				...baseArtwork,
				id: `artwork-${index + 1}`,
				title: `Artwork ${index + 1}`
			})),
			discovery: {
				pageInfo: { hasMore: false, nextCursor: null },
				request: { authorId: 'user-1', limit: 24, sort: 'recent', window: null }
			},
			emptyStateMessage: null,
			loadArtworkDetail,
			room: getGalleryRoom('your-studio'),
			roomId: 'your-studio',
			viewer: { id: 'user-1', role: 'user' }
		});

		const card = page.getByRole('button', { name: /Artwork 3/ });
		await expect.element(card).toBeVisible();

		card.element().dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));

		await vi.waitFor(() => {
			expect(loadArtworkDetail).toHaveBeenCalledTimes(1);
		});

		await card.click();

		await expect
			.element(page.getByRole('dialog', { name: 'Artwork details for Artwork 3' }))
			.toBeVisible();

		// The open consumed the warm entry instead of firing a second round trip.
		expect(loadArtworkDetail).toHaveBeenCalledTimes(1);
	});

	it('keeps the podium medal on screen while the detail hydrates', async () => {
		const loadArtworkDetail = vi.fn(async (artworkId: string) => ({
			...baseArtwork,
			id: artworkId,
			// The detail endpoint has no business returning a room position.
			rank: undefined,
			title: 'Champion Study'
		}));

		await render(GalleryExplorationPage, {
			artworks: [
				{ ...baseArtwork, id: 'artwork-1', rank: 1, title: 'Champion Study' },
				{ ...baseArtwork, id: 'artwork-2', title: 'Runner Up Study' },
				{ ...baseArtwork, id: 'artwork-3', title: 'Bronze Study' }
			],
			emptyStateMessage: null,
			loadArtworkDetail,
			room: getGalleryRoom('hall-of-fame'),
			roomId: 'hall-of-fame',
			viewer: { id: 'user-1', role: 'user' }
		});

		await page.getByTestId('podium-artwork-1').click();

		await expect
			.element(page.getByRole('dialog', { name: 'Artwork details for Champion Study' }))
			.toBeVisible();

		await vi.waitFor(() => {
			expect(loadArtworkDetail).toHaveBeenCalled();
		});

		await expect.element(page.getByText('\u{1F947}')).toBeVisible();
	});

	it('gives anonymous visitors a way in from the empty room', async () => {
		await render(GalleryExplorationPage, {
			artworks: [],
			emptyStateMessage: 'No artworks have reached this gallery room yet.',
			room: getGalleryRoom('hall-of-fame'),
			roomId: 'hall-of-fame',
			viewer: null
		});

		await expect.element(page.getByRole('link', { name: /join/i }).first()).toBeVisible();
	});
});
