const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Reads the preference from `matchMedia` at call time.
 *
 * Deliberately not `prefersReducedMotion` from `svelte/motion`: that is a
 * module-level singleton which caches its MediaQueryList on the first read, so
 * it cannot be re-read after the OS setting changes mid-session and cannot be
 * stubbed per test. Every caller here reads the preference once, at the moment
 * an animation starts, so a plain query is both cheaper and more accurate.
 */
export const prefersReducedMotion = () => {
	if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
		return false;
	}

	return window.matchMedia(REDUCED_MOTION_QUERY).matches;
};
