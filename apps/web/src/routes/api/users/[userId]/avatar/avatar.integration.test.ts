import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import postgres from 'postgres';
import type { Sql } from 'postgres';
import { getPlatformProxy, type PlatformProxy } from 'wrangler';
import type { MediaBucket } from '#lib/server/platform.js';
import {
	createEmptyDrawingDocument,
	serializeDrawingDocument
} from '#lib/features/stroke-json/document.js';

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

const createDbClient = () => {
	if (!DATABASE_URL) {
		throw new Error('DATABASE_URL is required for avatar integration tests');
	}

	return postgres(DATABASE_URL, { max: 1 });
};

const insertUser = async (sql: DbClient, id: string) => {
	const now = new Date('2026-03-28T19:30:00.000Z');

	await sql`
		insert into better_auth.user (
			id,
			name,
			email,
			email_verified,
			image,
			created_at,
			updated_at,
			username,
			display_username,
			nickname
		)
		values (
			${id},
			${id},
			${`${id}@not-the-louvre.local`},
			true,
			null,
			${now},
			${now},
			null,
			null,
			${`${id}_nick`}
		)
	`;

	await sql`
		insert into app.users (
			id,
			nickname,
			recovery_hash,
			avatar_url,
			role,
			created_at,
			updated_at,
			avatar_onboarding_completed_at
		)
		values (
			${id},
			${`${id}_nick`},
			${`recovery-${id}`},
			null,
			'user',
			${now},
			${now},
			null
		)
	`;
};

const deleteUser = async (sql: DbClient, userId: string) => {
	await sql`delete from app.users where id = ${userId}`;
	await sql`delete from better_auth.user where id = ${userId}`;
};

const makeLocalUser = (id: string) => ({
	avatarOnboardingCompletedAt: null,
	avatarUrl: null,
	authUserId: id,
	createdAt: new Date('2026-03-28T19:30:00.000Z'),
	email: `${id}@not-the-louvre.local`,
	emailVerified: true,
	id,
	image: null,
	name: id,
	nickname: `${id}_nick`,
	role: 'user' as const,
	updatedAt: new Date('2026-03-28T19:30:00.000Z')
});

describeWithDatabase('avatar backend integration', () => {
	let sql: DbClient;
	let proxy: PlatformProxy<{ MEDIA: MediaBucket }>;

	beforeAll(async () => {
		proxy = await getPlatformProxy<{ MEDIA: MediaBucket }>({ persist: false });
		platform.bucket = proxy.env.MEDIA;
		sql = createDbClient();
	});

	afterAll(async () => {
		await sql?.end({ timeout: 5 });
		await proxy?.dispose();
	});

	it('uploads avatar media, streams it back through the backend endpoint, and deletes it', async () => {
		const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
		const userId = `avatar-user-${uniqueSuffix}`;
		const avatarDocument = serializeDrawingDocument(createEmptyDrawingDocument('avatar'));

		try {
			await insertUser(sql, userId);

			const formData = new FormData();
			formData.append('drawingDocument', avatarDocument);

			const avatarModule = await import('./+server');
			const uploadResponse = await avatarModule.PUT({
				locals: { user: makeLocalUser(userId) },
				params: { userId },
				request: new Request('http://localhost/api/users/avatar', {
					body: formData,
					method: 'PUT'
				})
			} as never);

			expect(uploadResponse.status).toBe(200);
			const uploadPayload = (await uploadResponse.json()) as { avatarUrl: string };
			expect(uploadPayload.avatarUrl).toMatch(
				new RegExp(`^/api/users/${userId}/avatar\\?v=[0-9a-f]{16}$`)
			);

			const [storedUser] = await sql<
				Array<{ avatar_document: string | null; avatar_url: string | null }>
			>`
				select avatar_document, avatar_url
				from app.users
				where id = ${userId}
			`;

			expect(storedUser?.avatar_document).toBeTruthy();
			expect(storedUser?.avatar_url).toMatch(new RegExp(`^avatars/${userId}/[0-9a-f]{16}\\.webp$`));

			const getResponse = await avatarModule.GET({
				locals: {},
				params: { userId },
				request: new Request(`http://localhost${uploadPayload.avatarUrl}`)
			} as never);
			const avatarBytes = new Uint8Array(await getResponse.arrayBuffer());

			expect(getResponse.status).toBe(200);
			expect(getResponse.headers.get('content-type')).toBe('image/webp');
			expect(getResponse.headers.get('cache-control')).toBe(
				'public, max-age=31536000, immutable, s-maxage=3600'
			);
			expect(avatarBytes.byteLength).toBeGreaterThan(0);

			const deleteResponse = await avatarModule.DELETE({
				locals: { user: makeLocalUser(userId) },
				params: { userId },
				request: new Request('http://localhost/api/users/avatar', { method: 'DELETE' })
			} as never);

			expect(deleteResponse.status).toBe(200);
			expect(await deleteResponse.json()).toMatchObject({ avatarUrl: null });

			const [deletedUser] = await sql<Array<{ avatar_url: string | null }>>`
				select avatar_url
				from app.users
				where id = ${userId}
			`;

			expect(deletedUser?.avatar_url).toBeNull();

			const missingResponse = await avatarModule.GET({
				locals: {},
				params: { userId },
				request: new Request(`http://localhost${uploadPayload.avatarUrl}`)
			} as never);

			expect(missingResponse.status).toBe(404);
			await expect(missingResponse.json()).resolves.toMatchObject({
				code: 'NOT_FOUND',
				message: 'Avatar not found'
			});
		} finally {
			await deleteUser(sql, userId);
		}
	});
});
