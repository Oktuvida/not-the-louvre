// Supavisor kills sessions that receive a large Bind in one message: a
// 99,684-char document died deterministically (2026-08-18) while 50,380 chars
// succeeded historically, so the kill threshold sits somewhere in between.
// 16 KiB chunks stay far below both bounds. Multiple of 4 so an interrupted
// write still ends on a base64 boundary.
export const DRAWING_DOCUMENT_CHUNK_CHARS = 16384;

// CONNECTION_CLOSED means the pooler dropped the session while the statement
// was in flight, which an immediate reissue cannot outrun (prod evidence: the
// zero-delay retry failed identically), so retries back off.
export const CONNECTION_RETRY_DELAYS_MS = [500, 2000];

const hasErrorCode = (error: unknown, code: string): boolean => {
	let current: unknown = error;
	while (current instanceof Error) {
		if ((current as { code?: unknown }).code === code) {
			return true;
		}
		current = current.cause;
	}

	return false;
};

export const isConnectionClosedError = (error: unknown) => hasErrorCode(error, 'CONNECTION_CLOSED');

// A redial that cannot complete (pooler restarting) surfaces CONNECT_TIMEOUT
// now that connect_timeout is set on the client; the next delayed attempt
// should still run. Unlike CONNECTION_CLOSED it is unambiguous: the query
// never reached Postgres.
export const isRetryableConnectionError = (error: unknown) =>
	isConnectionClosedError(error) || hasErrorCode(error, 'CONNECT_TIMEOUT');

// Postgres unique_violation. After a closed-mid-query attempt it means that
// attempt actually committed before the socket died and only the ack was lost.
export const isUniqueViolation = (error: unknown) => hasErrorCode(error, '23505');

const errorCode = (error: unknown): string | null => {
	let current: unknown = error;
	while (current instanceof Error) {
		const code = (current as { code?: unknown }).code;
		if (typeof code === 'string') {
			return code;
		}
		current = current.cause;
	}

	return null;
};

// The three writes plus the two read-backs the ladder needs, so artworks and
// avatars share one retry implementation instead of two copies drifting apart.
export type DrawingDocumentChunkStore<TRecord> = {
	// Must be guarded by `expectedLength` so a reissued chunk whose first
	// delivery committed matches zero rows instead of double-appending.
	appendChunk(id: string, chunk: string, expectedLength: number, updatedAt: Date): Promise<boolean>;
	// Must be guarded by `expectedTotalLength` and set the version last: readers
	// treat a document without a version as absent, so a torn write stays inert.
	finalize(
		id: string,
		version: number,
		expectedTotalLength: number,
		updatedAt: Date
	): Promise<TRecord | null>;
	findDocumentLength(id: string): Promise<number | null>;
	findFinalized(id: string, version: number): Promise<TRecord | null>;
};

type ChunkedWriteOptions<TRecord> = {
	category: 'artwork' | 'avatar';
	chunkChars: number;
	documentBase64: string;
	// Merged into every log line so each caller keeps its own identifier field.
	logFields: Record<string, unknown>;
	now: Date;
	sleep: (ms: number) => Promise<void>;
	store: DrawingDocumentChunkStore<TRecord>;
	targetId: string;
	version: number;
};

// Appends one chunk with the delayed-retry ladder. An ambiguous connection
// failure (or a guard mismatch after one) is resolved by reading the stored
// length back: advanced by exactly this chunk means the lost-ack append
// landed; unchanged means it never applied and the next attempt is safe. A
// read-back that itself fails leaves the question open for the next rung
// instead of aborting the write.
const appendDrawingDocumentChunk = async <TRecord>(
	options: Pick<
		ChunkedWriteOptions<TRecord>,
		'category' | 'logFields' | 'now' | 'sleep' | 'store' | 'targetId'
	> & {
		chunk: string;
		chunkIndex: number;
		expectedLength: number;
	}
): Promise<boolean> => {
	const { chunk, chunkIndex, expectedLength, store, targetId } = options;

	for (let attempt = 0; attempt <= CONNECTION_RETRY_DELAYS_MS.length; attempt += 1) {
		if (attempt > 0) {
			await options.sleep(CONNECTION_RETRY_DELAYS_MS[attempt - 1]!);
		}

		let appendError: unknown;
		try {
			if (await store.appendChunk(targetId, chunk, expectedLength, options.now)) {
				return true;
			}
		} catch (error) {
			if (!isRetryableConnectionError(error)) {
				throw error;
			}
			appendError = error;
		}

		console.warn(
			JSON.stringify({
				...options.logFields,
				attempt,
				category: options.category,
				chunkChars: chunk.length,
				chunkIndex,
				code: appendError ? (errorCode(appendError) ?? 'UNKNOWN') : 'GUARD_MISMATCH',
				event: 'drawing_document_chunk_retry'
			})
		);

		try {
			const storedLength = await store.findDocumentLength(targetId);
			if (storedLength === expectedLength + chunk.length) {
				return true;
			}
			if (storedLength !== expectedLength) {
				// null (row gone) or a length this writer never produced.
				return false;
			}
		} catch {
			// Unresolved; the next rung retries the append, whose guard makes a
			// duplicate delivery harmless either way.
		}
	}

	return false;
};

export const writeDrawingDocumentInChunks = async <TRecord>(
	options: ChunkedWriteOptions<TRecord>
): Promise<TRecord | null> => {
	const { chunkChars, documentBase64, store, targetId, version } = options;

	let chunkCount = 0;
	for (let offset = 0; offset < documentBase64.length; offset += chunkChars) {
		const chunk = documentBase64.slice(offset, offset + chunkChars);
		if (
			!(await appendDrawingDocumentChunk({
				category: options.category,
				chunk,
				chunkIndex: chunkCount,
				expectedLength: offset,
				logFields: options.logFields,
				now: options.now,
				sleep: options.sleep,
				store,
				targetId
			}))
		) {
			return null;
		}
		chunkCount += 1;
	}

	const logWritten = () =>
		console.log(
			JSON.stringify({
				...options.logFields,
				category: options.category,
				chunkCount,
				drawingDocumentChars: documentBase64.length,
				event: 'drawing_document_written'
			})
		);

	// Setting the version marks the document complete; readers treat a document
	// without a version as absent. Idempotent under retry: after a committed run
	// the length guard still matches and rewrites the same version.
	for (let attempt = 0; attempt <= CONNECTION_RETRY_DELAYS_MS.length; attempt += 1) {
		if (attempt > 0) {
			await options.sleep(CONNECTION_RETRY_DELAYS_MS[attempt - 1]!);
		}

		try {
			const finalized = await store.finalize(targetId, version, documentBase64.length, options.now);
			if (finalized) {
				logWritten();
			}
			return finalized;
		} catch (error) {
			if (!isRetryableConnectionError(error)) {
				throw error;
			}
			console.warn(
				JSON.stringify({
					...options.logFields,
					attempt,
					category: options.category,
					code: errorCode(error) ?? 'UNKNOWN',
					event: 'drawing_document_finalize_retry'
				})
			);
		}
	}

	// Ladder exhausted on ambiguous failures: the last finalize may have
	// committed with only the ack lost, so read the row back before reporting
	// the document as failed.
	try {
		const committed = await store.findFinalized(targetId, version);
		if (committed) {
			logWritten();
			return committed;
		}
	} catch {
		// unresolved; report as failed and leave the versionless doc inert
	}

	return null;
};
