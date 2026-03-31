import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ArtworkFlowError } from '$lib/server/artwork/errors';

const mocked = vi.hoisted(() => ({
	getTextModerationSnapshot: vi.fn()
}));

vi.mock('$lib/server/moderation/service', () => ({
	getTextModerationSnapshot: mocked.getTextModerationSnapshot
}));

describe('GET /api/moderation/text-policy', () => {
	beforeEach(() => {
		mocked.getTextModerationSnapshot.mockReset();
	});

	it('returns the public moderation policy snapshot', async () => {
		mocked.getTextModerationSnapshot.mockResolvedValue({
			policies: {
				artwork_title: { allowlist: [], blocklist: ['mierda'], version: 3 },
				comment: { allowlist: ['classic nude study'], blocklist: ['nude'], version: 2 },
				nickname: { allowlist: [], blocklist: ['cabron'], version: 1 }
			}
		});

		const { GET } = await import('./+server');
		const response = await GET({ locals: {} } as never);

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			policies: {
				artwork_title: { blocklist: ['mierda'] },
				nickname: { blocklist: ['cabron'] }
			}
		});
	});

	it('maps service failures to error payloads', async () => {
		mocked.getTextModerationSnapshot.mockRejectedValue(
			new ArtworkFlowError(500, 'Snapshot failed', 'PUBLISH_FAILED')
		);

		const { GET } = await import('./+server');
		const response = await GET({ locals: {} } as never);

		expect(response.status).toBe(500);
		expect(await response.json()).toMatchObject({ code: 'PUBLISH_FAILED' });
	});
});
