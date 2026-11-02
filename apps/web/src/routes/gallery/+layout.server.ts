import { drawAwardStyle } from '#lib/features/shared-ui/award-style.js';
import type { LayoutServerLoad } from './$types';

// Each visit to the gallery draws the Hall of Fame's award style once. This
// load runs when a visitor walks into the gallery, not when they move between
// its rooms, and it runs on the server, so the page hydrates with the same draw
// it was rendered with.
export const load: LayoutServerLoad = () => ({ awardStyle: drawAwardStyle() });
