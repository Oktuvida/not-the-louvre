import { env, waitUntil } from 'cloudflare:workers';
import type { Renderer } from '#lib/server/render/renderer.js';

/*
 * The one module that reaches into the Cloudflare runtime. adapter-cloudflare 8
 * replaced `event.platform` with the `cloudflare:workers` module, which wrangler's
 * platform proxy emulates under `vite dev` and `vite preview`. Everything here
 * degrades to "not on Workers" instead of throwing, so Node (tests, scripts) and
 * prerendering keep working, and tests replace this module instead of building
 * fake platforms.
 */

/** The slice of an R2 bucket the app uses. */
export type AppBucket = {
	delete(keys: string | string[]): Promise<void>;
	get(key: string): Promise<{
		body: ReadableStream;
		httpMetadata?: { contentType?: string };
		size: number;
	} | null>;
	head(key: string): Promise<unknown>;
	list(options?: {
		cursor?: string;
	}): Promise<{ cursor?: string; objects: { key: string }[]; truncated: boolean }>;
	put(
		key: string,
		value: ArrayBuffer,
		options?: { httpMetadata?: { contentType?: string } }
	): Promise<unknown>;
};

/** The slice of a Durable Object namespace the app uses. */
export type TopicNamespace = {
	get(id: unknown): {
		// A WebSocket upgrade answers with the socket alongside the 101.
		fetch(input: Request | string, init?: RequestInit): Promise<Response & { webSocket?: unknown }>;
	};
	idFromName(name: string): unknown;
};

type Bindings = {
	ARTWORK_TOPICS?: TopicNamespace;
	BUCKET?: AppBucket;
	HYPERDRIVE?: { connectionString: string };
	RENDERER?: Renderer;
};

/** The Hyperdrive binding's connection string, or undefined off Workers. */
export const hyperdriveConnectionString = (): string | undefined => {
	try {
		return (env as Bindings).HYPERDRIVE?.connectionString;
	} catch {
		// The emulated module throws where there is no platform proxy at all.
		return undefined;
	}
};

/** The R2 bucket holding artwork and avatar images, or undefined off Workers. */
export const appBucket = (): AppBucket | undefined => {
	try {
		return (env as Bindings).BUCKET;
	} catch {
		return undefined;
	}
};

/** The realtime Worker's per-artwork Durable Objects, or undefined off Workers. */
export const artworkTopics = (): TopicNamespace | undefined => {
	try {
		return (env as Bindings).ARTWORK_TOPICS;
	} catch {
		return undefined;
	}
};

/** The renderer Worker, reached over RPC, or undefined off Workers. */
export const boundRenderer = (): Renderer | undefined => {
	try {
		return (env as Bindings).RENDERER;
	} catch {
		return undefined;
	}
};

/** The colo's Cache API, or undefined where there is none (Node). */
export const edgeCache = (): Cache | undefined =>
	typeof caches === 'undefined' ? undefined : (caches as unknown as { default?: Cache }).default;

/** Keeps `promise` running after the response has been sent. */
export const runAfterResponse = (promise: Promise<unknown>) => {
	waitUntil(promise);
};
