import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ArtworkFlowError } from '$lib/server/artwork/errors';

const mocked = {
	getIp: vi.fn(() => '127.0.0.1'),
	moderateArtwork: vi.fn(),
	moderateComment: vi.fn(),
	submitContentReport: vi.fn()
};

vi.mock('$lib/server/artwork/service', () => ({
	moderateArtwork: mocked.moderateArtwork,
	moderateComment: mocked.moderateComment,
	submitContentReport: mocked.submitContentReport
}));

vi.mock('$lib/server/auth', () => ({
	auth: {
		options: {}
	}
}));

vi.mock('better-auth/api', () => ({
	getIp: mocked.getIp
}));

describe('artwork report endpoint', () => {
	beforeEach(() => {
		mocked.getIp.mockClear();
		mocked.submitContentReport.mockReset();
	});

	it('creates artwork reports for authenticated users', async () => {
		mocked.submitContentReport.mockResolvedValue({
			artworkId: 'artwork-1',
			commentId: null,
			createdAt: new Date('2026-03-26T12:00:00.000Z'),
			details: 'Spam repost',
			id: 'report-1',
			reason: 'spam',
			reporterId: 'user-1',
			updatedAt: new Date('2026-03-26T12:00:00.000Z')
		});

		const { POST } = await import('./reports/+server');
		const response = await POST({
			locals: { user: { id: 'user-1' } },
			params: { artworkId: 'artwork-1' },
			request: new Request('http://localhost/api/artworks/artwork-1/reports', {
				body: JSON.stringify({ details: 'Spam repost', reason: 'spam' }),
				headers: { 'content-type': 'application/json' },
				method: 'POST'
			})
		} as never);

		expect(response.status).toBe(201);
		expect(mocked.submitContentReport).toHaveBeenCalledWith(
			{ artworkId: 'artwork-1', details: 'Spam repost', reason: 'spam' },
			{ ipAddress: '127.0.0.1', user: { id: 'user-1' } }
		);
		expect(await response.json()).toMatchObject({ report: { id: 'report-1', reason: 'spam' } });
	});

	it('returns artwork flow errors for unauthenticated report attempts', async () => {
		mocked.submitContentReport.mockRejectedValue(
			new ArtworkFlowError(401, 'Authentication required', 'UNAUTHENTICATED')
		);

		const { POST } = await import('./reports/+server');
		const response = await POST({
			locals: {},
			params: { artworkId: 'artwork-1' },
			request: new Request('http://localhost/api/artworks/artwork-1/reports', {
				body: JSON.stringify({ reason: 'spam' }),
				headers: { 'content-type': 'application/json' },
				method: 'POST'
			})
		} as never);

		expect(response.status).toBe(401);
		expect(await response.json()).toMatchObject({ code: 'UNAUTHENTICATED' });
	});
});
