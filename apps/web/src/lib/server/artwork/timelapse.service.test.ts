import { describe, expect, it } from 'vitest';
import { createMemoryDrawingDocumentStore } from '#lib/server/drawing-document/memory-document-store.js';
import { prepareDrawingDocumentForStorage } from '#lib/server/drawing-document/storage.js';
import { decodeDrawingV3, encodeDrawingV3, type InkDocument } from '#lib/stroke/v3.js';
import { DRAWING_LIMITS } from '#lib/shared/artwork/drawing-limits.js';
import { getArtworkTimelapse } from './timelapse.service';
import type { ArtworkReadRecord, ArtworkReadRepository } from './types';

const canvas = { background: '#fdfbf7', height: 768, kind: 'artwork', width: 768 } as const;

const drawn: InkDocument = {
	...canvas,
	strokes: [
		{
			brush: 'ink@1',
			color: '#1d3557',
			pointer: 'pen',
			points: [
				[10, 20],
				[30, 40.25]
			],
			pressures: [512 / 1023, 700 / 1023],
			size: 8,
			start: 0,
			times: [0, 16]
		},
		{
			brush: 'round@1',
			color: '#e63946',
			pointer: 'touch',
			points: [[100, 100]],
			size: 12,
			start: 900,
			times: [0]
		}
	]
};

const record = (overrides: Partial<ArtworkReadRecord>): ArtworkReadRecord => ({
	authorAvatarUrl: null,
	authorId: 'author-1',
	authorNickname: 'painter',
	commentCount: 0,
	createdAt: new Date('2026-10-01T00:00:00Z'),
	forkCount: 0,
	id: 'artwork-1',
	isNsfw: false,
	mediaContentType: 'image/webp',
	mediaSizeBytes: 1000,
	parentAuthorAvatarUrl: null,
	parentAuthorId: null,
	parentAuthorNickname: null,
	parentId: null,
	parentTitle: null,
	score: 0,
	storageKey: 'artworks/author-1/artwork-1.webp',
	title: 'Harbour',
	updatedAt: new Date('2026-10-01T00:00:00Z'),
	...overrides
});

// The real repository only hands a hidden row to its author or a moderator;
// the service checks again, so this fake hands over whatever it holds.
const repositoryHolding = (row: ArtworkReadRecord) =>
	({
		async findArtworkDetailById(id: string) {
			return id === row.id ? row : null;
		}
	}) as unknown as ArtworkReadRepository;

const publish = async (
	json: string,
	parent?: Parameters<typeof prepareDrawingDocumentForStorage>[1]
) => {
	const { store } = createMemoryDrawingDocumentStore();
	const prepared = await prepareDrawingDocumentForStorage(json, parent);
	const key = await store.put(prepared.compressed);
	return { key, store, version: prepared.version };
};

describe('watching an artwork being drawn', () => {
	it('hands a visitor every stroke with the time it was drawn at', async () => {
		const { key, store } = await publish(JSON.stringify(encodeDrawingV3(drawn)));

		const timelapse = await getArtworkTimelapse('artwork-1', {
			repository: repositoryHolding(record({ drawingDocumentKey: key, drawingVersion: 3 })),
			store,
			user: null
		});

		expect(decodeDrawingV3(timelapse.drawing, DRAWING_LIMITS).strokes).toEqual(drawn.strokes);
		expect(timelapse.backdropKey).toBeNull();
		expect(timelapse.isHidden).toBe(false);
	});

	it('replays a fork over the copy of the image it was drawn on', async () => {
		const { key, store } = await publish(JSON.stringify(encodeDrawingV3(drawn)), {
			parent: {
				artwork: 'parent-1',
				document: 'drawings/parent-doc',
				image: 'artworks/author-1/artwork-1.parent.webp'
			}
		});

		const timelapse = await getArtworkTimelapse('artwork-1', {
			repository: repositoryHolding(
				record({ drawingDocumentKey: key, drawingVersion: 3, parentId: 'parent-1' })
			),
			store,
			user: null
		});

		expect(timelapse.backdropKey).toBe('artworks/author-1/artwork-1.parent.webp');
		// Where the copies live is the server's business, not the page's.
		expect(timelapse.drawing.parent).toBeUndefined();
	});

	it('replays a drawing from before timing was recorded, stroke by stroke', async () => {
		const legacy = {
			version: 1,
			...canvas,
			strokes: [
				{ color: '#000000', points: [[1, 1]], size: 4 },
				{ color: '#ffffff', points: [[2, 2]], size: 4 }
			]
		};
		const { key, store } = await publish(JSON.stringify(legacy));

		const timelapse = await getArtworkTimelapse('artwork-1', {
			repository: repositoryHolding(record({ drawingDocumentKey: key, drawingVersion: 2 })),
			store,
			user: null
		});

		const strokes = decodeDrawingV3(timelapse.drawing, DRAWING_LIMITS).strokes;
		expect(strokes.map((stroke) => stroke.color)).toEqual(['#000000', '#ffffff']);
		expect(strokes.every((stroke) => stroke.times.every((time) => time === 0))).toBe(true);
	});

	it('keeps a hidden artwork from visitors but replays it for its author', async () => {
		const { key, store } = await publish(JSON.stringify(encodeDrawingV3(drawn)));
		const repository = repositoryHolding(
			record({ drawingDocumentKey: key, drawingVersion: 3, isHidden: true })
		);

		await expect(
			getArtworkTimelapse('artwork-1', { repository, store, user: null })
		).rejects.toMatchObject({ status: 404 });

		const forAuthor = await getArtworkTimelapse('artwork-1', {
			repository,
			store,
			user: { id: 'author-1', role: 'user' } as never
		});
		expect(forAuthor.isHidden).toBe(true);
	});

	it('answers not found for an artwork with no drawing kept', async () => {
		await expect(
			getArtworkTimelapse('artwork-1', {
				repository: repositoryHolding(record({})),
				store: createMemoryDrawingDocumentStore().store,
				user: null
			})
		).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
	});
});
