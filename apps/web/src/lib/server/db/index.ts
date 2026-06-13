import { AsyncLocalStorage } from 'node:async_hooks';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

type DbConnection = {
	client: ReturnType<typeof postgres>;
	db: PostgresJsDatabase<typeof schema>;
};

const createDbConnection = (): DbConnection => {
	const client = postgres(env.DATABASE_URL);

	return { client, db: drizzle(client, { schema }) };
};

// Cloudflare Workers forbid using a TCP socket opened during one request from
// another request, so a module-level connection pool breaks there. Each
// request runs inside this storage with its own connection (see
// hooks.server.ts), while Node keeps the usual process-wide pool.
const requestScopedConnection = new AsyncLocalStorage<DbConnection>();

const runningInCloudflareWorkers =
	typeof caches !== 'undefined' &&
	(caches as unknown as { default?: unknown }).default !== undefined;

let processConnection: DbConnection | undefined;

const resolveConnection = (): DbConnection => {
	const scoped = requestScopedConnection.getStore();

	if (scoped) {
		return scoped;
	}

	processConnection ??= createDbConnection();

	return processConnection;
};

export const runWithRequestDbConnection = async <T>(fn: () => Promise<T>): Promise<T> => {
	if (!runningInCloudflareWorkers) {
		return fn();
	}

	const connection = createDbConnection();

	try {
		return await requestScopedConnection.run(connection, fn);
	} finally {
		// Waits for in-flight queries before closing the request's connection.
		void connection.client.end({ timeout: 5 }).catch(() => undefined);
	}
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

export const dbClient = createConnectionBoundProxy(() => resolveConnection().client);

export const db = createConnectionBoundProxy(() => resolveConnection().db);
