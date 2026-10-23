import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
	clients: [] as {
		connect: ReturnType<typeof vi.fn>;
		end: ReturnType<typeof vi.fn>;
		options: unknown;
	}[],
	pools: [] as { options: unknown }[],
	drizzle: vi.fn((client: unknown) => ({ client }))
}));

vi.mock('pg', () => ({
	default: {
		Client: class {
			connect = vi.fn(async () => undefined);
			end = vi.fn(async () => undefined);
			constructor(readonly options: unknown) {
				mocked.clients.push(this);
			}
		},
		Pool: class {
			constructor(readonly options: unknown) {
				mocked.pools.push(this);
			}
		}
	}
}));

vi.mock('drizzle-orm/node-postgres', () => ({
	drizzle: mocked.drizzle
}));

vi.mock('$env/dynamic/private', () => ({
	env: { DATABASE_URL: 'postgres://user:pass@localhost:5432/db' }
}));

const HYPERDRIVE = 'postgres://user:pass@hyperdrive.local:5432/db';

describe('database connection', () => {
	beforeEach(() => {
		vi.resetModules();
		mocked.clients.length = 0;
		mocked.pools.length = 0;
		mocked.drizzle.mockClear();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	describe('on Cloudflare Workers', () => {
		// The module recognises the runtime by `caches.default` at import time.
		beforeEach(() => vi.stubGlobal('caches', { default: {} }));

		it('gives each request its own connected client on the Hyperdrive connection', async () => {
			const { db, runWithRequestDbConnection } = await import('./index');

			const seen = await runWithRequestDbConnection(
				async () => (db as unknown as { client: unknown }).client,
				{ connectionString: HYPERDRIVE }
			);
			await runWithRequestDbConnection(async () => undefined, { connectionString: HYPERDRIVE });

			expect(mocked.clients).toHaveLength(2);
			expect(mocked.clients[0]?.options).toMatchObject({ connectionString: HYPERDRIVE });
			expect(mocked.clients[0]?.connect).toHaveBeenCalledOnce();
			expect(seen).toBe(mocked.clients[0]);
			expect(mocked.pools).toHaveLength(0);
		});

		// Hyperdrive cleans up when the request ends, and ending postgres
		// connections by hand on workerd left unhandled rejections behind.
		it('never ends the client by hand, even when the work throws', async () => {
			const { runWithRequestDbConnection } = await import('./index');

			await runWithRequestDbConnection(async () => 'done', { connectionString: HYPERDRIVE });
			await expect(
				runWithRequestDbConnection(
					async () => {
						throw new Error('query failed');
					},
					{ connectionString: HYPERDRIVE }
				)
			).rejects.toThrow('query failed');

			for (const client of mocked.clients) expect(client.end).not.toHaveBeenCalled();
		});
	});

	describe('on Node', () => {
		it('runs every request on one process-wide pool from DATABASE_URL', async () => {
			const { db, runWithRequestDbConnection } = await import('./index');

			await runWithRequestDbConnection(async () => (db as unknown as { client: unknown }).client);
			await runWithRequestDbConnection(async () => (db as unknown as { client: unknown }).client);

			expect(mocked.clients).toHaveLength(0);
			expect(mocked.pools).toHaveLength(1);
			expect(mocked.pools[0]?.options).toMatchObject({
				connectionString: 'postgres://user:pass@localhost:5432/db'
			});
		});
	});
});
