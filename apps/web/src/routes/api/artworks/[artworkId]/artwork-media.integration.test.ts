import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import postgres from 'postgres';
import type { Sql } from 'postgres';
import { getPlatformProxy, type PlatformProxy } from 'wrangler';
import type { AppBucket } from '#lib/server/platform.js';
import { gunzipSync } from 'node:zlib';
import { createEmptyDrawingDocument } from '#lib/features/stroke-json/document.js';
import { decodeImage } from '#lib/server/media/codecs/index.js';
import { encodeDrawingV3, type InkDocument } from '#lib/stroke/v3.js';

const DATABASE_URL = process.env.DATABASE_URL;
// Same opt-in flag as the other integration suites: `bun run test:integration`.
const describeWithDatabase = process.env.RUN_INTEGRATION === '1' ? describe : describe.skip;

// Vitest's workers never see the platform proxy Vite starts, so the suite runs
// its own: the R2 bucket is wrangler's local emulation of the real one.
const platform = vi.hoisted(() => ({ bucket: undefined as unknown, cache: undefined as unknown }));
vi.mock('#lib/server/platform.js', () => ({
	edgeCache: () => platform.cache,
	hyperdriveConnectionString: () => undefined,
	appBucket: () => platform.bucket,
	runAfterResponse: () => {}
}));

type DbClient = Sql<Record<string, unknown>>;

const createCanonicalUser = (id: string) => {
	const now = new Date('2026-03-28T19:00:00.000Z');

	return {
		authUserId: id,
		avatarUrl: null,
		createdAt: now,
		email: `${id}@not-the-louvre.local`,
		emailVerified: true,
		id,
		image: null,
		name: id,
		nickname: `${id}_nick`,
		role: 'user' as const,
		updatedAt: now
	};
};

const insertUser = async (sql: DbClient, id: string) => {
	const now = new Date('2026-03-28T19:00:00.000Z');

	await sql`
		insert into better_auth.user (id, name, email, email_verified, created_at, updated_at, nickname)
		values (${id}, ${id}, ${`${id}@not-the-louvre.local`}, true, ${now}, ${now}, ${`${id}_nick`})
	`;
	await sql`
		insert into app.users (id, nickname, recovery_hash, role, created_at, updated_at)
		values (${id}, ${`${id}_nick`}, ${`recovery-${id}`}, 'user', ${now}, ${now})
	`;
};

const deleteUser = async (sql: DbClient, id: string) => {
	await sql`delete from app.artworks where author_id = ${id}`;
	await sql`delete from app.users where id = ${id}`;
	await sql`delete from better_auth.user where id = ${id}`;
};

const ONE_STROKE_DRAWING = JSON.stringify({
	...createEmptyDrawingDocument('artwork'),
	strokes: [
		{
			color: '#2d2420',
			points: [
				[120, 120],
				[640, 640]
			],
			size: 12
		}
	]
});

const DRAWN_STROKES = [
	{
		color: '#2d2420',
		points: [
			[120, 120],
			[300, 260],
			[640, 640]
		] as [number, number][],
		size: 12
	},
	{
		color: '#c84f4f',
		points: [
			[700, 60],
			[80, 720]
		] as [number, number][],
		size: 3
	}
];

describeWithDatabase('artwork media storage', () => {
	let sql: DbClient;
	let proxy: PlatformProxy<{ BUCKET: AppBucket }>;

	beforeAll(async () => {
		proxy = await getPlatformProxy<{ BUCKET: AppBucket }>({ persist: false });
		platform.bucket = proxy.env.BUCKET;
		if (!DATABASE_URL) {
			throw new Error('DATABASE_URL is required for artwork media integration tests');
		}
		sql = postgres(DATABASE_URL, { max: 1 });
	});

	afterAll(async () => {
		await sql?.end({ timeout: 5 });
		await proxy?.dispose();
	});

	it('serves a published artwork image back exactly as it was stored', async () => {
		const userId = `media-user-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

		try {
			await insertUser(sql, userId);
			const { publishArtwork } = await import('#lib/server/artwork/service.js');
			const artwork = await publishArtwork(
				{ drawingDocument: ONE_STROKE_DRAWING, title: 'Stored in R2' },
				{ ipAddress: '127.0.0.1', user: createCanonicalUser(userId) }
			);

			const { GET } = await import('./media/+server');
			const response = await GET({
				locals: {},
				params: { artworkId: artwork.id },
				request: new Request(`http://localhost/api/artworks/${artwork.id}/media`)
			} as never);
			const body = new Uint8Array(await response.arrayBuffer());

			expect(response.status).toBe(200);
			expect(response.headers.get('content-type')).toBe('image/webp');
			expect(body.byteLength).toBe(artwork.mediaSizeBytes);
			expect(new TextDecoder().decode(body.subarray(8, 12))).toBe('WEBP');
		} finally {
			await deleteUser(sql, userId);
		}
	});

	it('shows a hidden artwork only to its author, privately, and never to the shared cache', async () => {
		const userId = `hidden-user-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
		const put = vi.fn(async () => {});
		platform.cache = { delete: vi.fn(), match: vi.fn(async () => undefined), put };

		try {
			await insertUser(sql, userId);
			const { publishArtwork } = await import('#lib/server/artwork/service.js');
			const artwork = await publishArtwork(
				{ drawingDocument: ONE_STROKE_DRAWING, title: 'Under review' },
				{ ipAddress: '127.0.0.1', user: createCanonicalUser(userId) }
			);
			await sql`update app.artworks set is_hidden = true, hidden_at = now() where id = ${artwork.id}`;

			const { GET } = await import('./media/+server');
			const request = () => new Request(`http://localhost/api/artworks/${artwork.id}/media?v=webp`);
			const asAuthor = await GET({
				locals: { user: createCanonicalUser(userId) },
				params: { artworkId: artwork.id },
				request: request()
			} as never);
			const asVisitor = await GET({
				locals: {},
				params: { artworkId: artwork.id },
				request: request()
			} as never);

			expect(asAuthor.status).toBe(200);
			expect(asAuthor.headers.get('cache-control')).toBe('private, no-store');
			expect(put).not.toHaveBeenCalled();
			expect(asVisitor.status).toBe(404);
		} finally {
			platform.cache = undefined;
			await deleteUser(sql, userId);
		}
	});

	it('keeps a published drawing out of its row and opens a fork on its image', async () => {
		const userId = `fork-user-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
		const user = createCanonicalUser(userId);

		try {
			await insertUser(sql, userId);
			const { publishArtwork } = await import('#lib/server/artwork/service.js');
			const artwork = await publishArtwork(
				{
					drawingDocument: JSON.stringify({
						...createEmptyDrawingDocument('artwork'),
						strokes: DRAWN_STROKES
					}),
					title: 'Fork me'
				},
				{ ipAddress: '127.0.0.1', user }
			);

			// Supavisor drops a session whose Bind carries a whole drawing, so the
			// row only names the document; the bytes live in object storage.
			const [row] = await sql<
				Array<{ drawing_document: string | null; drawing_document_key: string | null }>
			>`select drawing_document, drawing_document_key from app.artworks where id = ${artwork.id}`;
			expect(row?.drawing_document).toBeNull();
			expect(row?.drawing_document_key).toMatch(/^documents\/[0-9a-f]{64}\.json\.gz$/);

			// A fork starts from the image, not from hundreds of KiB of strokes.
			const { load } = await import('../../../draw/+page.server');
			const data = (await load({
				locals: { user },
				request: new Request(`http://localhost/draw?fork=${artwork.id}`),
				url: new URL(`http://localhost/draw?fork=${artwork.id}`)
			} as never)) as {
				forkParent: { drawingDocument: unknown; mediaUrl: string };
			};

			expect(data.forkParent.drawingDocument).toBeNull();
			expect(data.forkParent.mediaUrl).toBe(`/api/artworks/${artwork.id}/media?v=webp`);
		} finally {
			await deleteUser(sql, userId);
		}
	});

	it('publishes a fork as its own strokes over a copy of the image it was drawn on', async () => {
		const parentAuthor = `parent-user-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
		const forkAuthor = `fork-author-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

		try {
			await insertUser(sql, parentAuthor);
			await insertUser(sql, forkAuthor);
			const { publishArtwork } = await import('#lib/server/artwork/service.js');
			const parent = await publishArtwork(
				{
					drawingDocument: JSON.stringify({
						...createEmptyDrawingDocument('artwork'),
						strokes: [
							{
								color: '#2d2420',
								points: [
									[100, 100],
									[668, 100]
								],
								size: 24
							}
						]
					}),
					title: 'The original'
				},
				{ ipAddress: '127.0.0.1', user: createCanonicalUser(parentAuthor) }
			);
			const ownStrokes: InkDocument = {
				background: '#fdfbf7',
				height: 768,
				kind: 'artwork',
				strokes: [
					{
						brush: 'round@1',
						color: '#c84f4f',
						pointer: 'mouse',
						points: [
							[384, 200],
							[384, 700]
						],
						size: 24,
						start: 0,
						times: [0, 120]
					}
				],
				width: 768
			};

			const fork = await publishArtwork(
				{
					drawingDocument: JSON.stringify(encodeDrawingV3(ownStrokes)),
					parentArtworkId: parent.id,
					title: 'The fork'
				},
				{ ipAddress: '127.0.0.1', user: createCanonicalUser(forkAuthor) }
			);

			const bucket = platform.bucket as AppBucket;
			const bytesOf = async (key: string) =>
				new Uint8Array(await new Response((await bucket.get(key))!.body).arrayBuffer());
			const [row] = await sql<Array<{ drawing_document_key: string; storage_key: string }>>`
				select drawing_document_key, storage_key from app.artworks where id = ${fork.id}`;
			const stored = JSON.parse(gunzipSync(await bytesOf(row!.drawing_document_key)).toString());

			// Only the fork's own stroke, and where it was drawn.
			expect(stored.strokes).toHaveLength(1);
			expect(stored.parent.artwork).toBe(parent.id);
			// The backup: the fork keeps its own copy of the original's image.
			expect(stored.parent.image.startsWith(`artworks/${forkAuthor}/`)).toBe(true);
			expect(await bytesOf(stored.parent.image)).toEqual(await bytesOf(parent.storageKey));

			const image = await decodeImage(await bytesOf(row!.storage_key), 'webp');
			const at = (x: number, y: number) => {
				const offset = (y * image.width + x) * 4;
				return Array.from(image.data.slice(offset, offset + 3));
			};
			expect(at(200, 100)).toEqual([0x2d, 0x24, 0x20]);
			expect(at(384, 400)).toEqual([0xc8, 0x4f, 0x4f]);
		} finally {
			await deleteUser(sql, forkAuthor);
			await deleteUser(sql, parentAuthor);
		}
	});
});
