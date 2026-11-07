/*
 * Where the home page's camera stands, and where the room's model is placed
 * in front of it. The scene moves between these, and the room's pencil
 * sketch (scripts/sketch-studio-room.ts) is drawn from the resting pose, so
 * the drawing lies exactly under the room it stands in for.
 */

/** Every pose but the Studio one sees the room level, and the book as it is. */
export const LEVEL = { roll: 0, shiftY: 0, bookStretch: 1 };

export const DEFAULT_CAMERA = {
	...LEVEL,
	cameraX: 0,
	cameraDepth: 16,
	cameraHeight: 7.8,
	rotationX: -0.22,
	rotationY: 0,
	targetX: 0,
	targetY: 0.8,
	targetZ: 0,
	zoom: 40
};

/** Where every "back to the room" move ends: the default pose, turned 45deg. */
export const RESTING_CAMERA = { ...DEFAULT_CAMERA, rotationY: -Math.PI / 4, zoom: 60 };

/** The model is scaled and lowered into the frame; the poses turn it about its own origin. */
export const STUDIO_MODEL_PLACEMENT = {
	position: [0, -6, 0] as [number, number, number],
	scale: 5.7
};
