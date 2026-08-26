import { describe, expect, it } from 'vitest';
import { sanitizeArtworkMedia, sanitizeAvatarMedia } from './sanitization';
import {
	createAvifTestFile,
	createJpegTestFile,
	createMalformedWebpFile,
	createWebpTestFile,
	fileToBytes
} from './test-helpers';

describe('sanitizeArtworkMedia', () => {
	it('produces a tiny blurred-preview data URI alongside the canonical AVIF', async () => {
		const input = await createAvifTestFile({
			height: 768,
			name: 'artwork.avif',
			pattern: 'blocks',
			width: 768
		});

		const result = await sanitizeArtworkMedia(input);

		expect(result.contentType).toBe('image/avif');
		expect(result.placeholder).toMatch(/^data:image\/png;base64,/);
		// The placeholder rides every feed row, so it must stay small.
		expect(result.placeholder!.length).toBeLessThan(4000);
	});
});

describe('sanitizeAvatarMedia', () => {
	it('accepts canonical WebP uploads and re-encodes them as AVIF', async () => {
		const input = await createWebpTestFile({ height: 256, name: 'avatar.webp', width: 256 });

		const result = await sanitizeAvatarMedia(input);

		expect(result.contentType).toBe('image/avif');
		expect(result.file.type).toBe('image/avif');
		expect(result.file.name).toBe('avatar.avif');
		expect(result.width).toBe(256);
		expect(result.height).toBe(256);
		expect(await fileToBytes(result.file)).not.toEqual(await fileToBytes(input));
	});

	it('rejects non-WebP avatar uploads before sanitization', async () => {
		const input = await createJpegTestFile({ height: 256, name: 'avatar.jpg', width: 256 });

		await expect(sanitizeAvatarMedia(input)).rejects.toMatchObject({
			code: 'INVALID_MEDIA_FORMAT',
			message: 'Avatar media must be WebP',
			status: 400
		});
	});

	it('rejects WebP uploads with invalid magic bytes payloads', async () => {
		await expect(sanitizeAvatarMedia(createMalformedWebpFile())).rejects.toMatchObject({
			code: 'INVALID_MEDIA_CONTENT',
			message: 'Avatar media must decode as a single still WebP image',
			status: 400
		});
	});
});
