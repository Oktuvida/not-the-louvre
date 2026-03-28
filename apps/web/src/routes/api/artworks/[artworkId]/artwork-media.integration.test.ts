import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import postgres from 'postgres';
import type { Sql } from 'postgres';
import { createAvifTestFile, fileToBytes } from '$lib/server/media/test-helpers';
import { supabaseArtworkStorage } from '$lib/server/artwork/storage';

const testFileDirectory = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(testFileDirectory, '../../../../../');
const workspaceRoot = resolve(testFileDirectory, '../../../../../../../');

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
		throw new Error('DATABASE_URL is required for artwork media integration tests');
	}

	return postgres(DATABASE_URL, { max: 1 });
};

const insertUser = async (sql: DbClient, id: string) => {
	const now = new Date('2026-03-28T19:00:00.000Z');

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
			updated_at
		)
		values (
			${id},
			${`${id}_nick`},
			${`recovery-${id}`},
			null,
			'user',
			${now},
			${now}
		)
	`;
};

const insertArtwork = async (
	sql: DbClient,
	input: {
		authorId: string;
		id: string;
		mediaSizeBytes: number;
		storageKey: string;
		updatedAt: Date;
		createdAt: Date;
	}
) => {
	await sql`
		insert into app.artworks (
			id,
			author_id,
			parent_id,
			title,
			storage_key,
			media_content_type,
			media_size_bytes,
			is_hidden,
			hidden_at,
			score,
			comment_count,
			fork_count,
			created_at,
			updated_at
		)
		values (
			${input.id},
			${input.authorId},
			null,
			${`Integration artwork ${input.id}`},
			${input.storageKey},
			'image/avif',
			${input.mediaSizeBytes},
			false,
			null,
			0,
			0,
			0,
			${input.createdAt},
			${input.updatedAt}
		)
	`;
};

const deleteUserAndArtwork = async (sql: DbClient, artworkId: string, userId: string) => {
	await sql`delete from app.artworks where id = ${artworkId}`;
	await sql`delete from app.users where id = ${userId}`;
	await sql`delete from better_auth.user where id = ${userId}`;
};

describeWithStorage('artwork media backend integration', () => {
	let sql: DbClient;

	beforeAll(() => {
		sql = createDbClient();
	});

	afterAll(async () => {
		await sql.end({ timeout: 5 });
	});

	it('uploads artwork media to real storage and streams it through the backend endpoint', async () => {
		const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
		const userId = `storage-user-${uniqueSuffix}`;
		const artworkId = `storage-artwork-${uniqueSuffix}`;
		const storageKey = `artworks/${userId}/${artworkId}.avif`;
		const now = new Date('2026-03-28T19:00:00.000Z');
		const mediaFile = await createAvifTestFile({
			height: 1024,
			name: 'integration-artwork.avif',
			width: 1024
		});
		const expectedBytes = await fileToBytes(mediaFile);

		try {
			await insertUser(sql, userId);
			await supabaseArtworkStorage.upload(storageKey, mediaFile);
			await insertArtwork(sql, {
				authorId: userId,
				createdAt: now,
				id: artworkId,
				mediaSizeBytes: mediaFile.size,
				storageKey,
				updatedAt: now
			});

			const { GET } = await import('./media/+server');
			const response = await GET({ locals: {}, params: { artworkId } } as never);
			const actualBytes = new Uint8Array(await response.arrayBuffer());

			expect(response.status).toBe(200);
			expect(response.headers.get('cache-control')).toBe(
				'public, max-age=31536000, immutable'
			);
			expect(response.headers.get('content-type')).toBe('image/avif');
			expect(actualBytes).toEqual(expectedBytes);
		} finally {
			await supabaseArtworkStorage.delete(storageKey);
			await deleteUserAndArtwork(sql, artworkId, userId);
		}
	});
});