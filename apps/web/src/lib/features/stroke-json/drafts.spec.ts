import 'fake-indexeddb/auto';

import { beforeEach, describe, expect, it } from 'vitest';

import {
	buildDrawingDraftKey,
	createDrawingDraftSession,
	createIndexedDbDrawingDraftStore,
	loadDrawingDraft
} from './drafts';
import {
	createEmptyDrawingDocument,
	createEmptyDrawingDocumentV2,
	normalizeDrawingDocumentToEditableV2,
	serializeDrawingDocument,
	type DrawingStroke
} from './document';
import { appendCommittedStroke as appendCommittedStrokeToEditable } from './responsive-editing';

const TEST_DATABASE_NAME = 'stroke-json-drafts-spec';
const SNAPSHOT_STORE = 'snapshots';
const JOURNAL_STORE = 'journal';

const writeRawDraftRecords = async (input: {
	databaseName: string;
	journalRecords?: Array<Record<string, unknown>>;
	snapshotRecord?: Record<string, unknown>;
}) =>
	await new Promise<void>((resolve, reject) => {
		const request = indexedDB.open(input.databaseName);

		request.onsuccess = () => {
			const database = request.result;
			const transaction = database.transaction([SNAPSHOT_STORE, JOURNAL_STORE], 'readwrite');

			if (input.snapshotRecord) {
				transaction.objectStore(SNAPSHOT_STORE).put(input.snapshotRecord);
			}

			for (const journalRecord of input.journalRecords ?? []) {
				transaction.objectStore(JOURNAL_STORE).put(journalRecord);
			}

			transaction.oncomplete = () => {
				database.close();
				resolve();
			};
			transaction.onerror = () =>
				reject(transaction.error ?? new Error('Failed to write raw draft records'));
			transaction.onabort = () =>
				reject(transaction.error ?? new Error('Raw draft record write was aborted'));
		};

		request.onerror = () => reject(request.error ?? new Error('Failed to open test database'));
	});

const createStroke = (input: {
	color?: string;
	points: Array<[number, number]>;
	size?: number;
}): DrawingStroke => ({
	color: input.color ?? '#2d2420',
	points: input.points,
	size: input.size ?? 8
});

const createMemoryStorage = (initialEntries: Record<string, string> = {}) => {
	const entries = new Map(Object.entries(initialEntries));

	return {
		getItem: (key: string) => entries.get(key) ?? null,
		removeItem: (key: string) => {
			entries.delete(key);
		},
		setItem: (key: string, value: string) => {
			entries.set(key, value);
		}
	} satisfies Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>;
};

const stableWriteHealthyDraft = async (input: {
	document: ReturnType<typeof createEmptyDrawingDocumentV2>;
	draftKey: string;
	draftStore: ReturnType<typeof createIndexedDbDrawingDraftStore>;
}) => {
	await input.draftStore.writeSnapshot({ draftKey: input.draftKey, document: input.document });
};

const deleteDatabase = async (databaseName: string) =>
	await new Promise<void>((resolve, reject) => {
		const request = indexedDB.deleteDatabase(databaseName);

		request.onsuccess = () => resolve();
		request.onerror = () => reject(request.error ?? new Error('Failed to delete test database'));
		request.onblocked = () => reject(new Error('Test database deletion was blocked'));
	});

beforeEach(async () => {
	await deleteDatabase(TEST_DATABASE_NAME);
});

describe('stroke-json drafts', () => {
	it('builds stable draft identity keys from schema, surface, user, and scope', () => {
		expect(
			buildDrawingDraftKey({
				schemaVersion: 2,
				scope: 'profile',
				surface: 'avatar',
				userKey: 'artist_1'
			})
		).toBe('drawing-draft:v2:avatar:artist_1:profile');

		expect(
			buildDrawingDraftKey({
				schemaVersion: 2,
				scope: 'profile',
				surface: 'avatar',
				userKey: 'artist_2'
			})
		).not.toBe(
			buildDrawingDraftKey({
				schemaVersion: 2,
				scope: 'profile',
				surface: 'artwork',
				userKey: 'artist_2'
			})
		);
	});

	it('hydrates the latest snapshot and replays committed journal strokes in order', async () => {
		const draftStore = createIndexedDbDrawingDraftStore({ databaseName: TEST_DATABASE_NAME });
		const draftKey = buildDrawingDraftKey({
			schemaVersion: 2,
			scope: 'profile',
			surface: 'avatar',
			userKey: 'artist_1'
		});
		const snapshot = createEmptyDrawingDocumentV2('avatar');
		snapshot.tail.push(
			createStroke({
				points: [
					[12, 18],
					[20, 28]
				]
			})
		);

		await draftStore.writeSnapshot({ draftKey, document: snapshot });
		await draftStore.appendCommittedStroke({
			draftKey,
			stroke: createStroke({
				color: '#b85c38',
				points: [
					[24, 36],
					[44, 60]
				]
			})
		});
		await draftStore.appendCommittedStroke({
			draftKey,
			stroke: createStroke({
				color: '#4b6587',
				points: [
					[48, 72],
					[64, 92]
				]
			})
		});

		const hydrated = await draftStore.hydrate(draftKey);

		expect(hydrated).toEqual({
			...snapshot,
			tail: [
				...snapshot.tail,
				createStroke({
					color: '#b85c38',
					points: [
						[24, 36],
						[44, 60]
					]
				}),
				createStroke({
					color: '#4b6587',
					points: [
						[48, 72],
						[64, 92]
					]
				})
			]
		});
	});

	it('hydrates from a seed snapshot and appends one committed stroke through the draft session API', async () => {
		const draftStore = createIndexedDbDrawingDraftStore({ databaseName: TEST_DATABASE_NAME });
		const draftKey = buildDrawingDraftKey({
			schemaVersion: 2,
			scope: 'artwork-parent',
			surface: 'artwork',
			userKey: 'artist_1'
		});
		const session = createDrawingDraftSession({ draftKey, store: draftStore });
		const seedDocument = createEmptyDrawingDocumentV2('artwork');

		const hydrated = await session.hydrate({ seedDocument });

		expect(hydrated).toEqual(seedDocument);
		if (!hydrated) {
			throw new Error('Expected the draft session to hydrate the seeded document');
		}

		const committedDocument = await session.appendCommittedStroke(
			hydrated,
			createStroke({
				color: '#c84f4f',
				points: [
					[96, 120],
					[128, 156],
					[160, 192]
				]
			})
		);

		expect(committedDocument.tail).toEqual([
			createStroke({
				color: '#c84f4f',
				points: [
					[96, 120],
					[128, 156],
					[160, 192]
				]
			})
		]);
		expect(await session.hydrate()).toEqual(committedDocument);
	});

	it('lazily imports a valid legacy V2 localStorage draft on the first IndexedDB miss', async () => {
		const draftStore = createIndexedDbDrawingDraftStore({ databaseName: TEST_DATABASE_NAME });
		const draftKey = buildDrawingDraftKey({
			schemaVersion: 2,
			scope: 'profile',
			surface: 'avatar',
			userKey: 'artist_1'
		});
		const legacyDocument = createEmptyDrawingDocumentV2('avatar');
		legacyDocument.tail.push(
			createStroke({
				points: [
					[20, 22],
					[44, 48]
				]
			})
		);
		const storage = createMemoryStorage({
			[draftKey]: serializeDrawingDocument(legacyDocument)
		});

		const hydrated = await loadDrawingDraft(draftKey, null, { storage, store: draftStore });

		expect(hydrated).toEqual(legacyDocument);
		expect(await draftStore.hydrate(draftKey)).toEqual(legacyDocument);
		expect(storage.getItem(draftKey)).toBe(serializeDrawingDocument(legacyDocument));
	});

	it('lazily imports a valid legacy V1 localStorage draft on the first IndexedDB miss', async () => {
		const draftStore = createIndexedDbDrawingDraftStore({ databaseName: TEST_DATABASE_NAME });
		const draftKey = buildDrawingDraftKey({
			schemaVersion: 2,
			scope: 'artwork-parent',
			surface: 'artwork',
			userKey: 'artist_1'
		});
		const legacyKey = buildDrawingDraftKey({
			schemaVersion: 1,
			scope: 'artwork-parent',
			surface: 'artwork',
			userKey: 'artist_1'
		});
		const legacyDocument = createEmptyDrawingDocument('artwork');
		legacyDocument.strokes.push(
			createStroke({
				points: [
					[48, 64],
					[96, 128]
				]
			})
		);
		const storage = createMemoryStorage({
			[legacyKey]: serializeDrawingDocument(legacyDocument)
		});

		const hydrated = await loadDrawingDraft(draftKey, legacyKey, { storage, store: draftStore });

		expect(hydrated).toEqual(normalizeDrawingDocumentToEditableV2(legacyDocument));
		expect(await draftStore.hydrate(draftKey)).toEqual(
			normalizeDrawingDocumentToEditableV2(legacyDocument)
		);
		expect(storage.getItem(draftKey)).toBeNull();
		expect(storage.getItem(legacyKey)).toBe(serializeDrawingDocument(legacyDocument));
	});

	it('discards malformed legacy localStorage drafts without importing them into IndexedDB', async () => {
		const draftStore = createIndexedDbDrawingDraftStore({ databaseName: TEST_DATABASE_NAME });
		const draftKey = buildDrawingDraftKey({
			schemaVersion: 2,
			scope: 'profile',
			surface: 'avatar',
			userKey: 'artist_1'
		});
		const legacyKey = buildDrawingDraftKey({
			schemaVersion: 1,
			scope: 'profile',
			surface: 'avatar',
			userKey: 'artist_1'
		});
		const storage = createMemoryStorage({
			[legacyKey]: '{bad json'
		});

		const hydrated = await loadDrawingDraft(draftKey, legacyKey, { storage, store: draftStore });

		expect(hydrated).toBeNull();
		expect(await draftStore.hydrate(draftKey)).toBeNull();
		expect(storage.getItem(legacyKey)).toBeNull();
	});

	it('compacts a session into a fresh snapshot without changing the hydrated document', async () => {
		const draftStore = createIndexedDbDrawingDraftStore({ databaseName: TEST_DATABASE_NAME });
		const draftKey = buildDrawingDraftKey({
			schemaVersion: 2,
			scope: 'profile',
			surface: 'avatar',
			userKey: 'artist_1'
		});
		const session = createDrawingDraftSession({ draftKey, store: draftStore });
		const seededDocument = createEmptyDrawingDocumentV2('avatar');
		const hydrated = await session.hydrate({ seedDocument: seededDocument });
		if (!hydrated) {
			throw new Error('Expected the draft session to hydrate the seeded avatar document');
		}
		const withStroke = await session.appendCommittedStroke(
			hydrated,
			createStroke({
				color: '#2f4b9a',
				points: [
					[24, 24],
					[72, 90]
				]
			})
		);

		await session.compact(withStroke);

		const persisted = await draftStore.hydrate(draftKey);
		expect(persisted).toEqual(withStroke);
		expect(await draftStore.listJournalEntries(draftKey)).toEqual([]);
	});

	it('auto-compacts once the journal threshold is reached without changing the hydrated document', async () => {
		const draftStore = createIndexedDbDrawingDraftStore({ databaseName: TEST_DATABASE_NAME });
		const draftKey = buildDrawingDraftKey({
			schemaVersion: 2,
			scope: 'gallery-room',
			surface: 'artwork',
			userKey: 'artist_1'
		});
		const session = createDrawingDraftSession({
			draftKey,
			store: draftStore,
			maxJournalEntriesBeforeCompact: 2
		});
		const seededDocument = createEmptyDrawingDocumentV2('artwork');
		const hydrated = await session.hydrate({ seedDocument: seededDocument });
		if (!hydrated) {
			throw new Error('Expected the draft session to hydrate the seeded artwork document');
		}

		const withFirstStroke = await session.appendCommittedStroke(
			hydrated,
			createStroke({
				color: '#c84f4f',
				points: [
					[96, 120],
					[128, 156]
				]
			})
		);
		expect(await draftStore.listJournalEntries(draftKey)).toHaveLength(1);

		const withSecondStroke = await session.appendCommittedStroke(
			withFirstStroke,
			createStroke({
				color: '#4b6587',
				points: [
					[160, 192],
					[208, 240]
				]
			})
		);

		expect(await draftStore.listJournalEntries(draftKey)).toEqual([]);
		expect(await session.hydrate()).toEqual(withSecondStroke);
	});

	it('keeps the previous snapshot and journal entries when a compaction transaction aborts', async () => {
		const draftStore = createIndexedDbDrawingDraftStore({
			databaseName: TEST_DATABASE_NAME,
			testing: { failCompactAfterSnapshotWrite: true }
		});
		const stableStore = createIndexedDbDrawingDraftStore({ databaseName: TEST_DATABASE_NAME });
		const draftKey = buildDrawingDraftKey({
			schemaVersion: 2,
			scope: 'profile',
			surface: 'avatar',
			userKey: 'artist_1'
		});
		const seedDocument = createEmptyDrawingDocumentV2('avatar');
		const firstStroke = createStroke({
			color: '#2f4b9a',
			points: [
				[24, 24],
				[72, 90]
			]
		});

		await stableStore.writeSnapshot({ draftKey, document: seedDocument });
		await stableStore.appendCommittedStroke({ draftKey, stroke: firstStroke });

		await expect(
			draftStore.compact({
				draftKey,
				document: appendCommittedStrokeToEditable(
					seedDocument,
					createStroke({
						color: '#b85c38',
						points: [
							[88, 110],
							[120, 148]
						]
					})
				)
			})
		).rejects.toThrow();

		expect(await stableStore.hydrate(draftKey)).toEqual(
			appendCommittedStrokeToEditable(seedDocument, firstStroke)
		);
		expect(await stableStore.listJournalEntries(draftKey)).toEqual([firstStroke]);
	});

	it('clears only the corrupted draft identity when hydration encounters invalid persisted data', async () => {
		const draftStore = createIndexedDbDrawingDraftStore({ databaseName: TEST_DATABASE_NAME });
		const corruptedDraftKey = buildDrawingDraftKey({
			schemaVersion: 2,
			scope: 'profile',
			surface: 'avatar',
			userKey: 'artist_1'
		});
		const healthyDraftKey = buildDrawingDraftKey({
			schemaVersion: 2,
			scope: 'gallery-room',
			surface: 'artwork',
			userKey: 'artist_2'
		});
		const healthyDocument = createEmptyDrawingDocumentV2('artwork');
		healthyDocument.tail.push(
			createStroke({
				points: [
					[120, 144],
					[200, 244]
				]
			})
		);

		await stableWriteHealthyDraft({
			draftStore,
			draftKey: healthyDraftKey,
			document: healthyDocument
		});
		await writeRawDraftRecords({
			databaseName: TEST_DATABASE_NAME,
			snapshotRecord: {
				draftKey: corruptedDraftKey,
				document: {
					background: '#ff00ff',
					base: [],
					height: 340,
					kind: 'avatar',
					tail: [{ color: 'not-a-color', points: [], size: 999 }],
					updatedAt: Date.now(),
					version: 2,
					width: 340
				},
				updatedAt: Date.now()
			}
		});

		expect(await draftStore.hydrate(corruptedDraftKey)).toBeNull();
		expect(await draftStore.hydrate(healthyDraftKey)).toEqual(healthyDocument);
		expect(await draftStore.listJournalEntries(corruptedDraftKey)).toEqual([]);
		expect(await draftStore.hydrate(corruptedDraftKey)).toBeNull();
	});

	it('clears persisted state for one draft identity without wiping unrelated drafts', async () => {
		const draftStore = createIndexedDbDrawingDraftStore({ databaseName: TEST_DATABASE_NAME });
		const avatarKey = buildDrawingDraftKey({
			schemaVersion: 2,
			scope: 'profile',
			surface: 'avatar',
			userKey: 'artist_1'
		});
		const artworkKey = buildDrawingDraftKey({
			schemaVersion: 2,
			scope: 'gallery-room',
			surface: 'artwork',
			userKey: 'artist_1'
		});
		const avatarDocument = createEmptyDrawingDocumentV2('avatar');
		avatarDocument.tail.push(
			createStroke({
				points: [
					[12, 12],
					[40, 56]
				]
			})
		);
		const artworkDocument = createEmptyDrawingDocumentV2('artwork');
		artworkDocument.tail.push(
			createStroke({
				points: [
					[120, 144],
					[200, 244]
				]
			})
		);

		await draftStore.writeSnapshot({ draftKey: avatarKey, document: avatarDocument });
		await draftStore.writeSnapshot({ draftKey: artworkKey, document: artworkDocument });
		await draftStore.appendCommittedStroke({
			draftKey: artworkKey,
			stroke: createStroke({
				color: '#6b8e23',
				points: [
					[220, 260],
					[260, 300]
				]
			})
		});

		await draftStore.clear(avatarKey);

		expect(await draftStore.hydrate(avatarKey)).toBeNull();
		expect(await draftStore.hydrate(artworkKey)).toEqual({
			...artworkDocument,
			tail: [
				...artworkDocument.tail,
				createStroke({
					color: '#6b8e23',
					points: [
						[220, 260],
						[260, 300]
					]
				})
			]
		});
	});
});
