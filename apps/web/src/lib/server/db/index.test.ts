import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
	end: vi.fn(async () => undefined),
	drizzle: vi.fn(() => ({}))
}));

vi.mock('postgres', () => ({
	default: () => ({ end: mocked.end })
}));

vi.mock('drizzle-orm/postgres-js', () => ({
	drizzle: mocked.drizzle
}));

vi.mock('$env/dynamic/private', () => ({
	env: { DATABASE_URL: 'postgres://user:pass@localhost:5432/db' }
}));

describe('request-scoped database connection', () => {
	beforeEach(() => {
		vi.resetModules();
		mocked.end.mockClear();
		mocked.drizzle.mockClear();
		// The module decides at import time whether it is running on Workers,
		// and it recognises the runtime by `caches.default`.
		vi.stubGlobal('caches', { default: {} });
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('hands the connection drain to waitUntil so it outlives the response', async () => {
		const waitUntil = vi.fn();
		const { runWithRequestDbConnection } = await import('./index');

		await runWithRequestDbConnection(async () => 'done', { context: { waitUntil } });

		expect(mocked.end).toHaveBeenCalledWith({ timeout: 5 });
		expect(waitUntil).toHaveBeenCalledOnce();
		await expect(waitUntil.mock.calls[0]![0]).resolves.toBeUndefined();
	});

	it('still closes the connection when the platform exposes no execution context', async () => {
		const { runWithRequestDbConnection } = await import('./index');

		await expect(runWithRequestDbConnection(async () => 'done')).resolves.toBe('done');
		expect(mocked.end).toHaveBeenCalledOnce();
	});

	it('registers the drain even when the wrapped work throws', async () => {
		const waitUntil = vi.fn();
		const { runWithRequestDbConnection } = await import('./index');

		await expect(
			runWithRequestDbConnection(
				async () => {
					throw new Error('query failed');
				},
				{ context: { waitUntil } }
			)
		).rejects.toThrow('query failed');

		expect(waitUntil).toHaveBeenCalledOnce();
	});

	it('swallows a failing drain instead of surfacing an unhandled rejection', async () => {
		mocked.end.mockRejectedValueOnce(new Error('socket already gone'));

		const waitUntil = vi.fn();
		const { runWithRequestDbConnection } = await import('./index');

		await runWithRequestDbConnection(async () => 'done', { context: { waitUntil } });

		await expect(waitUntil.mock.calls[0]![0]).resolves.toBeUndefined();
	});
});
