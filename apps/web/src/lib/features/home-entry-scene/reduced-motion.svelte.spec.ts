import { afterEach, describe, expect, it, vi } from 'vitest';
import { prefersReducedMotion } from './reduced-motion';

const stubMatchMedia = (matches: boolean) => {
	const matchMedia = vi.fn(
		(media: string) =>
			({
				addEventListener: vi.fn(),
				addListener: vi.fn(),
				dispatchEvent: vi.fn(),
				matches,
				media,
				onchange: null,
				removeEventListener: vi.fn(),
				removeListener: vi.fn()
			}) satisfies MediaQueryList
	);

	vi.stubGlobal('matchMedia', matchMedia);
	return matchMedia;
};

describe('prefersReducedMotion', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('reports the reduce preference', () => {
		const matchMedia = stubMatchMedia(true);

		expect(prefersReducedMotion()).toBe(true);
		expect(matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
	});

	it('reports no preference when the visitor has not asked for reduced motion', () => {
		stubMatchMedia(false);

		expect(prefersReducedMotion()).toBe(false);
	});

	it('re-reads the query on every call so a mid-session change is honoured', () => {
		stubMatchMedia(false);
		expect(prefersReducedMotion()).toBe(false);

		stubMatchMedia(true);
		expect(prefersReducedMotion()).toBe(true);
	});
});
