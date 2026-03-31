import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('client text filter', () => {
	beforeEach(() => {
		vi.unstubAllGlobals();
	});

	afterEach(() => {
		vi.resetModules();
	});

	it('keeps the baseline profanity matcher active when policy fetch fails', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response(null, { status: 500 }))
		);

		const { checkTextContent } = await import('./text-filter');

		await expect(checkTextContent('mierda', 'nickname')).resolves.toMatchObject({
			status: 'blocked'
		});
	});

	it('does not let policy allowlists disable the baseline profanity matcher', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							policies: {
								artwork_title: { allowlist: [], blocklist: [] },
								comment: { allowlist: ['classic nude study'], blocklist: ['nude'] },
								nickname: { allowlist: ['mierda'], blocklist: [] }
							}
						}),
						{ status: 200 }
					)
			)
		);

		const { checkTextContent } = await import('./text-filter');

		await expect(checkTextContent('classic nude study', 'comment')).resolves.toMatchObject({
			status: 'allowed'
		});
		await expect(checkTextContent('mierda', 'nickname')).resolves.toMatchObject({
			status: 'blocked'
		});
	});
});
