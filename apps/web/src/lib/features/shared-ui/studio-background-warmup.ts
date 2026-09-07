/*
 * One-shot idle warm-up for the 109KB /draw table background.
 *
 * It used to run from the root layout's onMount, so every visitor paid for it
 * on /gallery, /admin and /demo — routes that may never reach the studio —
 * while the artwork actually on screen was still arriving. It now belongs to
 * the surfaces that lead to /draw: the home page warms it at idle, and the
 * gallery's "Create Art" control warms it on hover/focus. The guard is module
 * level so the two call sites can never fetch it twice, and /draw itself keeps
 * its own `<link rel="preload" fetchpriority="high">`.
 */

const STUDIO_BACKGROUND_URL = '/table.avif';

const STUDIO_BACKGROUND_WARMUP_DELAY_MS = 1200;

let studioBackgroundWarmupStarted = false;

export const warmStudioBackground = () => {
	if (studioBackgroundWarmupStarted || typeof window === 'undefined') {
		return;
	}

	studioBackgroundWarmupStarted = true;
	const image = new Image();
	image.decoding = 'async';
	image.src = STUDIO_BACKGROUND_URL;
};

/**
 * Warms the background once the page goes idle. Returns a teardown that
 * cancels the pending callback, so a visitor who navigates away first never
 * spends the bandwidth.
 */
export const scheduleStudioBackgroundWarmup = () => {
	if (typeof window === 'undefined') {
		return () => {};
	}

	if ('requestIdleCallback' in window) {
		const idleHandle = window.requestIdleCallback(() => {
			warmStudioBackground();
		});

		return () => {
			if ('cancelIdleCallback' in window) {
				window.cancelIdleCallback(idleHandle);
			}
		};
	}

	const timeoutHandle = setTimeout(warmStudioBackground, STUDIO_BACKGROUND_WARMUP_DELAY_MS);

	return () => {
		clearTimeout(timeoutHandle);
	};
};
