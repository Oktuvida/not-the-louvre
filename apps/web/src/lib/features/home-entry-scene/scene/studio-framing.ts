/*
 * The camera is orthographic, and its zoom counts screen pixels per scene unit,
 * so a fixed zoom draws the room at one size in pixels: cropped on a laptop,
 * small on a large monitor. Every pose was composed on a 1920×1080 screen,
 * where the room at rest just fits; any other screen gets the same framing,
 * scaled by whichever side runs out first.
 */
const COMPOSED_FOR = { height: 1080, width: 1920 };

/** How much to scale the camera's zoom on a screen of this size. */
export const studioZoomScale = (width: number, height: number) =>
	width > 0 && height > 0 ? Math.min(width / COMPOSED_FOR.width, height / COMPOSED_FOR.height) : 1;
