/*
 * The sketchbook's cover, measured once for the two places it is drawn: the
 * CSS cover on the studio desk (studio-drawing/components/DrawingBookStage)
 * and the 3D book on the home's side table that the camera closes in on just
 * before the studio opens (home-entry-scene/scene/studio-surfaces). The zoom
 * hands one over to the other, so both read their cloth, their wear and the
 * elastic from here.
 *
 * Every measure is a share of the cover's width (CSS `cqw`), so the book keeps
 * its proportions on any screen. The wear image is drawn for a square cover,
 * which the desk's always nearly is; the 3D model's is a little narrower for
 * its height, and takes it a little squeezed.
 */
export const SKETCHBOOK_COVER = {
	/** How far the dark cloth of the spine reaches onto the board. */
	spine: 0.115,
	/** Each leg of the dark cloth corners on the open side. */
	corner: 0.13,
	/** One tile of bookcloth spans this much of the cover. */
	tile: 0.34,
	/** The thin elastic that keeps the book shut: its centre from the fore-edge, its width. */
	elastic: { fromEdge: 0.11, width: 0.012 },
	/**
	 * The paper label: its centre across the cover, its foot above the tail
	 * (a share of the cover's height), the turn it was glued on with (CSS
	 * degrees), and the size the desk's label measures out to with its text.
	 */
	label: { centre: 0.52, foot: 0.17, height: 0.141, turn: -1.2, width: 0.394 }
} as const;
