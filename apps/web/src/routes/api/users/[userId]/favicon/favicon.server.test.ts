import sharp from 'sharp';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ArtworkFlowError } from '$lib/server/artwork/errors';
import type { UserRecord } from '$lib/server/user/types';
import { createAvifTestFile, fileToBytes } from '$lib/server/media/test-helpers';

const mocked = vi.hoisted(() => ({
	findUserById: vi.fn(),
	streamAvatarStorageObject: vi.fn()
}));

vi.mock('$lib/server/user/repository', () => ({
	userRepository: {
		findUserById: mocked.findUserById
	}
}));

vi.mock('$lib/server/user/storage', () => ({
	streamAvatarStorageObject: mocked.streamAvatarStorageObject
}));

const makeUserRecord = (overrides: Partial<UserRecord> = {}): UserRecord => ({
	avatarUrl: 'avatars/user-1.avif',
	avatarOnboardingCompletedAt: new Date('2026-01-01T00:00:00.000Z'),
	createdAt: new Date('2026-01-01T00:00:00.000Z'),
	id: 'user-1',
	nickname: 'artist',
	role: 'user',
	updatedAt: new Date('2026-01-01T00:00:00.000Z'),
	...overrides
});

describe('GET /api/users/[userId]/favicon', () => {
	beforeEach(() => {
		mocked.findUserById.mockReset();
		mocked.streamAvatarStorageObject.mockReset();
	});

	it('renders a rounded PNG favicon from the stored avatar media', async () => {
		const avatarFile = await createAvifTestFile({
			height: 256,
			name: 'avatar.avif',
			pattern: 'noise',
			width: 256
		});

		mocked.findUserById.mockResolvedValue(makeUserRecord());
		mocked.streamAvatarStorageObject.mockResolvedValue(
			new Response(await fileToBytes(avatarFile), {
				headers: { 'content-type': 'image/avif' },
				status: 200
			})
		);

		const { GET } = await import('./+server');
		const response = await GET({
			locals: {},
			params: { userId: 'user-1' }
		} as never);

		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toBe('image/png');
		expect(response.headers.get('cache-control')).toMatch(/public/);

		const pngBuffer = Buffer.from(await response.arrayBuffer());
		const metadata = await sharp(pngBuffer).metadata();
		const { data, info } = await sharp(pngBuffer)
			.ensureAlpha()
			.raw()
			.toBuffer({ resolveWithObject: true });

		expect(metadata.format).toBe('png');
		expect(metadata.width).toBe(64);
		expect(metadata.height).toBe(64);

		const topLeftAlpha = data[3];
		const centerAlpha =
			data[
				Math.floor(info.width / 2) * 4 + Math.floor(info.width / 2) * info.channels * info.width + 3
			];

		expect(topLeftAlpha).toBe(0);
		expect(centerAlpha).toBeGreaterThan(0);
	});

	it('returns 404 when the user has no uploaded avatar', async () => {
		mocked.findUserById.mockResolvedValue(makeUserRecord({ avatarUrl: null }));

		const { GET } = await import('./+server');
		const response = await GET({
			locals: {},
			params: { userId: 'user-1' }
		} as never);

		expect(response.status).toBe(404);
	});

	it('returns a JSON error envelope when avatar streaming fails with a domain error', async () => {
		mocked.findUserById.mockResolvedValue(makeUserRecord());
		mocked.streamAvatarStorageObject.mockRejectedValue(
			new ArtworkFlowError(404, 'Avatar not found', 'NOT_FOUND')
		);

		const { GET } = await import('./+server');
		const response = await GET({
			locals: {},
			params: { userId: 'user-1' }
		} as never);

		expect(response.status).toBe(404);
		expect(await response.json()).toMatchObject({
			code: 'NOT_FOUND',
			message: 'Avatar not found'
		});
	});
});
