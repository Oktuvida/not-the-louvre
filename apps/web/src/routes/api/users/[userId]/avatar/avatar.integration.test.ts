import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import postgres from 'postgres';
import type { Sql } from 'postgres';
import { createPngTestFile } from '$lib/server/media/test-helpers';

const testFileDirectory = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(testFileDirectory, '../../../../../../');
const workspaceRoot = resolve(testFileDirectory, '../../../../../../../../');

const loadEnvFile = (filePath: string) => {
	if (!existsSync(filePath)) {
		return;
	}

	const fileContents = readFileSync(filePath, 'utf8');
	for (const rawLine of fileContents.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line || line.startsWith('#')) {
			continue;
		}

		const separatorIndex = line.indexOf('=');
		if (separatorIndex <= 0) {
			continue;
		}

		const key = line.slice(0, separatorIndex).trim();
		const rawValue = line.slice(separatorIndex + 1).trim();
		const normalizedValue = rawValue.replace(/^['"]|['"]$/g, '');

		if (!process.env[key]) {
			process.env[key] = normalizedValue;
		}
	}
};

loadEnvFile(resolve(appRoot, '.env'));
loadEnvFile(resolve(workspaceRoot, '.env.supabase'));

const DATABASE_URL = process.env.DATABASE_URL;
const STORAGE_BASE_URL = process.env.SUPABASE_PUBLIC_URL;
const STORAGE_SERVICE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SERVICE_ROLE_KEY;

const describeWithStorage = DATABASE_URL && STORAGE_BASE_URL && STORAGE_SERVICE_KEY ? describe : describe.skip;

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

describeWithStorage('avatar backend integration', () => {
	let sql: DbClient;

	beforeAll(() => {
		sql = createDbClient();
	});

	afterAll(async () => {
		await sql.end({ timeout: 5 });
	});

	it('uploads avatar media, streams it back through the backend endpoint, and deletes it', async () => {
		const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
		const userId = `avatar-user-${uniqueSuffix}`;
		const avatarFile = await createPngTestFile({
			height: 256,
			name: 'integration-avatar.png',
			width: 256
		});

		try {
			await insertUser(sql, userId);

			const formData = new FormData();
			formData.append('file', avatarFile);

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
			expect(uploadPayload.avatarUrl).toBe(`avatars/${userId}.avif`);

			const [storedUser] = await sql<Array<{ avatar_url: string | null }>>`
				select avatar_url
				from app.users
				where id = ${userId}
			`;

			expect(storedUser?.avatar_url).toBe(`avatars/${userId}.avif`);

			const getResponse = await avatarModule.GET({
				locals: {},
				params: { userId }
			} as never);
			const avatarBytes = new Uint8Array(await getResponse.arrayBuffer());

			expect(getResponse.status).toBe(200);
			expect(getResponse.headers.get('content-type')).toBe('image/avif');
			expect(getResponse.headers.get('cache-control')).toBe('public, max-age=300');
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
				params: { userId }
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