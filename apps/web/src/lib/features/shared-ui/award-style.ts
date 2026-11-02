/**
 * The Hall of Fame's two hands for its awards: rubber stamps in coloured ink,
 * or doodles in marker, as if an artist had drawn on the wall.
 */
export type AwardStyle = 'stamps' | 'doodles';

/** Draws the style for one visit to the gallery, each as likely as the other. */
export const drawAwardStyle = (): AwardStyle => (Math.random() < 0.5 ? 'stamps' : 'doodles');
