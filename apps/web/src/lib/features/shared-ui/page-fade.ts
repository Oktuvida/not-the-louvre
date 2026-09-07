/**
 * One duration for every page-to-page fade.
 *
 * It lives in a module rather than in `PageFadeOverlay.svelte`'s `<script
 * module>` because the home page's camera choreography has to know how long the
 * veil takes — and because `tsc` reads `.svelte` files through the ambient
 * `*.svelte` declaration, which carries a default export and nothing else, so a
 * spec importing the constant from the component would not type-check.
 */
export const PAGE_FADE_DURATION_MS = 400;
