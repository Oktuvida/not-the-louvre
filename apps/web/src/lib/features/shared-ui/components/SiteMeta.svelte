<script lang="ts">
	import {
		DEFAULT_SHARE_IMAGE,
		SITE_DESCRIPTION,
		SITE_NAME,
		absoluteSiteUrl,
		formatDocumentTitle,
		type RouteShareImage
	} from '../site-meta';

	/*
	 * The whole document head in one place. Rendered exactly once, by the root
	 * layout, so pages never end up with two competing <title> elements — a
	 * route changes the title by contributing `meta` from its `load`.
	 */
	let {
		title = undefined,
		description = undefined,
		image = undefined,
		pathname = undefined
	}: {
		title?: string;
		description?: string;
		/** The route's own preview image (an artwork); the site card otherwise. */
		image?: RouteShareImage;
		pathname?: string;
	} = $props();

	const documentTitle = $derived(formatDocumentTitle(title));
	const shareDescription = $derived(description ?? SITE_DESCRIPTION);
	const shareImage = $derived(image ?? DEFAULT_SHARE_IMAGE);
	const shareImageUrl = $derived(absoluteSiteUrl(shareImage.path));
	const canonicalUrl = $derived(pathname ? absoluteSiteUrl(pathname) : undefined);
</script>

<svelte:head>
	<title>{documentTitle}</title>
	<meta name="description" content={shareDescription} />

	{#if canonicalUrl}
		<link rel="canonical" href={canonicalUrl} />
		<meta property="og:url" content={canonicalUrl} />
	{/if}

	<meta property="og:type" content="website" />
	<meta property="og:site_name" content={SITE_NAME} />
	<meta property="og:title" content={documentTitle} />
	<meta property="og:description" content={shareDescription} />
	<meta property="og:image" content={shareImageUrl} />
	<meta property="og:image:width" content={String(shareImage.width)} />
	<meta property="og:image:height" content={String(shareImage.height)} />
	<meta property="og:image:alt" content={shareImage.alt} />

	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={documentTitle} />
	<meta name="twitter:description" content={shareDescription} />
	<meta name="twitter:image" content={shareImageUrl} />
	<meta name="twitter:image:alt" content={shareImage.alt} />
</svelte:head>
