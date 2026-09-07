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

	it('pins every property the guestbook SEND sticker could move on', async () => {
		const source = await readFile(componentPath, 'utf8');

		// The sticker expresses its motion as three separate properties, and the
		// global press feedback is the standalone `scale`, so `transform: none`
		// alone cancels none of it. Inside the mirrored back face any movement
		// shifts the button between pointerdown and pointerup and the click dies.
		const sendOverride = source.slice(
			source.indexOf('.postcard :global(.sticker-btn.guestbook-send)'),
			source.indexOf('.postcard-actions :global(.sticker-btn.vote-cast)')
		);

		expect(sendOverride).toContain('transform: none !important;');
		expect(sendOverride).toContain('rotate: var(--sticker-rotate, 0deg);');
		expect(sendOverride).toContain('scale: 1;');
	});
});
