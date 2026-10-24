import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { getPlatformProxy, type PlatformProxy } from 'wrangler';
import {
	createEmptyDrawingDocument,
	getRenderableDrawingStrokes
} from '#lib/features/stroke-json/document.js';
import type { AppBucket } from '#lib/server/platform.js';
import {
	prepareDrawingDocumentForStorage,
	decodeDrawingDocument
} from '#lib/server/drawing-document/storage.js';
import { createAvifTestFile, fileToBytes } from '#lib/server/media/test-helpers.js';
import { bucketObjectTarget, runCutover, type ObjectSource } from './cutover';

const DATABASE_URL = process.env.DATABASE_URL;
// Same opt-in flag as the other integration suites: `bun run test:integration`.
const describeWithDatabase = process.env.RUN_INTEGRATION === '1' ? describe : describe.skip;

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const userId = `cutover-user-${suffix}`;
const drawnArtworkId = `cutover-drawn-${suffix}`;
const tornArtworkId = `cutover-torn-${suffix}`;
const missingArtworkId = `cutover-missing-${suffix}`;

const artworkStrokes = [
	{
		color: '#2d2420',
		points: [
			[120, 120],
			[640, 640]
		] as [number, number][],
		size: 12
	}
];
const avatarStrokes = [
	{
		color: '#c84f4f',
		points: [
			[40, 40],
			[200, 180]
		] as [number, number][],
		size: 10
	}
];

// What production rows look like before the move: the drawing inline as base64
// gzip, the image in Supabase Storage as AVIF.
const inlineDocument = async (kind: 'artwork' | 'avatar', strokes: typeof artworkStrokes) => {
	const prepared = await prepareDrawingDocumentForStorage(
		JSON.stringify({ ...createEmptyDrawingDocument(kind), strokes })
	);
	return Buffer.from(prepared.compressed).toString('base64');
};

describeWithDatabase('the cutover to object storage', () => {
	let db: pg.Client;
	let proxy: PlatformProxy<{ BUCKET: AppBucket }>;
	const supabaseObjects = new Map<string, { bytes: Uint8Array; contentType: string }>();
	const source: ObjectSource = {
		read: async (key) => supabaseObjects.get(key) ?? null
	};

	beforeAll(async () => {
		proxy = await getPlatformProxy<{ BUCKET: AppBucket }>({ persist: false });
		db = new pg.Client({ connectionString: DATABASE_URL });
		await db.connect();

		const avif = await fileToBytes(await createAvifTestFile({ height: 768, width: 768 }));
		const avatarAvif = await fileToBytes(await createAvifTestFile({ height: 256, width: 256 }));
		supabaseObjects.set(`artworks/${userId}/${drawnArtworkId}.avif`, {
			bytes: avif,
			contentType: 'image/avif'
		});
		supabaseObjects.set(`artworks/${userId}/${tornArtworkId}.avif`, {
			bytes: avif,
			contentType: 'image/avif'
		});
		supabaseObjects.set(`avatars/${userId}.avif`, {
			bytes: avatarAvif,
			contentType: 'image/avif'
		});

		const now = new Date('2026-09-01T10:00:00.000Z');
		await db.query(
			`insert into better_auth.user (id, name, email, email_verified, created_at, updated_at, nickname)
			 values ($1, $1, $2, true, $3, $3, $4)`,
			[userId, `${userId}@not-the-louvre.local`, now, `${userId}_nick`]
		);
		await db.query(
			`insert into app.users (id, nickname, recovery_hash, role, avatar_url, avatar_document,
				avatar_document_version, created_at, updated_at)
			 values ($1, $2, 'recovery', 'user', $3, $4, 2, $5, $5)`,
			[
				userId,
				`${userId}_nick`,
				`avatars/${userId}.avif`,
				await inlineDocument('avatar', avatarStrokes),
				now
			]
		);

		const insertArtwork = (id: string, document: string | null, version: number | null) =>
			db.query(
				`insert into app.artworks (id, author_id, title, storage_key, media_content_type,
					media_size_bytes, drawing_document, drawing_version, created_at, updated_at)
				 values ($1, $2, $1, $3, 'image/avif', 128, $4, $5, $6, $6)`,
				[id, userId, `artworks/${userId}/${id}.avif`, document, version, now]
			);
		await insertArtwork(drawnArtworkId, await inlineDocument('artwork', artworkStrokes), 2);
		// A chunked write that died half way: text without a version.
		await insertArtwork(tornArtworkId, 'H4sIAAAA-partial', null);
		await insertArtwork(missingArtworkId, null, null);
	});

	afterAll(async () => {
		await db?.query('delete from app.artworks where author_id = $1', [userId]);
		await db?.query('delete from app.users where id = $1', [userId]);
		await db?.query('delete from better_auth.user where id = $1', [userId]);
		await db?.end();
		await proxy?.dispose();
	});

	it('moves every image and drawing across and redraws what it can losslessly', async () => {
		const target = bucketObjectTarget(proxy.env.BUCKET);
		const report = await runCutover({ db, ownedBy: [userId], source, target });

		// The image Supabase no longer has is reported, not invented.
		expect(report.missingImages).toEqual([`artworks/${userId}/${missingArtworkId}.avif`]);
		expect(report.tornDocuments).toEqual([`artwork:${tornArtworkId}`]);
		expect(report.invalidDocuments).toEqual([]);
		expect(report.failures).toEqual([]);

		const { rows: artworks } = await db.query(
			`select id, storage_key, media_content_type, drawing_document_key
			 from app.artworks where author_id = $1 order by id`,
			[userId]
		);
		const byId = Object.fromEntries(artworks.map((row) => [row.id, row]));

		// The drawn artwork is redrawn from its strokes, so it stops being lossy.
		const drawn = byId[drawnArtworkId];
		expect(drawn.storage_key).toBe(`artworks/${userId}/${drawnArtworkId}.webp`);
		expect(drawn.media_content_type).toBe('image/webp');
		expect(await target.has(drawn.storage_key)).toBe(true);
		const storedDrawing = await decodeDrawingDocument(
			await target.read(drawn.drawing_document_key)
		);
		expect(getRenderableDrawingStrokes(storedDrawing)).toEqual(artworkStrokes);

		// Without a whole drawing the AVIF is all there is: copied as it was.
		const torn = byId[tornArtworkId];
		expect(torn.storage_key).toBe(`artworks/${userId}/${tornArtworkId}.avif`);
		expect(torn.drawing_document_key).toBeNull();
		expect(await target.has(torn.storage_key)).toBe(true);

		// The avatar is redrawn too, under its versioned key.
		const {
			rows: [user]
		} = await db.query('select avatar_url, avatar_document_key from app.users where id = $1', [
			userId
		]);
		expect(user.avatar_url).toMatch(new RegExp(`^avatars/${userId}/[0-9a-f]{16}\\.webp$`));
		expect(await target.has(user.avatar_url)).toBe(true);
		const storedAvatar = await decodeDrawingDocument(await target.read(user.avatar_document_key));
		expect(getRenderableDrawingStrokes(storedAvatar)).toEqual(avatarStrokes);
	});

	it('finds nothing left to do on a second run', async () => {
		const report = await runCutover({
			db,
			ownedBy: [userId],
			source,
			target: bucketObjectTarget(proxy.env.BUCKET)
		});

		expect(report.copiedImages).toBe(0);
		expect(report.movedDocuments).toBe(0);
		expect(report.redrawnArtworks).toBe(0);
		expect(report.redrawnAvatars).toBe(0);
	});
});
