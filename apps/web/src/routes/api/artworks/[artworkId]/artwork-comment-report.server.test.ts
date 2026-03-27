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

describe('artwork comment report endpoint', () => {
	beforeEach(() => {
		mocked.getIp.mockClear();
		mocked.submitContentReport.mockReset();
	});

	it('creates comment reports for authenticated users', async () => {
		mocked.submitContentReport.mockResolvedValue({
			artworkId: null,
			commentId: 'comment-1',
			createdAt: new Date('2026-03-26T12:00:00.000Z'),
			details: 'Harassing comment',
			id: 'report-1',
			reason: 'harassment',
			reporterId: 'user-1',
			updatedAt: new Date('2026-03-26T12:00:00.000Z')
		});

		const { POST } = await import('./comments/[commentId]/reports/+server');
		const response = await POST({
			locals: { user: { id: 'user-1' } },
			params: { artworkId: 'artwork-1', commentId: 'comment-1' },
			request: new Request('http://localhost/api/artworks/artwork-1/comments/comment-1/reports', {
				body: JSON.stringify({ details: 'Harassing comment', reason: 'harassment' }),
				headers: { 'content-type': 'application/json' },
				method: 'POST'
			})
		} as never);

		expect(response.status).toBe(201);
		expect(mocked.submitContentReport).toHaveBeenCalledWith(
			{ commentId: 'comment-1', details: 'Harassing comment', reason: 'harassment' },
			{ ipAddress: '127.0.0.1', user: { id: 'user-1' } }
		);
		expect(await response.json()).toMatchObject({ report: { commentId: 'comment-1' } });
	});

	it('returns artwork flow errors for invalid comment report requests', async () => {
		mocked.submitContentReport.mockRejectedValue(
			new ArtworkFlowError(
				400,
				'Report must target exactly one artwork or comment',
				'INVALID_REPORT_TARGET'
			)
		);

		const { POST } = await import('./comments/[commentId]/reports/+server');
		const response = await POST({
			locals: { user: { id: 'user-1' } },
			params: { artworkId: 'artwork-1', commentId: 'comment-1' },
			request: new Request('http://localhost/api/artworks/artwork-1/comments/comment-1/reports', {
				body: JSON.stringify({ reason: 'other' }),
				headers: { 'content-type': 'application/json' },
				method: 'POST'
			})
		} as never);

		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({ code: 'INVALID_REPORT_TARGET' });
	});
});
