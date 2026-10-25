/**
 * Fails when the web Worker's bundle carries WebAssembly. The image codecs
 * (resvg, libwebp, the AVIF decoder…) belong to the renderer Worker; in the web
 * Worker they would ride along with every gallery request. Run after a build:
 *   bun run build && bun run check:bundle
 */
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const outdir = mkdtempSync(join(tmpdir(), 'ntl-web-bundle-'));

try {
	const dryRun = Bun.spawnSync(
		['bunx', 'wrangler', 'deploy', '--dry-run', '--outdir', outdir, '-c', 'wrangler.jsonc'],
		{ env: { ...process.env, WRANGLER_SEND_METRICS: 'false' }, stderr: 'pipe', stdout: 'pipe' }
	);
	if (dryRun.exitCode !== 0) {
		console.error(dryRun.stderr.toString() || dryRun.stdout.toString());
		process.exit(1);
	}

	const size = /Total Upload: ([^\n]+)/.exec(dryRun.stdout.toString())?.[1] ?? 'unknown size';
	const wasm = readdirSync(outdir).filter((file) => file.endsWith('.wasm'));
	if (wasm.length > 0) {
		console.error(
			`The web Worker bundles WebAssembly it should leave to the renderer:\n  ${wasm.join('\n  ')}`
		);
		process.exit(1);
	}
	console.log(`Web Worker bundle: ${size}, no WebAssembly.`);
} finally {
	rmSync(outdir, { force: true, recursive: true });
}
