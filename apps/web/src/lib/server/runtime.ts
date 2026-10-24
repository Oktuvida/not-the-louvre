// workerd identifies itself through its user agent. `caches.default` is no signal:
// adapter-cloudflare's platform proxy installs it under `vite dev`, `vite preview`
// and vitest too, and code that took that for Workers would open a database client
// per request and never close it, or import .wasm files Node cannot load.
export const runningOnWorkers =
	typeof navigator !== 'undefined' && navigator.userAgent === 'Cloudflare-Workers';
