import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeArtwork, makeArtworks } from '#lib/features/gallery-exploration/fixtures/artworks.js';
import {
	clearRoomFeedCache,
	followArtworkPatches,
	patchCachedArtwork,
	readRoomFeedSnapshot,
	restoreRoomFeedScroll,
	suppressNextRoomFeedSnapshot,
	writeRoomFeedSnapshot
} from './feed-cache';

/** The server's first page, as a room hands it over with its feed. */
const firstPageOf = (artworks: ReturnType<typeof makeArtworks>) => ({
	artworks: artworks.slice(0, 24),
	pageInfo: { hasMore: artworks.length > 24, nextCursor: artworks.length > 24 ? 'cursor-1' : null }
});

describe('room feed cache', () => {
	it('tells the room on screen about a change, until it stops listening', () => {
		const heard = vi.fn();
		const stop = followArtworkPatches(heard);

		patchCachedArtwork('artwork-9', { score: 3 });
		stop();
		patchCachedArtwork('artwork-9', { score: 4 });

		expect(heard).toHaveBeenCalledExactlyOnceWith('artwork-9', { score: 3 });
	});

	beforeEach(() => {
		clearRoomFeedCache();
	});

	it('hands a room back the feed and offset it left with', () => {
		writeRoomFeedSnapshot('hot-wall', {
			artworks: makeArtworks(48, { prefix: 'hot-' }),
			pageInfo: { hasMore: true, nextCursor: 'cursor-3' },
			scrollY: 4200,
			seed: firstPageOf(makeArtworks(48, { prefix: 'hot-' }))
		});

		const restored = readRoomFeedSnapshot('hot-wall');

		expect(restored?.artworks).toHaveLength(48);
		expect(restored?.pageInfo).toEqual({ hasMore: true, nextCursor: 'cursor-3' });
		expect(restored?.scrollY).toBe(4200);
	});

	it('carries a vote cast in one room into the feed another room left behind', () => {
		const artworks = makeArtworks(48, { prefix: 'hall-' });
		writeRoomFeedSnapshot('hall-of-fame', {
			artworks,
			pageInfo: { hasMore: true, nextCursor: 'cursor-2' },
			scrollY: 900,
			seed: firstPageOf(artworks)
		});
		writeRoomFeedSnapshot('hot-wall', {
			artworks: makeArtworks(30, { prefix: 'hot-' }),
			pageInfo: { hasMore: true, nextCursor: 'cursor-9' },
			scrollY: 300,
			seed: firstPageOf(makeArtworks(30, { prefix: 'hot-' }))
		});
		const deep = artworks[40]!;

		patchCachedArtwork(deep.id, { score: deep.score + 1, upvotes: 1, viewerVote: 'up' });

		expect(readRoomFeedSnapshot('hall-of-fame')?.artworks[40]).toMatchObject({
			id: deep.id,
			score: deep.score + 1,
			upvotes: 1,
			viewerVote: 'up'
		});
		expect(readRoomFeedSnapshot('hall-of-fame')?.scrollY).toBe(900);
		expect(readRoomFeedSnapshot('hot-wall')?.artworks).toHaveLength(30);
	});

	it('carries the vote into the first page a room goes back up with', () => {
		const artworks = makeArtworks(30, { prefix: 'hall-' });
		writeRoomFeedSnapshot('hall-of-fame', {
			artworks: artworks.slice(3),
			pageInfo: { hasMore: true, nextCursor: 'cursor-2' },
			scrollY: 0,
			seed: firstPageOf(artworks)
		});
		const champion = artworks[0]!;

		patchCachedArtwork(champion.id, { score: champion.score + 1, viewerVote: 'up' });

		// The podium is drawn from the seed, not from the feed below it.
		expect(readRoomFeedSnapshot('hall-of-fame')?.seed.artworks[0]).toMatchObject({
			id: champion.id,
			score: champion.score + 1,
			viewerVote: 'up'
		});
	});

	it('does not remember a room that never paged past its first screen', () => {
		writeRoomFeedSnapshot('mystery', {
			artworks: [],
			pageInfo: { hasMore: true, nextCursor: 'cursor-1' },
			scrollY: 0,
			seed: firstPageOf([])
		});

		expect(readRoomFeedSnapshot('mystery')).toBeNull();
	});

	it('remembers every room the visitor walked through', () => {
		const snapshot = (id: string) => ({
			artworks: [makeArtwork({ id })],
			pageInfo: { hasMore: false, nextCursor: null },
			scrollY: 10,
			seed: { artworks: [makeArtwork({ id })], pageInfo: { hasMore: false, nextCursor: null } }
		});

		writeRoomFeedSnapshot('hall-of-fame', snapshot('a'));
		writeRoomFeedSnapshot('hot-wall', snapshot('b'));
		writeRoomFeedSnapshot('mystery', snapshot('c'));
		writeRoomFeedSnapshot('your-studio', snapshot('d'));

		// Any of them can be walked back into, and each goes straight back up.
		expect(readRoomFeedSnapshot('hall-of-fame')?.seed.artworks[0]?.id).toBe('a');
		expect(readRoomFeedSnapshot('hot-wall')?.seed.artworks[0]?.id).toBe('b');
		expect(readRoomFeedSnapshot('mystery')?.seed.artworks[0]?.id).toBe('c');
		expect(readRoomFeedSnapshot('your-studio')?.seed.artworks[0]?.id).toBe('d');
	});

	it('forgets a runaway feed rather than restoring one that can never grow', () => {
		writeRoomFeedSnapshot('hot-wall', {
			artworks: makeArtworks(300, { prefix: 'hot-' }),
			pageInfo: { hasMore: true, nextCursor: 'cursor-12' },
			scrollY: 90_000,
			seed: firstPageOf(makeArtworks(300, { prefix: 'hot-' }))
		});

		// Truncating the tail would restore pages whose cursor is gone: the room
		// would dead-end at the cap with no loader and no end-of-feed line. Past
		// the cap the room refetches its first page, as it did before the cache.
		expect(readRoomFeedSnapshot('hot-wall')).toBeNull();
	});

	it('keeps a feed that sits exactly on the cap, cursor intact', () => {
		writeRoomFeedSnapshot('hot-wall', {
			artworks: makeArtworks(240, { prefix: 'hot-' }),
			pageInfo: { hasMore: true, nextCursor: 'cursor-10' },
			scrollY: 72_000,
			seed: firstPageOf(makeArtworks(240, { prefix: 'hot-' }))
		});

		const restored = readRoomFeedSnapshot('hot-wall');

		expect(restored?.artworks).toHaveLength(240);
		// Whatever comes back has to be something `loadMore()` can act on.
		expect(restored?.pageInfo).toEqual({ hasMore: true, nextCursor: 'cursor-10' });
	});
	it('drops the feed a refresh asked to replace', () => {
		writeRoomFeedSnapshot('hot-wall', {
			artworks: makeArtworks(48, { prefix: 'hot-' }),
			pageInfo: { hasMore: true, nextCursor: 'cursor-3' },
			scrollY: 4200,
			seed: firstPageOf(makeArtworks(48, { prefix: 'hot-' }))
		});

		// Refreshing re-streams the room, so it unmounts and hands its feed over
		// on the way out; that hand-off must not survive the refresh.
		suppressNextRoomFeedSnapshot('hot-wall');
		expect(readRoomFeedSnapshot('hot-wall')).toBeNull();

		writeRoomFeedSnapshot('hot-wall', {
			artworks: makeArtworks(48, { prefix: 'hot-' }),
			pageInfo: { hasMore: true, nextCursor: 'cursor-3' },
			scrollY: 4200,
			seed: firstPageOf(makeArtworks(48, { prefix: 'hot-' }))
		});

		expect(readRoomFeedSnapshot('hot-wall')).toBeNull();
	});
});

describe('room feed scroll restore', () => {
	let scrollHeight = 0;
	let frames: FrameRequestCallback[] = [];
	let cancelled: number[] = [];
	let nextHandle = 0;
	const scrollTo = vi.fn();

	const runNextFrame = () => {
		const frame = frames.shift();
		if (!frame) throw new Error('no frame was scheduled');
		frame(0);
	};

	beforeEach(() => {
		scrollTo.mockClear();
		frames = [];
		cancelled = [];
		nextHandle = 0;
		scrollHeight = 0;

		vi.stubGlobal('window', { innerHeight: 800, scrollTo });
		vi.stubGlobal('document', {
			documentElement: {
				get scrollHeight() {
					return scrollHeight;
				}
			}
		});
		vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
			frames.push(callback);
			nextHandle += 1;
			return nextHandle;
		});
		vi.stubGlobal('cancelAnimationFrame', (handle: number) => {
			cancelled.push(handle);
		});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('does nothing for a room that was left at the top', () => {
		const stop = restoreRoomFeedScroll(0);

		expect(frames).toHaveLength(0);
		expect(scrollTo).not.toHaveBeenCalled();
		expect(() => stop()).not.toThrow();
	});

	it('jumps to the remembered offset once the feed is tall enough to hold it', () => {
		scrollHeight = 900;
		restoreRoomFeedScroll(4200);

		// The virtualizer has not measured yet: retry instead of landing short.
		runNextFrame();
		expect(scrollTo).not.toHaveBeenCalled();

		scrollHeight = 6000;
		runNextFrame();

		expect(scrollTo).toHaveBeenCalledTimes(1);
		expect(scrollTo).toHaveBeenCalledWith({ behavior: 'instant', left: 0, top: 4200 });
		expect(frames).toHaveLength(0);
	});

	it('gives up after a bounded number of frames at the closest reachable offset', () => {
		scrollHeight = 1000;
		restoreRoomFeedScroll(4200);

		for (let frame = 0; frame < 40; frame += 1) {
			runNextFrame();
		}

		// Never back to 0: a shorter feed still lands where the reader was.
		expect(scrollTo).toHaveBeenCalledTimes(1);
		expect(scrollTo).toHaveBeenCalledWith({ behavior: 'instant', left: 0, top: 200 });
		expect(frames).toHaveLength(0);
	});

	it('cancels the pending frame when the room is torn down mid-restore', () => {
		scrollHeight = 100;
		const stop = restoreRoomFeedScroll(4200);

		runNextFrame();
		stop();

		expect(cancelled).toEqual([2]);
		expect(scrollTo).not.toHaveBeenCalled();
	});
});
