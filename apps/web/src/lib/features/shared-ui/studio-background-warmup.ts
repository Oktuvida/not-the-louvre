import deskAvifLarge from '#lib/assets/studio-desk/desk-3840.avif';
import deskAvifSmall from '#lib/assets/studio-desk/desk-1920.avif';
import deskWebpLarge from '#lib/assets/studio-desk/desk-3840.webp';
import deskWebpSmall from '#lib/assets/studio-desk/desk-1920.webp';
import { STUDIO_DESK_SIZES } from '#lib/features/shared-ui/studio-handoff.js';

/*
 * The studio's desk, and its one-shot warm-up.
 *
 * The desk is the home room's side table photographed from where the Studio
 * move ends (scripts/render-studio-desk.ts), drawn at whichever of two sizes
 * the window needs. The surfaces that lead to /draw warm it: the home page at
 * idle, and the gallery's "Create Art" control on hover/focus. The guard is
 * module level so the two can never fetch it twice, and /draw itself keeps
 * its own `<link rel="preload" fetchpriority="high">`.
 */

export const STUDIO_DESK_IMAGE = {
	avif: `${deskAvifSmall} 1920w, ${deskAvifLarge} 3840w`,
	fallback: deskWebpSmall,
	sizes: STUDIO_DESK_SIZES,
	webp: `${deskWebpSmall} 1920w, ${deskWebpLarge} 3840w`
};

const STUDIO_BACKGROUND_WARMUP_DELAY_MS = 1200;

let studioBackground: Promise<void> | null = null;

/**
 * Fetches and decodes the desk, once. The promise settles when it is ready to
 * paint, or when it could not be: either way the studio can be shown.
 */
export const readyStudioBackground = () => {
	if (typeof window === 'undefined') return Promise.resolve();

	if (!studioBackground) {
		const image = new Image();
		image.decoding = 'async';
		// The same candidates and size as the studio's own <img>, so the browser
		// picks the file the studio will ask for.
		image.sizes = STUDIO_DESK_IMAGE.sizes;
		image.srcset = STUDIO_DESK_IMAGE.avif;
		studioBackground = image.decode().catch(() => {});
	}

	return studioBackground;
};

export const warmStudioBackground = () => {
	void readyStudioBackground();
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
