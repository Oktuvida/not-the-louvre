/**
 * Fills the local gallery with real artworks: generated drawings rendered
 * through the publish pipeline, their images and documents stored in the
 * local R2 bucket that `bun run dev` and `wrangler dev` read, and rows that
 * name them. Deterministic, so every run draws the same gallery, and safe to
 * re-run.
 *
 * Usage (from apps/web, with the local Postgres up): bun run db:seed [count]
 */
import pg from 'pg';
import { getPlatformProxy } from 'wrangler';
import {
	createEmptyDrawingDocument,
	type DrawingStroke
} from '../src/lib/features/stroke-json/document';
import { drawingDocumentKey } from '../src/lib/server/drawing-document/document-key';
import { createArtworkDrawingDocumentMedia } from '../src/lib/server/drawing-document/media';
import { prepareDrawingDocumentForStorage } from '../src/lib/server/drawing-document/storage';
import type { AppBucket } from '../src/lib/server/platform';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
	throw new Error('DATABASE_URL is not set. Add it to apps/web/.env or pass it explicitly.');
}

const ARTWORK_COUNT = Number(process.argv[2] ?? 60);
const SPREAD_DAYS = 21;

const AUTHORS = [
	{ id: 'seed-author-1', nickname: 'ash_palette' },
	{ id: 'seed-author-2', nickname: 'coral_brush' },
	{ id: 'seed-author-3', nickname: 'dusk_canvas' },
	{ id: 'seed-author-4', nickname: 'ember_sketch' },
	{ id: 'seed-author-5', nickname: 'fern_ink' }
];

const TITLES = [
	'Sunset Over Mountains',
	'Ocean Breeze',
	'Forest Whisper',
	'City at Dawn',
	'Desert Mirage',
	'Midnight Garden',
	'Starlit Path',
	'Coastal Drift',
	'Autumn Fire',
	'Frozen Lake',
	'Paper Moon',
	'Quiet Harbour'
];

const PALETTES = [
	['#264653', '#2a9d8f', '#e9c46a', '#f4a261', '#e76f51'],
	['#1d3557', '#457b9d', '#a8dadc', '#e63946'],
	['#2d2420', '#8d5524', '#c68642', '#f1c27d'],
	['#3a0ca3', '#7209b7', '#f72585', '#4cc9f0'],
	['#2b2d42', '#8d99ae', '#ef233c', '#d90429']
];

// A small seeded generator, so the same count always draws the same gallery.
const createRandom = (seed: number) => () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;

const drawStrokes = (index: number): DrawingStroke[] => {
	const random = createRandom(index + 1);
	const palette = PALETTES[index % PALETTES.length]!;
	const strokeCount = 20 + Math.floor(random() * 220);
	const strokes: DrawingStroke[] = [];

	for (let stroke = 0; stroke < strokeCount; stroke += 1) {
		let x = random() * 767;
		let y = random() * 767;
		let angle = random() * Math.PI * 2;
		const step = 3 + random() * 6;
		const points: [number, number][] = [];
		const pointCount = 4 + Math.floor(random() * 60);

		for (let point = 0; point < pointCount; point += 1) {
			angle += (random() - 0.5) * 0.7;
			x = Math.min(767, Math.max(0, x + Math.cos(angle) * step));
			y = Math.min(767, Math.max(0, y + Math.sin(angle) * step));
			points.push([Math.round(x), Math.round(y)]);
		}

		strokes.push({
			color: palette[Math.floor(random() * palette.length)]!,
			points,
			size: [2, 4, 8, 16, 32][Math.floor(random() * 5)]!
		});
	}

	return strokes;
};

// The proxy starts every binding in wrangler.jsonc; Hyperdrive's local
// stand-in is the same Postgres.
process.env.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE ??= databaseUrl;

const db = new pg.Client({ connectionString: databaseUrl });
const proxy = await getPlatformProxy<{ BUCKET: AppBucket }>();
await db.connect();

try {
	for (const author of AUTHORS) {
		await db.query(
			`insert into better_auth.user (id, name, email, email_verified, created_at, updated_at, nickname)
			 values ($1, $2, $3, true, now(), now(), $2) on conflict do nothing`,
			[author.id, author.nickname, `${author.nickname}@seed.local`]
		);
		await db.query(
			`insert into app.users (id, nickname, recovery_hash, role, created_at, updated_at)
			 values ($1, $2, $3, 'user', now(), now()) on conflict do nothing`,
			[author.id, author.nickname, `seed-recovery-${author.id}`]
		);
	}

	const now = Date.now();
	for (let index = 0; index < ARTWORK_COUNT; index += 1) {
		const id = `seed-artwork-${String(index + 1).padStart(3, '0')}`;
		const author = AUTHORS[index % AUTHORS.length]!;
		const prepared = await prepareDrawingDocumentForStorage(
			JSON.stringify({ ...createEmptyDrawingDocument('artwork'), strokes: drawStrokes(index) })
		);
		const media = await createArtworkDrawingDocumentMedia(prepared.document);
		const documentKey = await drawingDocumentKey(prepared.compressed);
		const storageKey = `artworks/${author.id}/${id}.webp`;

		await proxy.env.BUCKET.put(documentKey, prepared.compressed.slice().buffer, {
			httpMetadata: { contentType: 'application/gzip' }
		});
		await proxy.env.BUCKET.put(storageKey, await media.file.arrayBuffer(), {
			httpMetadata: { contentType: media.contentType }
		});

		const createdAt = new Date(now - (index / ARTWORK_COUNT) * SPREAD_DAYS * 24 * 60 * 60 * 1000);
		await db.query(
			`insert into app.artworks (id, author_id, title, storage_key, media_content_type,
				media_size_bytes, media_placeholder, drawing_document_key, drawing_version, score,
				created_at, updated_at)
			 values ($1, $2, $3, $4, $5, $6, $7, $8, 2, $9, $10, $10)
			 on conflict (id) do update set storage_key = excluded.storage_key,
				media_content_type = excluded.media_content_type,
				media_size_bytes = excluded.media_size_bytes,
				media_placeholder = excluded.media_placeholder,
				drawing_document_key = excluded.drawing_document_key,
				drawing_version = 2`,
			[
				id,
				author.id,
				`${TITLES[index % TITLES.length]} #${index + 1}`,
				storageKey,
				media.contentType,
				media.sizeBytes,
				media.placeholder ?? null,
				documentKey,
				Math.round((Math.sin(index * 0.7) * 0.5 + 0.5) * 100),
				createdAt
			]
		);
		process.stdout.write(`\r${index + 1}/${ARTWORK_COUNT} artworks`);
	}
	process.stdout.write('\nDone.\n');
} finally {
	await db.end();
	await proxy.dispose();
}
