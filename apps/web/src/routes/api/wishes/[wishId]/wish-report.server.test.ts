import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ArtworkFlowError } from '#lib/server/artwork/errors.js';

const mocked = vi.hoisted(() => ({
	moderateWish: vi.fn(),
	submitContentReport: vi.fn()
}));

vi.mock('#lib/server/artwork/service.js', () => ({
	moderateWish: mocked.moderateWish,
	submitContentReport: mocked.submitContentReport
}));

vi.mock('better-auth/api', () => ({ getIP: () => '203.0.113.7' }));
vi.mock('#lib/server/auth.js', () => ({ auth: { options: {} } }));

const user = { id: 'artist-1' };

const event = (body?: unknown) =>
	({
		locals: { user },
		params: { wishId: 'wish-1' },
		request: new Request('http://localhost/api/wishes/wish-1', {
			body: body === undefined ? undefined : JSON.stringify(body),
			method: 'POST'
		})
	}) as never;

describe('a slip report', () => {
	beforeEach(() => {
		mocked.submitContentReport.mockReset();
	});

	it('is filed against the slip', async () => {
		mocked.submitContentReport.mockResolvedValue({ id: 'report-1' });
		const { POST } = await import('./reports/+server');

		const response = await POST(event({ reason: 'hate' }));

		expect(response.status).toBe(201);
		expect(mocked.submitContentReport).toHaveBeenCalledWith(
			{ details: undefined, reason: 'hate', wishId: 'wish-1' },
			{ ipAddress: '203.0.113.7', user }
		);
	});

	it('says when the artist has already reported it', async () => {
		mocked.submitContentReport.mockRejectedValue(
			new ArtworkFlowError(409, 'An active report already exists', 'DUPLICATE_REPORT')
		);
		const { POST } = await import('./reports/+server');

		const response = await POST(event({ reason: 'hate' }));

		expect(response.status).toBe(409);
		expect(await response.json()).toMatchObject({ code: 'DUPLICATE_REPORT' });
	});
});

describe('moderating a slip', () => {
	beforeEach(() => {
		mocked.moderateWish.mockReset();
	});

	it('applies the action the moderator chose', async () => {
		const { PATCH } = await import('./moderation/+server');

		const response = await PATCH(event({ action: 'unhide' }));

		expect(response.status).toBe(204);
		expect(mocked.moderateWish).toHaveBeenCalledWith(
			{ action: 'unhide', wishId: 'wish-1' },
			{ user }
		);
	});

	it('deletes it', async () => {
		const { DELETE } = await import('./moderation/+server');

		await DELETE(event());

		expect(mocked.moderateWish).toHaveBeenCalledWith(
			{ action: 'delete', wishId: 'wish-1' },
			{ user }
		);
	});
});
