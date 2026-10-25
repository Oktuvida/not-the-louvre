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
	getTextModerationSnapshot: vi.fn()
}));

vi.mock('#lib/server/moderation/service.js', () => ({
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
		const response = await GET({
			locals: {},
			request: new Request('http://localhost/api/moderation/text-policy')
		} as never);

		expect(response.status).toBe(200);
		expect(response.headers.get('cache-control')).toBe(
			'public, max-age=0, s-maxage=60, stale-while-revalidate=300'
		);
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
		const response = await GET({
			locals: {},
			request: new Request('http://localhost/api/moderation/text-policy')
		} as never);

		expect(response.status).toBe(500);
		expect(await response.json()).toMatchObject({ code: 'PUBLISH_FAILED' });
	});

	it('serves the stored edge copy instead of rebuilding the snapshot', async () => {
		mocked.getTextModerationSnapshot.mockResolvedValue({
			policies: {
				artwork_title: { allowlist: [], blocklist: [], version: 1 },
				comment: { allowlist: [], blocklist: [], version: 1 },
				nickname: { allowlist: [], blocklist: [], version: 1 }
			}
		});

		const stored = new Map<string, Response>();
		const waitUntil = vi.fn(async (promise: Promise<unknown>) => promise);
		const platform = {
			caches: {
				default: {
					match: async (url: string) => stored.get(url),
					put: async (url: string, response: Response) => {
						stored.set(url, response);
					}
				}
			},
			context: { waitUntil }
		};

		const { GET } = await import('./+server');
		const event = () => ({
			locals: {},
			platform: usePlatform(platform),
			request: new Request('http://localhost/api/moderation/text-policy')
		});

		await GET(event() as never);
		await Promise.all(waitUntil.mock.calls.map(([promise]) => promise));
		const hit = await GET(event() as never);

		expect(hit.status).toBe(200);
		expect(mocked.getTextModerationSnapshot).toHaveBeenCalledOnce();
	});
});
