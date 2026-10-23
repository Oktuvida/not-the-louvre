import { env, waitUntil } from 'cloudflare:workers';

/*
 * The one module that reaches into the Cloudflare runtime. adapter-cloudflare 8
 * replaced `event.platform` with the `cloudflare:workers` module, which wrangler's
 * platform proxy emulates under `vite dev` and `vite preview`. Everything here
 * degrades to "not on Workers" instead of throwing, so Node (tests, scripts) and
 * prerendering keep working, and tests replace this module instead of building
 * fake platforms.
 */

type Bindings = { HYPERDRIVE?: { connectionString: string } };

/** The Hyperdrive binding's connection string, or undefined off Workers. */
export const hyperdriveConnectionString = (): string | undefined => {
	try {
		return (env as Bindings).HYPERDRIVE?.connectionString;
	} catch {
		// The emulated module throws where there is no platform proxy at all.
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
