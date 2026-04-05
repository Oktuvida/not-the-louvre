import {
	cloneDrawingDocumentV2,
	parseEditableDrawingDocumentV2,
	serializeEditableDrawingDocument,
	type DrawingDocumentV2,
	type DrawingStroke
} from './document';
import { appendCommittedStroke as appendCommittedStrokeToDocument } from './responsive-editing';

type DraftKeyInput = {
	schemaVersion: number;
	scope: string;
	surface: 'artwork' | 'avatar';
	userKey: string;
};

type DraftSnapshotRecord = {
	draftKey: string;
	document: DrawingDocumentV2;
	updatedAt: number;
};

type DraftJournalRecord = {
	committedAt: number;
	draftKey: string;
	entryId?: number;
	sequence: number;
	stroke: DrawingStroke;
};

type OpenDraftStoreOptions = {
	databaseName?: string;
	testing?: {
		failCompactAfterSnapshotWrite?: boolean;
	};
};

type WriteSnapshotInput = {
	document: DrawingDocumentV2;
	draftKey: string;
};

type AppendCommittedStrokeInput = {
	draftKey: string;
	stroke: DrawingStroke;
};

type DrawingDraftSessionHydrateInput = {
	seedDocument?: DrawingDocumentV2;
};

type CreateDrawingDraftSessionInput = {
	draftKey: string;
	legacyKey?: string | null;
	maxJournalEntriesBeforeCompact?: number;
	storage?: DraftStorage | null;
	store?: IndexedDbDrawingDraftStore;
};

type DraftStorage = Pick<Storage, 'getItem' | 'removeItem'>;

type DrawingDraftPersistenceOptions = {
	storage?: DraftStorage | null;
	store?: IndexedDbDrawingDraftStore;
};

export type IndexedDbDrawingDraftStore = {
	appendCommittedStroke: (input: AppendCommittedStrokeInput) => Promise<void>;
	clear: (draftKey: string) => Promise<void>;
	compact: (input: WriteSnapshotInput) => Promise<void>;
	hydrate: (draftKey: string) => Promise<DrawingDocumentV2 | null>;
	listJournalEntries: (draftKey: string) => Promise<DrawingStroke[]>;
	writeSnapshot: (input: WriteSnapshotInput) => Promise<void>;
};

export type DrawingDraftSession = {
	appendCommittedStroke: (
		document: DrawingDocumentV2,
		stroke: DrawingStroke
	) => Promise<DrawingDocumentV2>;
	clear: () => Promise<void>;
	compact: (document: DrawingDocumentV2) => Promise<void>;
	hydrate: (input?: DrawingDraftSessionHydrateInput) => Promise<DrawingDocumentV2 | null>;
};

const DRAWING_DRAFTS_DB_NAME = 'drawing-drafts';
const DRAWING_DRAFTS_DB_VERSION = 1;
const SNAPSHOT_STORE = 'snapshots';
const JOURNAL_STORE = 'journal';
const JOURNAL_BY_DRAFT_SEQUENCE_INDEX = 'by-draft-sequence';
const DEFAULT_MAX_JOURNAL_ENTRIES_BEFORE_COMPACT = 24;

const cloneDrawingStroke = (stroke: DrawingStroke): DrawingStroke => ({
	color: stroke.color,
	points: stroke.points.map((point) => [point[0], point[1]] as [number, number]),
	size: stroke.size
});

const normalizeSnapshotDocument = (document: DrawingDocumentV2) =>
	parseEditableDrawingDocumentV2(serializeEditableDrawingDocument(document));

const normalizeJournalStroke = (stroke: DrawingStroke) => cloneDrawingStroke(stroke);

const removeLegacyDraftEntries = (
	storage: DraftStorage | null | undefined,
	keys: Array<string | null>
) => {
	if (!storage) {
		return;
	}

	for (const key of keys) {
		if (!key) {
			continue;
		}

		storage.removeItem(key);
	}
};

const getIndexedDb = () => globalThis.indexedDB ?? null;

const getSnapshotStore = (transaction: IDBTransaction) =>
	transaction.objectStore(SNAPSHOT_STORE) as IDBObjectStore;

const getJournalStore = (transaction: IDBTransaction) =>
	transaction.objectStore(JOURNAL_STORE) as IDBObjectStore;

const waitForRequest = <T>(request: IDBRequest<T>) =>
	new Promise<T>((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
	});

const waitForTransaction = (transaction: IDBTransaction) =>
	new Promise<void>((resolve, reject) => {
		transaction.oncomplete = () => resolve();
		transaction.onabort = () =>
			reject(transaction.error ?? new Error('IndexedDB transaction was aborted'));
		transaction.onerror = () =>
			reject(transaction.error ?? new Error('IndexedDB transaction failed'));
	});

const openDraftDatabase = async ({
	databaseName = DRAWING_DRAFTS_DB_NAME
}: OpenDraftStoreOptions = {}): Promise<IDBDatabase> => {
	const indexedDb = getIndexedDb();
	if (!indexedDb) {
		throw new Error('IndexedDB is not available');
	}

	const request = indexedDb.open(databaseName, DRAWING_DRAFTS_DB_VERSION);

	request.onupgradeneeded = () => {
		const database = request.result;

		if (!database.objectStoreNames.contains(SNAPSHOT_STORE)) {
			database.createObjectStore(SNAPSHOT_STORE, { keyPath: 'draftKey' });
		}

		if (!database.objectStoreNames.contains(JOURNAL_STORE)) {
			const journalStore = database.createObjectStore(JOURNAL_STORE, {
				autoIncrement: true,
				keyPath: 'entryId'
			});
			journalStore.createIndex(JOURNAL_BY_DRAFT_SEQUENCE_INDEX, ['draftKey', 'sequence'], {
				unique: true
			});
		}
	};

	return await waitForRequest(request);
};

const withDatabase = async <T>(
	options: OpenDraftStoreOptions,
	run: (database: IDBDatabase) => Promise<T>
) => {
	const database = await openDraftDatabase(options);

	try {
		return await run(database);
	} finally {
		database.close();
	}
};

const getSnapshotRecord = async (database: IDBDatabase, draftKey: string) => {
	const transaction = database.transaction([SNAPSHOT_STORE], 'readonly');
	const snapshotRecord = (await waitForRequest(getSnapshotStore(transaction).get(draftKey))) as
		| DraftSnapshotRecord
		| undefined;
	await waitForTransaction(transaction);
	return snapshotRecord ?? null;
};

const getJournalRecords = async (database: IDBDatabase, draftKey: string) => {
	const transaction = database.transaction([JOURNAL_STORE], 'readonly');
	const journalStore = getJournalStore(transaction);
	const index = journalStore.index(JOURNAL_BY_DRAFT_SEQUENCE_INDEX);
	const range = IDBKeyRange.bound([draftKey, 0], [draftKey, Number.MAX_SAFE_INTEGER]);
	const journalRecords = (await waitForRequest(index.getAll(range))) as DraftJournalRecord[];
	await waitForTransaction(transaction);
	return journalRecords;
};

const getNextJournalSequence = async (database: IDBDatabase, draftKey: string) => {
	const journalRecords = await getJournalRecords(database, draftKey);
	return (journalRecords.at(-1)?.sequence ?? 0) + 1;
};

const clearPersistedDraftData = async (options: OpenDraftStoreOptions, draftKey: string) => {
	await withDatabase(options, async (database) => {
		const transaction = database.transaction([SNAPSHOT_STORE, JOURNAL_STORE], 'readwrite');
		getSnapshotStore(transaction).delete(draftKey);
		await deleteJournalEntries(getJournalStore(transaction), draftKey);
		await waitForTransaction(transaction);
	});
};

const deleteJournalEntries = async (
	journalStore: IDBObjectStore,
	draftKey: string,
	upperSequence: number | null = null
) => {
	const index = journalStore.index(JOURNAL_BY_DRAFT_SEQUENCE_INDEX);
	const lowerBound: [string, number] = [draftKey, 0];
	const upperBoundValue: [string, number] = [draftKey, upperSequence ?? Number.MAX_SAFE_INTEGER];
	const range = IDBKeyRange.bound(lowerBound, upperBoundValue);
	const journalRecords = (await waitForRequest(index.getAll(range))) as DraftJournalRecord[];

	for (const journalRecord of journalRecords) {
		if (typeof journalRecord.entryId === 'number') {
			journalStore.delete(journalRecord.entryId);
		}
	}
};

export const createIndexedDbDrawingDraftStore = (
	options: OpenDraftStoreOptions = {}
): IndexedDbDrawingDraftStore => ({
	appendCommittedStroke: async ({ draftKey, stroke }) => {
		await withDatabase(options, async (database) => {
			const sequence = await getNextJournalSequence(database, draftKey);
			const transaction = database.transaction([JOURNAL_STORE], 'readwrite');
			const journalStore = getJournalStore(transaction);
			journalStore.add({
				committedAt: Date.now(),
				draftKey,
				sequence,
				stroke: normalizeJournalStroke(stroke)
			} satisfies DraftJournalRecord);
			await waitForTransaction(transaction);
		});
	},
	clear: async (draftKey) => {
		await clearPersistedDraftData(options, draftKey);
	},
	compact: async ({ draftKey, document }) => {
		await withDatabase(options, async (database) => {
			const journalRecords = await getJournalRecords(database, draftKey);
			const transaction = database.transaction([SNAPSHOT_STORE, JOURNAL_STORE], 'readwrite');
			getSnapshotStore(transaction).put({
				draftKey,
				document: normalizeSnapshotDocument(document),
				updatedAt: Date.now()
			} satisfies DraftSnapshotRecord);
			if (options.testing?.failCompactAfterSnapshotWrite) {
				transaction.abort();
				await waitForTransaction(transaction);
				return;
			}
			const latestSequence = journalRecords.at(-1)?.sequence ?? null;
			await deleteJournalEntries(getJournalStore(transaction), draftKey, latestSequence);
			await waitForTransaction(transaction);
		});
	},
	hydrate: async (draftKey) => {
		try {
			return await withDatabase(options, async (database) => {
				const snapshotRecord = await getSnapshotRecord(database, draftKey);
				if (!snapshotRecord) {
					return null;
				}

				const journalRecords = await getJournalRecords(database, draftKey);
				let hydratedDocument = normalizeSnapshotDocument(snapshotRecord.document);

				for (const journalRecord of journalRecords) {
					hydratedDocument = appendCommittedStrokeToDocument(
						hydratedDocument,
						normalizeJournalStroke(journalRecord.stroke)
					);
				}

				return hydratedDocument;
			});
		} catch {
			await clearPersistedDraftData(options, draftKey);
			return null;
		}
	},
	listJournalEntries: async (draftKey) =>
		(
			await withDatabase(options, async (database) => await getJournalRecords(database, draftKey))
		).map((journalRecord) => normalizeJournalStroke(journalRecord.stroke)),
	writeSnapshot: async ({ draftKey, document }) => {
		await withDatabase(options, async (database) => {
			const transaction = database.transaction([SNAPSHOT_STORE], 'readwrite');
			getSnapshotStore(transaction).put({
				draftKey,
				document: normalizeSnapshotDocument(document),
				updatedAt: Date.now()
			} satisfies DraftSnapshotRecord);
			await waitForTransaction(transaction);
		});
	}
});

export const createDrawingDraftSession = (
	input: CreateDrawingDraftSessionInput
): DrawingDraftSession => {
	const maxJournalEntriesBeforeCompact =
		input.maxJournalEntriesBeforeCompact ?? DEFAULT_MAX_JOURNAL_ENTRIES_BEFORE_COMPACT;
	const storage = input.storage ?? getStorage();
	const store = input.store ?? createIndexedDbDrawingDraftStore();

	return {
		appendCommittedStroke: async (document, stroke) => {
			const nextDocument = appendCommittedStrokeToDocument(document, stroke);
			const journalEntries = await store.listJournalEntries(input.draftKey);

			if (journalEntries.length + 1 >= maxJournalEntriesBeforeCompact) {
				await store.compact({ document: nextDocument, draftKey: input.draftKey });
				return nextDocument;
			}

			await store.appendCommittedStroke({ draftKey: input.draftKey, stroke });
			return nextDocument;
		},
		clear: async () => {
			removeLegacyDraftEntries(storage, [input.draftKey, input.legacyKey ?? null]);
			await store.clear(input.draftKey);
		},
		compact: async (document) => {
			await store.compact({ document, draftKey: input.draftKey });
		},
		hydrate: async (options) => {
			const hydratedDraft = await hydratePersistedDrawingDraft({
				draftKey: input.draftKey,
				legacyKey: input.legacyKey,
				storage,
				store
			});
			if (hydratedDraft) {
				return hydratedDraft;
			}

			if (!options?.seedDocument) {
				return null;
			}

			const seedDocument = cloneDrawingDocumentV2(options.seedDocument);
			await store.writeSnapshot({ document: seedDocument, draftKey: input.draftKey });
			return seedDocument;
		}
	};
};

const getStorage = (): DraftStorage | null => {
	if (typeof window === 'undefined') return null;
	return window.localStorage;
};

const getDrawingDraftPersistenceOptions = (options?: DrawingDraftPersistenceOptions) => ({
	storage: options?.storage ?? getStorage(),
	store: options?.store ?? createIndexedDbDrawingDraftStore()
});

const importLegacyDrawingDraft = async (input: {
	legacyKey?: string | null;
	primaryKey: string;
	storage: DraftStorage;
	store: IndexedDbDrawingDraftStore;
}) => {
	const candidateKeys = [input.primaryKey, input.legacyKey ?? null].filter(
		(candidateKey): candidateKey is string => Boolean(candidateKey)
	);

	for (const candidateKey of candidateKeys) {
		const rawDraft = input.storage.getItem(candidateKey);
		if (!rawDraft) {
			continue;
		}

		try {
			const document = parseEditableDrawingDocumentV2(rawDraft);
			await input.store.writeSnapshot({ document, draftKey: input.primaryKey });
			return document;
		} catch {
			input.storage.removeItem(candidateKey);
		}
	}

	return null;
};

const hydratePersistedDrawingDraft = async (input: {
	draftKey: string;
	legacyKey?: string | null;
	storage: DraftStorage | null;
	store: IndexedDbDrawingDraftStore;
}) => {
	const persistedDraft = await input.store.hydrate(input.draftKey);
	if (persistedDraft) {
		return persistedDraft;
	}

	if (!input.storage) {
		return null;
	}

	return await importLegacyDrawingDraft({
		legacyKey: input.legacyKey,
		primaryKey: input.draftKey,
		storage: input.storage,
		store: input.store
	});
};

export const buildDrawingDraftKey = ({ schemaVersion, scope, surface, userKey }: DraftKeyInput) =>
	`drawing-draft:v${schemaVersion}:${surface}:${userKey}:${scope}`;

export const loadDrawingDraft = async (
	key: string,
	legacyKey?: string | null,
	options?: DrawingDraftPersistenceOptions
): Promise<DrawingDocumentV2 | null> => {
	const { storage, store } = getDrawingDraftPersistenceOptions(options);

	return await hydratePersistedDrawingDraft({
		draftKey: key,
		legacyKey,
		storage,
		store
	});
};

export const saveDrawingDraft = (
	key: string,
	document: DrawingDocumentV2,
	options?: DrawingDraftPersistenceOptions
) => {
	const { store } = getDrawingDraftPersistenceOptions(options);
	void store.writeSnapshot({ draftKey: key, document });
};

export const clearDrawingDraft = (key: string, options?: DrawingDraftPersistenceOptions) => {
	const { storage, store } = getDrawingDraftPersistenceOptions(options);
	storage?.removeItem(key);
	void store.clear(key);
};
