/*
 * How a replay fits in a video. A short drawing plays at the pace it was drawn
 * and a long one is sped up to half a minute, which is as long as anyone
 * watches, and either way the video rests on the finished piece at the end.
 */

export const VIDEO_FPS = 30;
/** A square post: sharper than the 768 px image, since the strokes are redrawn. */
export const VIDEO_SIDE = 1080;

const LONGEST_DRAWING_MS = 30_000;
const REST_FRAMES = 2 * VIDEO_FPS;

export const planVideo = (duration: number) => {
	const seconds = Math.min(duration, LONGEST_DRAWING_MS) / 1000;
	const drawingFrames = Math.max(1, Math.round(seconds * VIDEO_FPS));
	const lastDrawingFrame = drawingFrames - 1;

	return {
		frames: drawingFrames + REST_FRAMES,
		/** The moment of the replay a frame of the video shows. */
		momentOf: (frame: number) =>
			frame >= lastDrawingFrame ? duration : (frame / lastDrawingFrame) * duration
	};
};
