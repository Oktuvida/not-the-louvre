import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
	dev: true,
	playwright: ''
}));

vi.mock('$app/environment', () => ({
	get dev() {
		return mocked.dev;
	}
}));

vi.mock('$env/dynamic/private', () => ({
	env: {
		get PLAYWRIGHT() {
			return mocked.playwright;
		}
	}
}));

describe('stroke json demo page', () => {
	beforeEach(() => {
		vi.resetModules();
		mocked.dev = true;
		mocked.playwright = '';
	});

	it('loads in development', async () => {
		const { load } = await import('./+page.server');

		await expect(
			load({ url: new URL('http://localhost/demo/stroke-json') } as never)
		).resolves.toEqual({});
	});

	it('returns 404 outside development', async () => {
		mocked.dev = false;

		const { load } = await import('./+page.server');

		await expect(
			load({ url: new URL('http://localhost/demo/stroke-json') } as never)
		).rejects.toMatchObject({
			body: {
				message: 'Not found'
			},
			status: 404
		});
	});

	it('loads during playwright preview runs outside development', async () => {
		mocked.dev = false;
		mocked.playwright = '1';

		const { load } = await import('./+page.server');

		await expect(
			load({ url: new URL('http://localhost/demo/stroke-json') } as never)
		).resolves.toEqual({});
	});
});
