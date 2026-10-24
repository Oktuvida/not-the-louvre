import {
	createArtworkDrawingDocumentMedia,
	createAvatarDrawingDocumentMedia
} from '#lib/server/drawing-document/media.js';
import { drawingDocumentKey } from '#lib/server/drawing-document/document-key.js';
import { decodeDrawingDocument } from '#lib/server/drawing-document/storage.js';
import { decodeImage } from '#lib/server/media/codecs/index.js';
import { encodeArtworkMediaPlaceholder } from '#lib/server/media/placeholder.js';
import type { AppBucket } from '#lib/server/platform.js';
import { avatarStorageKey } from '#lib/server/user/avatar-key.js';

/*
 * The one-off move off Supabase (scripts/cutover.ts runs it against
 * production). Every step only adds: the inline drawing columns and the AVIF
 * objects stay where they were until the move is verified, and each step
 * picks up only what is still left, so a run that stops half way is finished
 * by running it again.
 *
 * - copy: images go from Supabase Storage to the bucket under the same keys,
 *   and inline drawings go to documents/<sha256>.json.gz. A drawing whose
 *   chunked write never finished is reported and left alone. Nothing the app
 *   on main reads changes, so this runs before the first remaster deploy.
 * - redraw: artworks and avatars that still have their whole drawing are
 *   rendered again as lossless WebP, so the gallery stops showing the lossy
 *   AVIF ladder; artworks without one keep their AVIF and get the blur-up
 *   placeholder they lacked. Rows move to the new keys, which main cannot
 *   read, so this runs after the deploy.
 */

export type ObjectSource = {
	read(key: string): Promise<{ bytes: Uint8Array; contentType: string } | null>;
};

export type ObjectTarget = {
	has(key: string): Promise<boolean>;
	put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
	read(key: string): Promise<Uint8Array<ArrayBuffer>>;
};

type Queryable = {
	query(text: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
};

export type CutoverReport = {
	copiedImages: number;
	failures: string[];
	filledPlaceholders: number;
	invalidDocuments: string[];
	missingImages: string[];
	movedDocuments: number;
	redrawnArtworks: number;
	redrawnAvatars: number;
	tornDocuments: string[];
};

export type CutoverOptions = {
	db: Queryable;
	log?: (line: string) => void;
	/** Only these users and their artworks; the tests use it to stay in their lane. */
	ownedBy?: string[];
	/** Runs the redraw step after the copy (default true). */
	redraw?: boolean;
	source: ObjectSource;
	target: ObjectTarget;
};

/** An ObjectTarget over the Worker's R2 binding, as tests and local runs have it. */
export const bucketObjectTarget = (bucket: AppBucket): ObjectTarget => ({
	async has(key) {
		return (await bucket.head(key)) !== null;
	},
	async put(key, bytes, contentType) {
		await bucket.put(key, bytes.slice().buffer, { httpMetadata: { contentType } });
	},
	async read(key) {
		const object = await bucket.get(key);
		if (!object) throw new Error(`${key} is not in the bucket`);
		return new Uint8Array(await new Response(object.body).arrayBuffer());
	}
});

const describeError = (error: unknown) => (error instanceof Error ? error.message : String(error));

const DOCUMENT_COLUMNS = {
	artwork: {
		document: 'drawing_document',
		key: 'drawing_document_key',
		owner: 'author_id',
		table: 'app.artworks',
		version: 'drawing_version'
	},
	avatar: {
		document: 'avatar_document',
		key: 'avatar_document_key',
		owner: 'id',
		table: 'app.users',
		version: 'avatar_document_version'
	}
} as const;

export const runCutover = async (options: CutoverOptions): Promise<CutoverReport> => {
	const { db, source, target } = options;
	const log = options.log ?? (() => {});
	const owners = options.ownedBy ?? null;
	const report: CutoverReport = {
		copiedImages: 0,
		failures: [],
		filledPlaceholders: 0,
		invalidDocuments: [],
		missingImages: [],
		movedDocuments: 0,
		redrawnArtworks: 0,
		redrawnAvatars: 0,
		tornDocuments: []
	};

	// --- copy: images -------------------------------------------------------
	const { rows: images } = await db.query(
		`select storage_key as key from app.artworks where ($1::text[] is null or author_id = any($1))
		 union all
		 select avatar_url from app.users
		 where avatar_url is not null and ($1::text[] is null or id = any($1))`,
		[owners]
	);
	for (const { key } of images as { key: string }[]) {
		try {
			if (await target.has(key)) continue;
			const object = await source.read(key);
			if (!object) {
				report.missingImages.push(key);
				continue;
			}
			await target.put(key, object.bytes, object.contentType);
			report.copiedImages += 1;
		} catch (error) {
			report.failures.push(`image ${key}: ${describeError(error)}`);
		}
	}
	log(`images: ${report.copiedImages} copied, ${report.missingImages.length} missing`);

	// --- copy: drawings -----------------------------------------------------
	for (const [kind, columns] of Object.entries(DOCUMENT_COLUMNS)) {
		const { rows } = await db.query(
			`select id, ${columns.document} as document, ${columns.version} as version
			 from ${columns.table}
			 where ${columns.key} is null and ${columns.document} is not null
				and ($1::text[] is null or ${columns.owner} = any($1))`,
			[owners]
		);
		for (const row of rows as { document: string; id: string; version: number | null }[]) {
			const label = `${kind}:${row.id}`;
			if (row.version === null) {
				report.tornDocuments.push(label);
				continue;
			}
			try {
				const compressed = Uint8Array.from(Buffer.from(row.document, 'base64'));
				try {
					await decodeDrawingDocument(compressed);
				} catch {
					report.invalidDocuments.push(label);
					continue;
				}
				const key = await drawingDocumentKey(compressed);
				if (!(await target.has(key))) await target.put(key, compressed, 'application/gzip');
				await db.query(
					`update ${columns.table} set ${columns.key} = $1 where id = $2 and ${columns.key} is null`,
					[key, row.id]
				);
				report.movedDocuments += 1;
			} catch (error) {
				report.failures.push(`document ${label}: ${describeError(error)}`);
			}
		}
	}
	log(`drawings: ${report.movedDocuments} moved, ${report.tornDocuments.length} torn left inline`);

	if (options.redraw === false) return report;

	// --- redraw: artworks ---------------------------------------------------
	const { rows: lossyArtworks } = await db.query(
		`select id, author_id, drawing_document_key from app.artworks
		 where media_content_type = 'image/avif' and drawing_document_key is not null
			and ($1::text[] is null or author_id = any($1))`,
		[owners]
	);
	for (const row of lossyArtworks as {
		author_id: string;
		drawing_document_key: string;
		id: string;
	}[]) {
		try {
			const document = await decodeDrawingDocument(await target.read(row.drawing_document_key));
			const media = await createArtworkDrawingDocumentMedia(document);
			const key = `artworks/${row.author_id}/${row.id}.webp`;
			await target.put(key, new Uint8Array(await media.file.arrayBuffer()), media.contentType);
			await db.query(
				`update app.artworks
				 set storage_key = $1, media_content_type = $2, media_size_bytes = $3, media_placeholder = $4
				 where id = $5 and media_content_type = 'image/avif'`,
				[key, media.contentType, media.sizeBytes, media.placeholder ?? null, row.id]
			);
			report.redrawnArtworks += 1;
		} catch (error) {
			report.failures.push(`redraw artwork:${row.id}: ${describeError(error)}`);
		}
	}

	// --- redraw: avatars ----------------------------------------------------
	const { rows: lossyAvatars } = await db.query(
		`select id, avatar_url, avatar_document_key from app.users
		 where avatar_url like '%.avif' and avatar_document_key is not null
			and ($1::text[] is null or id = any($1))`,
		[owners]
	);
	for (const row of lossyAvatars as {
		avatar_document_key: string;
		avatar_url: string;
		id: string;
	}[]) {
		try {
			const document = await decodeDrawingDocument(await target.read(row.avatar_document_key));
			const media = await createAvatarDrawingDocumentMedia(document);
			const bytes = new Uint8Array(await media.file.arrayBuffer());
			const key = await avatarStorageKey(row.id, bytes);
			await target.put(key, bytes, media.contentType);
			await db.query('update app.users set avatar_url = $1 where id = $2 and avatar_url = $3', [
				key,
				row.id,
				row.avatar_url
			]);
			report.redrawnAvatars += 1;
		} catch (error) {
			report.failures.push(`redraw avatar:${row.id}: ${describeError(error)}`);
		}
	}

	// --- redraw: placeholders for the AVIFs that stay -----------------------
	const { rows: bareArtworks } = await db.query(
		`select id, storage_key from app.artworks
		 where media_placeholder is null and media_content_type = 'image/avif'
			and ($1::text[] is null or author_id = any($1))`,
		[owners]
	);
	for (const row of bareArtworks as { id: string; storage_key: string }[]) {
		try {
			// A missing image was reported by the copy step already.
			if (!(await target.has(row.storage_key))) continue;
			const raster = await decodeImage(await target.read(row.storage_key), 'avif');
			const placeholder = await encodeArtworkMediaPlaceholder(raster);
			await db.query(
				'update app.artworks set media_placeholder = $1 where id = $2 and media_placeholder is null',
				[placeholder, row.id]
			);
			report.filledPlaceholders += 1;
		} catch (error) {
			report.failures.push(`placeholder artwork:${row.id}: ${describeError(error)}`);
		}
	}
	log(
		`redraw: ${report.redrawnArtworks} artworks, ${report.redrawnAvatars} avatars, ${report.filledPlaceholders} placeholders`
	);

	return report;
};
