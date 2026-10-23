import { AsyncLocalStorage } from 'node:async_hooks';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

type Database = NodePgDatabase<typeof schema>;

const resolveDatabaseUrl = (connectionString?: string) => {
	const databaseUrl = connectionString || env.DATABASE_URL;

	// Validated here rather than at module load so importing this module stays
	// side-effect-free (SvelteKit's postbuild `analyse` step imports server
	// modules without runtime env present).
	if (!databaseUrl) throw new Error('DATABASE_URL is not set');

	return databaseUrl;
};

// node-postgres is the driver Cloudflare supports for Drizzle over Hyperdrive.
// Workers forbid reusing a socket across requests, so each request gets its own
// client; Hyperdrive pools behind it and cleans the connection up when the
// request ends, so it is never closed by hand. Node keeps one process-wide pool.
const requestScopedDatabase = new AsyncLocalStorage<Database>();

const runningInCloudflareWorkers =
	typeof caches !== 'undefined' &&
	(caches as unknown as { default?: unknown }).default !== undefined;

let processDatabase: Database | undefined;

const resolveDatabase = (): Database => {
	const scoped = requestScopedDatabase.getStore();
	if (scoped) return scoped;

	processDatabase ??= drizzle(
		new pg.Pool({ connectionString: resolveDatabaseUrl(), connectionTimeoutMillis: 10_000 }),
		{ schema }
	);
	return processDatabase;
};

export const runWithRequestDbConnection = async <T>(
	fn: () => Promise<T>,
	options: { connectionString?: string } = {}
): Promise<T> => {
	if (!runningInCloudflareWorkers) return fn();

	const client = new pg.Client({
		connectionString: resolveDatabaseUrl(options.connectionString),
		connectionTimeoutMillis: 10_000
	});
	await client.connect();

	return requestScopedDatabase.run(drizzle(client, { schema }), fn);
};

const createConnectionBoundProxy = <T extends object>(resolveTarget: () => T): T =>
	new Proxy(function () {} as unknown as T, {
		apply: (_target, _thisArg, args) =>
			Reflect.apply(
				resolveTarget() as unknown as (...callArgs: unknown[]) => unknown,
				undefined,
				args
			),
		get: (_target, property) => {
			const target = resolveTarget();
			const value = Reflect.get(target, property, target);

			return typeof value === 'function' ? value.bind(target) : value;
		},
		has: (_target, property) => property in resolveTarget()
	});

export const db = createConnectionBoundProxy(resolveDatabase);
