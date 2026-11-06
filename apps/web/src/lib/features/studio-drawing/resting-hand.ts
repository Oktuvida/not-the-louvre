/*
 * The hand that holds the pen rests on the glass while it draws, and on a
 * tablet it lands on whatever lies beside the page: a paint, the eraser, the
 * title, Publish. While a pen is on the canvas, and for a moment after it
 * lifts, a touch anywhere else in the studio is taken for that hand: it
 * presses nothing, focuses nothing and selects nothing. Fingers on the canvas
 * are the canvas's own business (pen mode, the two-finger gestures).
 */

/** How long after the pen lifts a touch still counts as the resting hand. */
export const RESTING_HAND_GRACE_MS = 250;

/** How long a resting-hand touch may take to deliver the click it would have made. */
const PALM_CLICK_WINDOW_MS = 1000;

export const keepTheRestingHandOff = (
	studio: HTMLElement,
	isCanvas: (target: EventTarget | null) => boolean
) => {
	let penOnCanvas: number | null = null;
	let penLiftedAt = Number.NEGATIVE_INFINITY;
	// The touches taken for the hand, until the click each would make has passed.
	const palms = new Map<number, ReturnType<typeof setTimeout>>();

	const handIsResting = (event: Event) =>
		penOnCanvas !== null || event.timeStamp - penLiftedAt < RESTING_HAND_GRACE_MS;

	const forget = (pointerId: number) => {
		clearTimeout(palms.get(pointerId));
		palms.delete(pointerId);
	};

	const handlePointerDown = (event: PointerEvent) => {
		if (event.pointerType === 'pen') {
			if (isCanvas(event.target)) penOnCanvas = event.pointerId;
			return;
		}
		if (event.pointerType !== 'touch' || isCanvas(event.target)) return;

		forget(event.pointerId);
		if (!handIsResting(event)) return;

		// No mouse events follow, so no focus; the click is caught below.
		event.preventDefault();
		event.stopPropagation();
		palms.set(
			event.pointerId,
			setTimeout(() => palms.delete(event.pointerId), PALM_CLICK_WINDOW_MS)
		);
	};

	const handlePenLifted = (event: PointerEvent) => {
		if (event.pointerId !== penOnCanvas) return;
		penOnCanvas = null;
		penLiftedAt = event.timeStamp;
	};

	// A browser that still makes a click of a touch whose pointerdown was
	// prevented (Chromium does) has it swallowed before any button hears it.
	const handleClick = (event: MouseEvent) => {
		const { pointerId } = event as PointerEvent;
		if (pointerId === undefined || !palms.has(pointerId)) return;
		forget(pointerId);
		event.preventDefault();
		event.stopPropagation();
	};

	// On iPad and Android a prevented touchstart is what stops the focus, the
	// click, the magnifier and the text selection all at once.
	const handleTouchStart = (event: TouchEvent) => {
		if (!isCanvas(event.target) && handIsResting(event)) event.preventDefault();
	};

	const blur = () => {
		penOnCanvas = null;
	};

	studio.addEventListener('pointerdown', handlePointerDown, { capture: true });
	studio.addEventListener('click', handleClick, { capture: true });
	studio.addEventListener('touchstart', handleTouchStart, { capture: true, passive: false });
	// The canvas holds on to the pen, so its lifting reaches the window, not the studio.
	window.addEventListener('pointerup', handlePenLifted);
	window.addEventListener('pointercancel', handlePenLifted);
	window.addEventListener('blur', blur);

	return () => {
		studio.removeEventListener('pointerdown', handlePointerDown, { capture: true });
		studio.removeEventListener('click', handleClick, { capture: true });
		studio.removeEventListener('touchstart', handleTouchStart, { capture: true });
		window.removeEventListener('pointerup', handlePenLifted);
		window.removeEventListener('pointercancel', handlePenLifted);
		window.removeEventListener('blur', blur);
		for (const timer of palms.values()) clearTimeout(timer);
		palms.clear();
	};
};
