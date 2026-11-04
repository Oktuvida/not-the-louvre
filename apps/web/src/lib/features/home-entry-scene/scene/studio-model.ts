/*
 * The studio, as `scripts/transform-studio-model.ts` builds it. Imported as a
 * URL, so Vite names the file after its bytes: it is cached for good, and a
 * new model always arrives under a new name.
 */
import studioModelUrl from '#lib/assets/studio-model/studio.glb?url';

export const STUDIO_MODEL_URL = studioModelUrl;

/*
 * The same studio drawn in pencil, as `scripts/sketch-studio-room.ts` makes it
 * from the model: the page shows it where the room will stand until the room
 * is up.
 */
import studioSketchUrl from '#lib/assets/studio-model/studio-sketch.svg?url';

export const STUDIO_SKETCH_URL = studioSketchUrl;
