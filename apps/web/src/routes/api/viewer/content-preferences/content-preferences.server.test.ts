import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ArtworkFlowError } from '$lib/server/artwork/errors';

const mocked = vi.hoisted(() => ({
	getViewerContentPreferences: vi.fn(),
	setViewerAdultContentEnabled: vi.fn(),
	setViewerAmbientAudioEnabled: vi.fn()
}));

vi.mock('$lib/server/moderation/service', () => ({
	getViewerContentPreferences: mocked.getViewerContentPreferences,
	setViewerAdultContentEnabled: mocked.setViewerAdultContentEnabled,
	setViewerAmbientAudioEnabled: mocked.setViewerAmbientAudioEnabled
}));

const makeViewerLocals = () => ({
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

describe('viewer content preferences endpoint', () => {
	beforeEach(() => {
		mocked.getViewerContentPreferences.mockReset();
		mocked.setViewerAdultContentEnabled.mockReset();
		mocked.setViewerAmbientAudioEnabled.mockReset();
	});

	it('returns persisted viewer content preferences', async () => {
		mocked.getViewerContentPreferences.mockResolvedValue({
			adultContentConsentedAt: '2026-03-29T12:00:00.000Z',
			adultContentEnabled: true,
			ambientAudioEnabled: null,
			adultContentRevokedAt: null
		});

		const { GET } = await import('./+server');
		const response = await GET({ locals: makeViewerLocals() } as never);

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			adultContentEnabled: true,
			ambientAudioEnabled: null
		});
	});

	it('updates viewer adult-content consent', async () => {
		mocked.setViewerAdultContentEnabled.mockResolvedValue({
			adultContentConsentedAt: '2026-03-29T12:00:00.000Z',
			adultContentEnabled: true,
			adultContentRevokedAt: null
		});

		const { PATCH } = await import('./+server');
		const response = await PATCH({
			locals: makeViewerLocals(),
			request: new Request('http://localhost/api/viewer/content-preferences', {
				body: JSON.stringify({ adultContentEnabled: true }),
				headers: { 'content-type': 'application/json' },
				method: 'PATCH'
			})
		} as never);

		expect(response.status).toBe(200);
		expect(mocked.setViewerAdultContentEnabled).toHaveBeenCalledWith(
			{ enabled: true },
			expect.objectContaining({ user: makeViewerLocals().user })
		);
	});

	it('updates viewer ambient-audio preference without touching other preference paths', async () => {
		mocked.setViewerAmbientAudioEnabled.mockResolvedValue({
			adultContentConsentedAt: null,
			adultContentEnabled: false,
			ambientAudioEnabled: false,
			adultContentRevokedAt: null
		});

		const { PATCH } = await import('./+server');
		const response = await PATCH({
			locals: makeViewerLocals(),
			request: new Request('http://localhost/api/viewer/content-preferences', {
				body: JSON.stringify({ ambientAudioEnabled: false }),
				headers: { 'content-type': 'application/json' },
				method: 'PATCH'
			})
		} as never);

		expect(response.status).toBe(200);
		expect(mocked.setViewerAmbientAudioEnabled).toHaveBeenCalledWith(
			{ enabled: false },
			expect.objectContaining({ user: makeViewerLocals().user })
		);
		expect(mocked.setViewerAdultContentEnabled).not.toHaveBeenCalled();
	});

	it('maps unauthenticated errors from the service', async () => {
		mocked.getViewerContentPreferences.mockRejectedValue(
			new ArtworkFlowError(401, 'Authentication required', 'UNAUTHENTICATED')
		);

		const { GET } = await import('./+server');
		const response = await GET({ locals: { user: null } } as never);

		expect(response.status).toBe(401);
		expect(await response.json()).toMatchObject({ code: 'UNAUTHENTICATED' });
	});
});
