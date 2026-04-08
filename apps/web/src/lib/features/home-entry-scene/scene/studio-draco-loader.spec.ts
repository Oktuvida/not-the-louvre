import { describe, expect, it } from 'vitest';
import { shouldUseJsDracoDecoder } from './studio-draco-loader';

describe('shouldUseJsDracoDecoder', () => {
	it('prefers the JavaScript Draco decoder only for Firefox during development', () => {
		expect(
			shouldUseJsDracoDecoder({
				browser: true,
				dev: true,
				userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:137.0) Gecko/20100101 Firefox/137.0'
			})
		).toBe(true);

		expect(
			shouldUseJsDracoDecoder({
				browser: true,
				dev: true,
				userAgent:
					'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36'
			})
		).toBe(false);

		expect(
			shouldUseJsDracoDecoder({
				browser: true,
				dev: false,
				userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:137.0) Gecko/20100101 Firefox/137.0'
			})
		).toBe(false);
	});
});
