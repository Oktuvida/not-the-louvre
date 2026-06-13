import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const componentPath = join(dirname(fileURLToPath(import.meta.url)), 'ArtworkDetailPanel.svelte');

describe('ArtworkDetailPanel postcard flip styles', () => {
	it('keeps both postcard faces painted while separating and ordering the flipped back face', async () => {
		const source = await readFile(componentPath, 'utf8');

		expect(source).not.toContain('class:is-hidden');
		expect(source).not.toContain('.postcard-face.is-hidden');
		expect(source).toContain('transform: translateZ(0.1px);');
		expect(source).toContain('transform: rotateY(180deg) translateZ(0.1px);');
		expect(source).toContain('.postcard.is-flipped .postcard-back');
	});
});
