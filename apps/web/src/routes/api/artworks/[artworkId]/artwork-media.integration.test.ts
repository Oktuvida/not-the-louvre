import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import postgres from 'postgres';
import type { Sql } from 'postgres';
import { getPlatformProxy, type PlatformProxy } from 'wrangler';
import type { MediaBucket } from '#lib/server/platform.js';
import { createEmptyDrawingDocument } from '#lib/features/stroke-json/document.js';

const DATABASE_URL = process.env.DATABASE_URL;
// Same opt-in flag as the other integration suites: `bun run test:integration`.
const describeWithDatabase = process.env.RUN_INTEGRATION === '1' ? describe : describe.skip;

// Vitest's workers never see the platform proxy Vite starts, so the suite runs
// its own: the R2 bucket is wrangler's local emulation of the real one.
const platform = vi.hoisted(() => ({ bucket: undefined as unknown }));
vi.mock('#lib/server/platform.js', () => ({
	edgeCache: () => undefined,
	hyperdriveConnectionString: () => undefined,
	mediaBucket: () => platform.bucket,
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

describeWithDatabase('artwork media storage', () => {
	let sql: DbClient;
	let proxy: PlatformProxy<{ MEDIA: MediaBucket }>;

	beforeAll(async () => {
		proxy = await getPlatformProxy<{ MEDIA: MediaBucket }>({ persist: false });
		platform.bucket = proxy.env.MEDIA;
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
});
