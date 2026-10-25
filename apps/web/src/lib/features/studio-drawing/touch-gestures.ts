/*
 * Fingers on the studio canvas, following Procreate's conventions: a quick
 * two-finger tap takes back the last line and a three-finger tap puts it back.
 * Every finger that lands is tracked from the first down to the last up; the
 * gesture counts as a tap only if it was short and nothing travelled.
 */

/** A second finger this soon after the first means a gesture, not a line. */
export const SECOND_FINGER_WINDOW_MS = 250;

const TAP_MAX_MS = 300;
const TAP_MAX_TRAVEL_PX = 12;

export type TouchGesture = 'redo' | 'undo';

export type TouchGestureTracker = {
	/** Returns how many fingers are down now. */
	down(id: number, x: number, y: number, time: number): number;
	move(id: number, x: number, y: number): void;
	/** Returns the gesture the fingers made, once the last one lifts. */
	up(id: number, time: number): TouchGesture | null;
	/** A finger the browser took over (a system gesture): the gesture is off. */
	cancel(id: number): void;
};

export const createTouchGestureTracker = (): TouchGestureTracker => {
	const fingers = new Map<number, { x: number; y: number }>();
	let gesture: { fingers: number; moved: boolean; startedAt: number } | null = null;

	return {
		down(id, x, y, time) {
			fingers.set(id, { x, y });
			gesture ??= { fingers: 0, moved: false, startedAt: time };
			gesture.fingers = Math.max(gesture.fingers, fingers.size);
			return fingers.size;
		},
		move(id, x, y) {
			const start = fingers.get(id);
			if (!start || !gesture) return;
			if (Math.hypot(x - start.x, y - start.y) > TAP_MAX_TRAVEL_PX) gesture.moved = true;
		},
		up(id, time) {
			if (!fingers.delete(id) || fingers.size > 0 || !gesture) return null;

			const { fingers: count, moved, startedAt } = gesture;
			gesture = null;
			if (moved || time - startedAt > TAP_MAX_MS) return null;
			return count === 2 ? 'undo' : count === 3 ? 'redo' : null;
		},
		cancel(id) {
			fingers.delete(id);
			if (gesture) gesture.moved = true;
			if (fingers.size === 0) gesture = null;
		}
	};
};
