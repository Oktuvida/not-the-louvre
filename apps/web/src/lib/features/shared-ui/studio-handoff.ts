/*
 * The hand-off from the home page's 3D studio to the studio page.
 *
 * The Studio button zooms the 3D camera down onto the sketchbook on the side
 * table, and the studio page opens with that sketchbook closed on its desk.
 * For the one to become the other without a jump, both pages place the book
 * in the same spot of the window, worked out here from the window alone:
 *
 * - the 3D camera ends its move with the side table's book on that spot:
 *   turned to the same slant, zoomed to its height, and drawn a little wider
 *   so its cover has the studio cover's shape;
 * - the studio's desk is a render of that same table from that same camera,
 *   with the book left out, laid so the book's place lands on that spot;
 * - the studio's closed book lies on that spot, and glides to where the
 *   layout draws it as it opens.
 *
 * The model's measures come from the end-of-zoom camera at zoom 450 (CSS px
 * per scene unit), the zoom the desk is rendered at too.
 */

/** The studio cover's width over its height, as the studio's layout draws it. */
export const HANDOFF_COVER_ASPECT = 1.013;

/** How far the closed book lies turned on the desk, in degrees (negative: anticlockwise). */
export const HANDOFF_BOOK_TILT = -3;

/** The side table's sketchbook, seen from straight above at the reference zoom (CSS px). */
export const SIDE_TABLE_BOOK = { height: 551.4, width: 485.1 } as const;

/** The camera zoom the book's measures, and the desk's render, are taken at. */
export const HANDOFF_REFERENCE_ZOOM = 450;

/**
 * How much wider the 3D book is drawn by the end of the move, so its cover has
 * the studio cover's shape rather than its own slightly narrower one.
 */
export const SIDE_TABLE_BOOK_STRETCH =
	HANDOFF_COVER_ASPECT / (SIDE_TABLE_BOOK.width / SIDE_TABLE_BOOK.height);

/**
 * The studio's desk: the side table rendered from the end-of-zoom camera at
 * the reference zoom, centred on the book's place, this many CSS px across
 * and down. Wide enough to fill every window that shows the closed book.
 */
export const STUDIO_DESK = { height: 900, width: 1600 } as const;

export type HandoffRect = {
	/** Centre, in CSS px from the window's top left. */
	cx: number;
	cy: number;
	/** The book's own size, before its tilt. */
	width: number;
	height: number;
};

/** Of the window's height, how much the closed book takes, and where its centre sits. */
const BOOK_HEIGHT_SHARE = 0.84;
const BOOK_CENTRE_SHARE = 0.52;
/** Of the window's width, the most the closed book takes (a squarish window). */
const BOOK_WIDTH_SHARE = 0.62;

/** Where the closed sketchbook lies on a window of this size. */
export const handoffBookRect = (width: number, height: number): HandoffRect => {
	const bookHeight = Math.min(
		BOOK_HEIGHT_SHARE * height,
		(BOOK_WIDTH_SHARE * width) / HANDOFF_COVER_ASPECT
	);
	return {
		cx: width / 2,
		cy: BOOK_CENTRE_SHARE * height,
		height: bookHeight,
		width: bookHeight * HANDOFF_COVER_ASPECT
	};
};

/** The 3D camera's zoom (CSS px per scene unit) that makes the side table's book this tall. */
export const handoffZoom = (rect: HandoffRect) =>
	(HANDOFF_REFERENCE_ZOOM * rect.height) / SIDE_TABLE_BOOK.height;

const deskSpan = STUDIO_DESK.width / SIDE_TABLE_BOOK.height;

/*
 * The same spot in CSS, so the studio can lay its desk before any script
 * runs: `handoffBookRect` written with viewport units. Past the shapes of
 * window that show the closed book, the desk only has to cover the window.
 */
export const HANDOFF_CSS_VARIABLES = [
	`--handoff-book-height: min(${BOOK_HEIGHT_SHARE * 100}dvh, ${(
		(BOOK_WIDTH_SHARE * 100) /
		HANDOFF_COVER_ASPECT
	).toFixed(4)}vw)`,
	`--handoff-book-centre-y: ${BOOK_CENTRE_SHARE * 100}dvh`,
	`--studio-desk-span: ${deskSpan.toFixed(5)}`,
	`--studio-desk-cover-width: ${(
		2 *
		Math.max(BOOK_CENTRE_SHARE, 1 - BOOK_CENTRE_SHARE) *
		(STUDIO_DESK.width / STUDIO_DESK.height) *
		100
	).toFixed(3)}dvh`
].join('; ');

/**
 * The desk's `sizes`: how wide it is drawn, in the media-query form the
 * attribute reads (the book is height-bound on a wide window, width-bound on
 * a squarish one).
 */
export const STUDIO_DESK_SIZES = (() => {
	const crossover = BOOK_WIDTH_SHARE / HANDOFF_COVER_ASPECT / BOOK_HEIGHT_SHARE;
	const wide = (deskSpan * BOOK_HEIGHT_SHARE * 100).toFixed(2);
	const squarish = ((deskSpan * BOOK_WIDTH_SHARE * 100) / HANDOFF_COVER_ASPECT).toFixed(2);
	return `(min-aspect-ratio: ${Math.round(crossover * 10000)}/10000) ${wide}vh, ${squarish}vw`;
})();

let bookHandedOver = false;

/** The home room says its camera has laid the side table's book on the spot. */
export const handOverBook = () => {
	bookHandedOver = true;
};

/**
 * The studio asks, once, whether its closed book is taking over from the
 * room's: then it is on the spot from its first frame, rather than gliding
 * there.
 */
export const takeHandedOverBook = () => {
	const handedOver = bookHandedOver;
	bookHandedOver = false;
	return handedOver;
};
