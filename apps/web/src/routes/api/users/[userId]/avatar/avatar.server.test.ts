import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ArtworkFlowError } from '#lib/server/artwork/errors.js';
import type { UserRecord } from '#lib/server/user/types.js';
import {
	createEmptyDrawingDocument,
	serializeDrawingDocument
} from '#lib/features/stroke-json/document.js';

// Handlers reach the Cloudflare runtime through #lib/server/platform.js; each
// test registers the cache and waitUntil it would have found there.
type FakePlatform = {
	caches?: { default?: unknown };
	context?: { waitUntil?: (promise: Promise<unknown>) => void };
};
const fakePlatform = vi.hoisted(() => ({ current: undefined as FakePlatform | undefined }));
vi.mock('#lib/server/platform.js', () => ({
	edgeCache: () => fakePlatform.current?.caches?.default,
	hyperdriveConnectionString: () => undefined,
	runAfterResponse: (promise: Promise<unknown>) =>
		fakePlatform.current?.context?.waitUntil?.(promise)
}));
const usePlatform = (platform: FakePlatform) => {
	fakePlatform.current = platform;
	return platform;
};
beforeEach(() => {
	fakePlatform.current = undefined;
});

const mocked = vi.hoisted(() => ({
	avatarService: {
		uploadAvatar: vi.fn(),
		deleteAvatar: vi.fn()
	},
	findUserAvatarRefById: vi.fn(),
	streamAvatarStorageObject: vi.fn()
}));

vi.mock('#lib/server/user/avatar.service.js', () => ({
	avatarService: mocked.avatarService
}));

vi.mock('#lib/server/user/repository.js', () => ({
	userRepository: {
		findUserAvatarRefById: mocked.findUserAvatarRefById,
		updateUserAvatarUrl: vi.fn()
	}
}));

vi.mock('#lib/server/user/storage.js', () => ({
	streamAvatarStorageObject: mocked.streamAvatarStorageObject
}));

const AVATAR_VERSION = '0123456789abcdef';
const VERSIONED_AVATAR_KEY = `avatars/user-1/${AVATAR_VERSION}.webp`;

const makeUserRecord = (overrides: Partial<UserRecord> = {}): UserRecord => ({
	avatarIsHidden: false,
	avatarIsNsfw: false,
	avatarUrl: 'avatars/user-1.avif',
	avatarOnboardingCompletedAt: new Date('2026-01-01T00:00:00.000Z'),
	banReason: null,
	bannedAt: null,
	createdAt: new Date('2026-01-01T00:00:00.000Z'),
	id: 'user-1',
	isBanned: false,
	nickname: 'artist',
	role: 'user',
	updatedAt: new Date('2026-01-01T00:00:00.000Z'),
	...overrides
});

const makeLocalUser = (overrides = {}) => ({
	avatarUrl: null,
	avatarOnboardingCompletedAt: null,
	authUserId: 'auth-user-1',
	createdAt: new Date('2026-01-01T00:00:00.000Z'),
	email: 'artist@not-the-louvre.local',
	emailVerified: false,
	id: 'user-1',
	image: null,
	name: 'artist',
	nickname: 'artist',
	role: 'user',
	updatedAt: new Date('2026-01-01T00:00:00.000Z'),
	...overrides
});

describe('GET /api/users/[userId]/avatar', () => {
	beforeEach(() => {
		mocked.findUserAvatarRefById.mockReset();
		mocked.streamAvatarStorageObject.mockReset();
	});

	it('streams the avatar for a user with an uploaded avatar', async () => {
		mocked.findUserAvatarRefById.mockResolvedValue(
			makeUserRecord({ avatarUrl: 'avatars/user-1.avif' })
		);
		mocked.streamAvatarStorageObject.mockResolvedValue(
			new Response(new Uint8Array([1, 2, 3]), { status: 200 })
		);

		const { GET } = await import('./+server');
		const response = await GET({
			locals: {},
			params: { userId: 'user-1' },
			request: new Request('https://gallery.test/api/users/user-1/avatar')
		} as never);

		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toBe('image/avif');
		expect(response.headers.get('cache-control')).toMatch(/public/);
		expect(mocked.streamAvatarStorageObject).toHaveBeenCalledWith('avatars/user-1.avif');
	});

	it('lets every cache keep an avatar asked for by its current version forever', async () => {
		mocked.findUserAvatarRefById.mockResolvedValue(
			makeUserRecord({ avatarUrl: VERSIONED_AVATAR_KEY })
		);
		mocked.streamAvatarStorageObject.mockResolvedValue(
			new Response(new Uint8Array([1, 2, 3]), { status: 200 })
		);

		const { GET } = await import('./+server');
		const response = await GET({
			locals: {},
			params: { userId: 'user-1' },
			request: new Request(`https://gallery.test/api/users/user-1/avatar?v=${AVATAR_VERSION}`)
		} as never);

		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toBe('image/webp');
		expect(response.headers.get('cache-control')).toBe(
			'public, max-age=31536000, immutable, s-maxage=3600'
		);
	});

	it('keeps short caching for an address that does not name the current version', async () => {
		mocked.findUserAvatarRefById.mockResolvedValue(
			makeUserRecord({ avatarUrl: VERSIONED_AVATAR_KEY })
		);

		const { GET } = await import('./+server');
		for (const url of [
			'https://gallery.test/api/users/user-1/avatar',
			'https://gallery.test/api/users/user-1/avatar?v=0000000000000000'
		]) {
			mocked.streamAvatarStorageObject.mockResolvedValue(
				new Response(new Uint8Array([1, 2, 3]), { status: 200 })
			);
			const response = await GET({
				locals: {},
				params: { userId: 'user-1' },
				request: new Request(url)
			} as never);

			expect(response.status).toBe(200);
			expect(response.headers.get('cache-control')).toBe('public, max-age=300, s-maxage=3600');
		}
	});

	it('returns 404 for a user without an avatar', async () => {
		mocked.findUserAvatarRefById.mockResolvedValue(makeUserRecord({ avatarUrl: null }));

		const { GET } = await import('./+server');
		const response = await GET({
			locals: {},
			params: { userId: 'user-1' },
			request: new Request('https://gallery.test/api/users/user-1/avatar')
		} as never);

		expect(response.status).toBe(404);
	});

	it('returns 404 for a hidden avatar', async () => {
		mocked.findUserAvatarRefById.mockResolvedValue(
			makeUserRecord({ avatarIsHidden: true, avatarUrl: 'avatars/user-1.avif' })
		);

		const { GET } = await import('./+server');
		const response = await GET({
			locals: {},
			params: { userId: 'user-1' },
			request: new Request('https://gallery.test/api/users/user-1/avatar')
		} as never);

		expect(response.status).toBe(404);
		expect(mocked.streamAvatarStorageObject).not.toHaveBeenCalled();
	});

	it('returns 404 for a nonexistent user', async () => {
		mocked.findUserAvatarRefById.mockResolvedValue(null);

		const { GET } = await import('./+server');
		const response = await GET({
			locals: {},
			params: { userId: 'unknown-user' },
			request: new Request('https://gallery.test/api/users/unknown-user/avatar')
		} as never);

		expect(response.status).toBe(404);
	});

	it('returns a JSON error envelope when avatar streaming fails with a domain error', async () => {
		mocked.findUserAvatarRefById.mockResolvedValue(
			makeUserRecord({ avatarUrl: 'avatars/user-1.avif' })
		);
		mocked.streamAvatarStorageObject.mockRejectedValue(
			new ArtworkFlowError(404, 'Avatar not found', 'NOT_FOUND')
		);

		const { GET } = await import('./+server');
		const response = await GET({
			locals: {},
			params: { userId: 'user-1' },
			request: new Request('https://gallery.test/api/users/user-1/avatar')
		} as never);

		expect(response.status).toBe(404);
		expect(response.headers.get('content-type')).toMatch(/application\/json/);
		expect(await response.json()).toMatchObject({
			code: 'NOT_FOUND',
			message: 'Avatar not found'
		});
	});
	it('answers matching if-none-match revalidations without touching storage', async () => {
		mocked.findUserAvatarRefById.mockResolvedValue(
			makeUserRecord({ avatarUrl: 'avatars/user-1.avif' })
		);

		const { GET } = await import('./+server');
		const response = await GET({
			locals: {},
			params: { userId: 'user-1' },
			request: new Request('https://gallery.test/api/users/user-1/avatar', {
				headers: {
					'if-none-match': `"avatars/user-1.avif:${new Date('2026-01-01T00:00:00.000Z').getTime()}"`
				}
			})
		} as never);

		expect(response.status).toBe(304);
		expect(mocked.streamAvatarStorageObject).not.toHaveBeenCalled();
	});

	it('serves avatars from the edge cache without touching the database', async () => {
		const cachedResponse = new Response(new Uint8Array([9]), { status: 200 });
		const edgeCache = {
			delete: vi.fn(async () => true),
			match: vi.fn(async () => cachedResponse),
			put: vi.fn(async () => undefined)
		};

		const { GET } = await import('./+server');
		const response = await GET({
			locals: {},
			params: { userId: 'user-1' },
			platform: usePlatform({ caches: { default: edgeCache }, context: { waitUntil: vi.fn() } }),
			request: new Request('https://gallery.test/api/users/user-1/avatar')
		} as never);

		expect(response).toBe(cachedResponse);
		expect(mocked.findUserAvatarRefById).not.toHaveBeenCalled();
	});
});

describe('PUT /api/users/[userId]/avatar', () => {
	beforeEach(() => {
		mocked.avatarService.uploadAvatar.mockReset();
	});

	it('uploads and returns the address of the new avatar version', async () => {
		const updated = makeUserRecord({ avatarUrl: VERSIONED_AVATAR_KEY });
		mocked.avatarService.uploadAvatar.mockResolvedValue(updated);

		const formData = new FormData();
		const avatarDocument = serializeDrawingDocument(createEmptyDrawingDocument('avatar'));
		formData.append('drawingDocument', avatarDocument);

		const { PUT } = await import('./+server');
		const response = await PUT({
			locals: { user: makeLocalUser() },
			params: { userId: 'user-1' },
			request: new Request('http://localhost', { method: 'PUT', body: formData })
		} as never);

		expect(response.status).toBe(200);
		const json = await response.json();
		expect(json.avatarUrl).toBe(`/api/users/user-1/avatar?v=${AVATAR_VERSION}`);
	});

	it('purges the local edge cache entries after an upload', async () => {
		const updated = makeUserRecord({ avatarUrl: 'avatars/user-1.avif' });
		mocked.avatarService.uploadAvatar.mockResolvedValue(updated);

		const formData = new FormData();
		formData.append(
			'drawingDocument',
			serializeDrawingDocument(createEmptyDrawingDocument('avatar'))
		);
		const edgeCache = {
			delete: vi.fn(async () => true),
			match: vi.fn(async () => undefined),
			put: vi.fn(async () => undefined)
		};
		const waitUntil = vi.fn();

		const { PUT } = await import('./+server');
		const response = await PUT({
			locals: { user: makeLocalUser() },
			params: { userId: 'user-1' },
			platform: usePlatform({ caches: { default: edgeCache }, context: { waitUntil } }),
			request: new Request('http://localhost', { method: 'PUT', body: formData }),
			url: new URL('http://localhost/api/users/user-1/avatar')
		} as never);

		expect(response.status).toBe(200);
		expect(edgeCache.delete).toHaveBeenCalledWith('http://localhost/api/users/user-1/avatar');
		expect(edgeCache.delete).toHaveBeenCalledWith('http://localhost/api/users/user-1/favicon');
	});

	it('returns 400 JSON when the file field is missing', async () => {
		const formData = new FormData();

		const { PUT } = await import('./+server');
		const response = await PUT({
			locals: { user: makeLocalUser() },
			params: { userId: 'user-1' },
			request: new Request('http://localhost', { method: 'PUT', body: formData })
		} as never);

		expect(response.status).toBe(400);
		expect(response.headers.get('content-type')).toMatch(/application\/json/);
		expect(await response.json()).toMatchObject({
			code: 'INVALID_MEDIA_FORMAT',
			message: 'Avatar drawing document must be provided'
		});
		expect(mocked.avatarService.uploadAvatar).not.toHaveBeenCalled();
	});

	it('returns 401 for unauthenticated upload attempts', async () => {
		mocked.avatarService.uploadAvatar.mockRejectedValue(
			new ArtworkFlowError(401, 'Authentication required', 'UNAUTHENTICATED')
		);

		const formData = new FormData();
		formData.append(
			'drawingDocument',
			serializeDrawingDocument(createEmptyDrawingDocument('avatar'))
		);

		const { PUT } = await import('./+server');
		const response = await PUT({
			locals: { user: null },
			params: { userId: 'user-1' },
			request: new Request('http://localhost', { method: 'PUT', body: formData })
		} as never);

		expect(response.status).toBe(401);
		expect(response.headers.get('content-type')).toMatch(/application\/json/);
		expect(await response.json()).toMatchObject({
			code: 'UNAUTHENTICATED',
			message: 'Authentication required'
		});
	});

	it('returns 400 for invalid media format', async () => {
		mocked.avatarService.uploadAvatar.mockRejectedValue(
			new ArtworkFlowError(
				400,
				'Avatar save requires an avatar drawing document',
				'INVALID_MEDIA_FORMAT'
			)
		);

		const formData = new FormData();
		formData.append(
			'drawingDocument',
			serializeDrawingDocument(createEmptyDrawingDocument('artwork'))
		);

		const { PUT } = await import('./+server');
		const response = await PUT({
			locals: { user: makeLocalUser() },
			params: { userId: 'user-1' },
			request: new Request('http://localhost', { method: 'PUT', body: formData })
		} as never);

		expect(response.status).toBe(400);
		expect(response.headers.get('content-type')).toMatch(/application\/json/);
		expect(await response.json()).toMatchObject({
			code: 'INVALID_MEDIA_FORMAT',
			message: 'Avatar save requires an avatar drawing document'
		});
	});

	it('returns 500 JSON when avatar storage is not configured', async () => {
		mocked.avatarService.uploadAvatar.mockRejectedValue(
			new ArtworkFlowError(500, 'Missing storage configuration for avatar upload', 'STORAGE_FAILED')
		);

		const formData = new FormData();
		formData.append(
			'drawingDocument',
			serializeDrawingDocument(createEmptyDrawingDocument('avatar'))
		);

		const { PUT } = await import('./+server');
		const response = await PUT({
			locals: { user: makeLocalUser() },
			params: { userId: 'user-1' },
			request: new Request('http://localhost', { method: 'PUT', body: formData })
		} as never);

		expect(response.status).toBe(500);
		expect(response.headers.get('content-type')).toMatch(/application\/json/);
		expect(await response.json()).toMatchObject({
			code: 'STORAGE_FAILED',
			message: 'Missing storage configuration for avatar upload'
		});
	});
});

describe('DELETE /api/users/[userId]/avatar', () => {
	beforeEach(() => {
		mocked.avatarService.deleteAvatar.mockReset();
	});

	it('deletes the avatar and returns the updated profile', async () => {
		const updated = makeUserRecord({ avatarUrl: null });
		mocked.avatarService.deleteAvatar.mockResolvedValue(updated);

		const { DELETE } = await import('./+server');
		const response = await DELETE({
			locals: { user: makeLocalUser() },
			params: { userId: 'user-1' }
		} as never);

		expect(response.status).toBe(200);
		const json = await response.json();
		expect(json.avatarUrl).toBeNull();
	});

	it('returns 401 for unauthenticated delete attempts', async () => {
		mocked.avatarService.deleteAvatar.mockRejectedValue(
			new ArtworkFlowError(401, 'Authentication required', 'UNAUTHENTICATED')
		);

		const { DELETE } = await import('./+server');
		const response = await DELETE({
			locals: { user: null },
			params: { userId: 'user-1' }
		} as never);

		expect(response.status).toBe(401);
		expect(response.headers.get('content-type')).toMatch(/application\/json/);
		expect(await response.json()).toMatchObject({
			code: 'UNAUTHENTICATED',
			message: 'Authentication required'
		});
	});
});
