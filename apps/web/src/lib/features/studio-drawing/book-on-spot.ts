import { prefersReducedMotion } from '#lib/features/home-entry-scene/reduced-motion.js';
import { HANDOFF_BOOK_TILT, handoffBookRect } from '#lib/features/shared-ui/studio-handoff.js';

/*
 * The closed sketchbook lies on the hand-off spot (shared-ui/studio-handoff.ts):
 * where the home room's camera leaves the side table's book, on the part of
 * the desk that book was photographed on. Open, it lies where the layout
 * draws it. The book is moved there as a whole, with a transform worked out
 * from where its cover is laid out; the cover sits in the middle of the book,
 * so the book's own centre is the pivot.
 */

/** Same curve as the studio's `--ease-glide`. */
const GLIDE = { duration: 700, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' };

/**
 * Moves `book` so its `cover` lies on the spot. With `glide`, it travels there
 * from wherever it was; without, it is there from the next frame.
 */
export const layBookOnSpot = (book: HTMLElement, cover: HTMLElement, glide: boolean) => {
	const from = getComputedStyle(book).transform;
	for (const animation of book.getAnimations()) animation.cancel();

	// Where the cover is laid out, with no transform in the way.
	book.style.transition = 'none';
	book.style.transform = 'none';
	const laidOut = cover.getBoundingClientRect();
	const spot = handoffBookRect(window.innerWidth, window.innerHeight);
	const onSpot = [
		`translate(${spot.cx - (laidOut.left + laidOut.width / 2)}px, ${
			spot.cy - (laidOut.top + laidOut.height / 2)
		}px)`,
		`rotate(${HANDOFF_BOOK_TILT}deg)`,
		`scale(${spot.width / laidOut.width}, ${spot.height / laidOut.height})`
	].join(' ');
	book.style.transform = onSpot;

	// Settle it before the stylesheet's transition comes back, so that does
	// not run; the glide, when there is one, is its own animation.
	void getComputedStyle(book).transform;
	book.style.transition = '';
	if (glide && !prefersReducedMotion()) {
		book.animate([{ transform: from }, { transform: onSpot }], GLIDE);
	}
};

/** Hands the book back to the layout; the stylesheet's transition carries it. */
export const liftBookOffSpot = (book: HTMLElement) => {
	book.style.transform = '';
};
