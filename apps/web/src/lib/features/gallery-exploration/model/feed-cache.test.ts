import { beforeEach, describe, expect, it } from 'vitest';
import { makeArtwork, makeArtworks } from '$lib/features/gallery-exploration/fixtures/artworks';
import {
	clearRoomFeedCache,
	readRoomFeedSnapshot,
	suppressNextRoomFeedSnapshot,
	writeRoomFeedSnapshot
} from './feed-cache';

describe('room feed cache', () => {
	beforeEach(() => {
		clearRoomFeedCache();
	});

	it('hands a room back the feed and offset it left with', () => {
		writeRoomFeedSnapshot('hot-wall', {
			artworks: makeArtworks(48, { prefix: 'hot-' }),
			pageInfo: { hasMore: true, nextCursor: 'cursor-3' },
			scrollY: 4200
		});

		const restored = readRoomFeedSnapshot('hot-wall');

		expect(restored?.artworks).toHaveLength(48);
		expect(restored?.pageInfo).toEqual({ hasMore: true, nextCursor: 'cursor-3' });
		expect(restored?.scrollY).toBe(4200);
	});

	it('does not remember a room that never paged past its first screen', () => {
		writeRoomFeedSnapshot('mystery', {
			artworks: [],
			pageInfo: { hasMore: true, nextCursor: 'cursor-1' },
			scrollY: 0
		});

		expect(readRoomFeedSnapshot('mystery')).toBeNull();
	});

	it('keeps only the two most recently left rooms', () => {
		const snapshot = (id: string) => ({
			artworks: [makeArtwork({ id })],
			pageInfo: { hasMore: false, nextCursor: null },
			scrollY: 10
		});

		writeRoomFeedSnapshot('hall-of-fame', snapshot('a'));
		writeRoomFeedSnapshot('hot-wall', snapshot('b'));
		writeRoomFeedSnapshot('your-studio', snapshot('c'));

		expect(readRoomFeedSnapshot('hall-of-fame')).toBeNull();
		expect(readRoomFeedSnapshot('hot-wall')).not.toBeNull();
		expect(readRoomFeedSnapshot('your-studio')).not.toBeNull();
	});

	it('caps a runaway feed and keeps paging available from the server', () => {
		writeRoomFeedSnapshot('hot-wall', {
			artworks: makeArtworks(300, { prefix: 'hot-' }),
			pageInfo: { hasMore: false, nextCursor: null },
			scrollY: 90_000
		});

		const restored = readRoomFeedSnapshot('hot-wall');

		expect(restored?.artworks).toHaveLength(240);
		// Truncating the tail must not tell the room the feed is exhausted.
		expect(restored?.pageInfo).toEqual({ hasMore: true, nextCursor: null });
	});
	it('drops the feed a refresh asked to replace', () => {
		writeRoomFeedSnapshot('hot-wall', {
			artworks: makeArtworks(48, { prefix: 'hot-' }),
			pageInfo: { hasMore: true, nextCursor: 'cursor-3' },
			scrollY: 4200
		});

		// Refreshing re-streams the room, so it unmounts and hands its feed over
		// on the way out; that hand-off must not survive the refresh.
		suppressNextRoomFeedSnapshot('hot-wall');
		expect(readRoomFeedSnapshot('hot-wall')).toBeNull();

		writeRoomFeedSnapshot('hot-wall', {
			artworks: makeArtworks(48, { prefix: 'hot-' }),
			pageInfo: { hasMore: true, nextCursor: 'cursor-3' },
			scrollY: 4200
		});

		expect(readRoomFeedSnapshot('hot-wall')).toBeNull();
	});
});
