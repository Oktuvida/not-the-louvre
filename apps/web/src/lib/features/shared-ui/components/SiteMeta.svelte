<script lang="ts">
	import {
		SHARE_IMAGE_ALT,
		SHARE_IMAGE_PATH,
		SITE_DESCRIPTION,
		SITE_NAME,
		absoluteSiteUrl,
		formatDocumentTitle
	} from '../site-meta';

	/*
	 * The whole document head in one place. Rendered exactly once, by the root
	 * layout, so pages never end up with two competing <title> elements — a
	 * route changes the title by contributing `meta` from its `load`.
	 */
	let {
		title = undefined,
		description = undefined,
		pathname = undefined
	}: {
		title?: string;
		description?: string;
		pathname?: string;
	} = $props();

	const documentTitle = $derived(formatDocumentTitle(title));
	const shareDescription = $derived(description ?? SITE_DESCRIPTION);
	const shareImageUrl = absoluteSiteUrl(SHARE_IMAGE_PATH);
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
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:image:alt" content={SHARE_IMAGE_ALT} />

	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={documentTitle} />
	<meta name="twitter:description" content={shareDescription} />
	<meta name="twitter:image" content={shareImageUrl} />
	<meta name="twitter:image:alt" content={SHARE_IMAGE_ALT} />
</svelte:head>
