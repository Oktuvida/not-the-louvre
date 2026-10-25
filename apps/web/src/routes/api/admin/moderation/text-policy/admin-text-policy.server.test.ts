import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ArtworkFlowError } from '#lib/server/artwork/errors.js';

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
	getTextModerationSnapshot: vi.fn(),
	updateTextModerationPolicies: vi.fn()
}));

vi.mock('#lib/server/moderation/service.js', () => ({
	getTextModerationSnapshot: mocked.getTextModerationSnapshot,
	updateTextModerationPolicies: mocked.updateTextModerationPolicies
}));

const makeAdminLocals = () => ({
	user: {
		authUserId: 'auth-admin-1',
		avatarUrl: null,
		createdAt: new Date('2026-01-01T00:00:00.000Z'),
		email: 'admin@not-the-louvre.local',
		emailVerified: false,
		id: 'admin-1',
		image: null,
		isBanned: false,
		name: 'admin',
		nickname: 'admin',
		role: 'admin' as const,
		updatedAt: new Date('2026-01-01T00:00:00.000Z')
	}
});

const makeUserLocals = () => ({
	user: {
		authUserId: 'auth-user-1',
		avatarUrl: null,
		createdAt: new Date('2026-01-01T00:00:00.000Z'),
		email: 'user@not-the-louvre.local',
		emailVerified: false,
		id: 'user-1',
		image: null,
		isBanned: false,
		name: 'user',
		nickname: 'user',
		role: 'user' as const,
		updatedAt: new Date('2026-01-01T00:00:00.000Z')
	}
});

describe('admin text policy endpoint', () => {
	beforeEach(() => {
		mocked.getTextModerationSnapshot.mockReset();
		mocked.updateTextModerationPolicies.mockReset();
	});

	it('returns the moderation policy snapshot for admins', async () => {
		mocked.getTextModerationSnapshot.mockResolvedValue({
			policies: {
				artwork_title: { allowlist: [], blocklist: ['mierda'], version: 3 },
				comment: { allowlist: [], blocklist: [], version: 2 },
				nickname: { allowlist: [], blocklist: ['cabron'], version: 1 }
			}
		});

		const { GET } = await import('./+server');
		const response = await GET({ locals: makeAdminLocals() } as never);

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			policies: {
				nickname: { version: 1 }
			}
		});
	});

	it('updates moderation policies for admins', async () => {
		mocked.updateTextModerationPolicies.mockResolvedValue({
			policies: {
				artwork_title: { allowlist: [], blocklist: ['mierda'], version: 3 },
				comment: { allowlist: ['figure drawing'], blocklist: ['spoiler'], version: 3 },
				nickname: { allowlist: [], blocklist: ['cabron'], version: 1 }
			}
		});

		const { PUT } = await import('./+server');
		const response = await PUT({
			locals: makeAdminLocals(),
			request: new Request('http://localhost/api/admin/moderation/text-policy', {
				body: JSON.stringify({
					policies: {
						comment: {
							allowlist: ['figure drawing'],
							blocklist: ['spoiler'],
							expectedVersion: 2
						}
					}
				}),
				headers: { 'content-type': 'application/json' },
				method: 'PUT'
			})
		} as never);

		expect(response.status).toBe(200);
		expect(mocked.updateTextModerationPolicies).toHaveBeenCalledWith(
			expect.objectContaining({
				policies: {
					comment: {
						allowlist: ['figure drawing'],
						blocklist: ['spoiler'],
						expectedVersion: 2
					}
				}
			}),
			expect.objectContaining({ user: makeAdminLocals().user })
		);
	});

	it('purges the public policy snapshot from the local edge cache after an update', async () => {
		mocked.updateTextModerationPolicies.mockResolvedValue({ policies: {} });
		const edgeCache = { delete: vi.fn(async () => true), match: vi.fn(), put: vi.fn() };
		const waitUntil = vi.fn();

		const { PUT } = await import('./+server');
		await PUT({
			locals: makeAdminLocals(),
			platform: usePlatform({ caches: { default: edgeCache }, context: { waitUntil } }),
			request: new Request('https://gallery.test/api/admin/moderation/text-policy', {
				body: JSON.stringify({ policies: {} }),
				headers: { 'content-type': 'application/json' },
				method: 'PUT'
			}),
			url: new URL('https://gallery.test/api/admin/moderation/text-policy')
		} as never);

		expect(edgeCache.delete).toHaveBeenCalledWith(
			'https://gallery.test/api/moderation/text-policy'
		);
		expect(waitUntil).toHaveBeenCalled();
	});

	it('rejects non-admin updates', async () => {
		mocked.updateTextModerationPolicies.mockRejectedValue(
			new ArtworkFlowError(403, 'Admin access required', 'FORBIDDEN')
		);

		const { PUT } = await import('./+server');
		const response = await PUT({
			locals: makeUserLocals(),
			request: new Request('http://localhost/api/admin/moderation/text-policy', {
				body: JSON.stringify({ policies: {} }),
				headers: { 'content-type': 'application/json' },
				method: 'PUT'
			})
		} as never);

		expect(response.status).toBe(403);
		expect(await response.json()).toMatchObject({ code: 'FORBIDDEN' });
	});
});
