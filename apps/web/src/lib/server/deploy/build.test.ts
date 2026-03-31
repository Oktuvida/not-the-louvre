import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ensureBuildOutput } from './build';

describe('ensureBuildOutput', () => {
	it('returns the adapter-node entrypoint when build artifacts exist', async () => {
		const buildDir = join(tmpdir(), `ntl-build-${crypto.randomUUID()}`);
		await mkdir(buildDir, { recursive: true });
		await writeFile(join(buildDir, 'index.js'), 'console.log("ok")');
		await writeFile(join(buildDir, 'handler.js'), 'export const handler = () => {}');

		await expect(ensureBuildOutput(buildDir)).resolves.toBe(join(buildDir, 'index.js'));
	});

	it('throws when the build directory is missing the node entrypoint', async () => {
		const buildDir = join(tmpdir(), `ntl-build-${crypto.randomUUID()}`);
		await mkdir(buildDir, { recursive: true });
		await writeFile(join(buildDir, 'handler.js'), 'export const handler = () => {}');

		await expect(ensureBuildOutput(buildDir)).rejects.toThrow(
			'Expected adapter-node build output at'
		);
	});
});
