import { describe, expect, it } from 'vitest';
import { sanitizeAvatarMedia } from './sanitization';
import {
	createJpegTestFile,
	createMalformedPngFile,
	createPngTestFile,
	fileToBytes
} from './test-helpers';

describe('sanitizeAvatarMedia', () => {
	it('accepts canonical PNG uploads and re-encodes them as AVIF', async () => {
		const input = await createPngTestFile({ height: 256, name: 'avatar.png', width: 256 });

		const result = await sanitizeAvatarMedia(input);

		expect(result.contentType).toBe('image/avif');
		expect(result.file.type).toBe('image/avif');
		expect(result.file.name).toBe('avatar.avif');
		expect(result.width).toBe(256);
		expect(result.height).toBe(256);
		expect(await fileToBytes(result.file)).not.toEqual(await fileToBytes(input));
	});

	it('rejects non-PNG avatar uploads before sanitization', async () => {
		const input = await createJpegTestFile({ height: 256, name: 'avatar.jpg', width: 256 });

		await expect(sanitizeAvatarMedia(input)).rejects.toMatchObject({
			code: 'INVALID_MEDIA_FORMAT',
			message: 'Avatar media must be PNG',
			status: 400
		});
	});

	it('rejects PNG uploads with invalid magic bytes payloads', async () => {
		await expect(sanitizeAvatarMedia(createMalformedPngFile())).rejects.toMatchObject({
			code: 'INVALID_MEDIA_CONTENT',
			message: 'Avatar media must decode as a single still PNG image',
			status: 400
		});
	});
});
