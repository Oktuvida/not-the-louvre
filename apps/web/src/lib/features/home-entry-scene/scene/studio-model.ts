/*
 * The studio, as `scripts/transform-studio-model.ts` builds it. Imported as a
 * URL, so Vite names the file after its bytes: it is cached for good, and a
 * new model always arrives under a new name.
 */
import studioModelUrl from '#lib/assets/studio-model/studio.glb?url';

export const STUDIO_MODEL_URL = studioModelUrl;
