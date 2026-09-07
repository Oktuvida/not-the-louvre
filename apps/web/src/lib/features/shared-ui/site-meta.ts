/*
 * Shared vocabulary for the document head.
 *
 * Every route used to render the same bare `<title>Not the Louvre</title>` with
 * no Open Graph tags at all, so four open rooms were four identical tabs and
 * every shared link previewed as a naked URL with no image — the one thing a
 * visual-art community cannot get away with.
 *
 * A route contributes its own title/description by returning `meta` from its
 * `load`; the root layout reads `page.data.meta` and hands it to SiteMeta, so
 * there is exactly one `<title>` in the document on both SSR and client
 * navigation.
 */

export type RouteMeta = {
	description?: string;
	title?: string;
};

export const SITE_NAME = 'Not the Louvre';

export const SITE_ORIGIN = 'https://not-the-louvre.art';

export const SITE_DESCRIPTION =
	'A playful studio-world where sketchy masterpieces, strange rankings, and a 3D room all collide.';

/** Committed 1200x630 card; regenerate with scripts/generate-og-cover.ts. */
export const SHARE_IMAGE_PATH = '/og-cover.png';

export const SHARE_IMAGE_ALT = 'Three hand-taped polaroids hanging on the museum wall';

/** `Hall of Fame · Not the Louvre`, or just the site name on the home page. */
export const formatDocumentTitle = (title?: string) =>
	title && title !== SITE_NAME ? `${title} · ${SITE_NAME}` : SITE_NAME;

/** Crawlers do not resolve relative og:image/og:url, so these stay absolute. */
export const absoluteSiteUrl = (path: string) => `${SITE_ORIGIN}${path}`;

const isRouteMeta = (value: unknown): value is RouteMeta =>
	typeof value === 'object' &&
	value !== null &&
	(!('title' in value) ||
		typeof (value as RouteMeta).title === 'string' ||
		(value as RouteMeta).title === undefined) &&
	(!('description' in value) ||
		typeof (value as RouteMeta).description === 'string' ||
		(value as RouteMeta).description === undefined);

/**
 * Reads the `meta` a route's `load` contributed to `page.data`, tolerating
 * routes that contribute none.
 */
export const readRouteMeta = (data: unknown): RouteMeta => {
	if (typeof data !== 'object' || data === null || !('meta' in data)) {
		return {};
	}

	const meta = (data as { meta: unknown }).meta;

	return isRouteMeta(meta) ? meta : {};
};
