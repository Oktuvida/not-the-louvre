// The slice of the Workers runtime module the app uses (see lib/server/platform.ts).
// adapter-cloudflare emulates it under `vite dev` and `vite preview`.
declare module 'cloudflare:workers' {
	export const env: Record<string, unknown>;
	export function waitUntil(promise: Promise<unknown>): void;
	export abstract class WorkerEntrypoint<Env = unknown> {
		protected ctx: unknown;
		protected env: Env;
		constructor(ctx: unknown, env: Env);
	}
}
