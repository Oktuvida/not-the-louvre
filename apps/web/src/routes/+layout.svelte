<script lang="ts">
	/*
	 * The root stylesheet goes FIRST. It declares the cascade-layer order
	 * (`@layer theme, base, components, utilities`), and the browser fixes that
	 * order at the first `@layer` it meets — a component stylesheet evaluated
	 * earlier would create `components` ahead of `base` and let Tailwind's
	 * preflight override component geometry. Keep it above every component and
	 * font import.
	 */
	import './layout.css';
	import { beforeNavigate } from '$app/navigation';
	import { page, updated } from '$app/state';
	import { onMount } from 'svelte';
	import AmbientAudioController from '#lib/features/ambient-audio/AmbientAudioController.svelte';
	import SiteMeta from '#lib/features/shared-ui/components/SiteMeta.svelte';
	import TipCup from '#lib/features/shared-ui/components/TipCup.svelte';
	import { readRouteMeta } from '#lib/features/shared-ui/site-meta.js';
	/*
	 * The house typefaces, self-hosted as variable fonts (`fonts.css` says why
	 * and how). Two of them paint above the fold on every route: Baloo 2 is the
	 * body font and Fredoka letters every sticker control and the home hero.
	 * Imported as URLs so Vite hashes them and the preload can never drift from
	 * the emitted filename. `crossorigin` is mandatory even same-origin —
	 * without it the preload does not match the font fetch and the file is
	 * downloaded twice.
	 */
	import './fonts.css';
	import balooBodyFontUrl from '@fontsource-variable/baloo-2/files/baloo-2-latin-wght-normal.woff2?url';
	import fredokaDisplayFontUrl from '@fontsource-variable/fredoka/files/fredoka-latin-wght-normal.woff2?url';
	import type { LayoutProps } from './$types';
	import { avatarFavicon, faviconUpdateEventName } from '#lib/favicon.js';

	let { children, data }: LayoutProps = $props();
	let clientFaviconHref = $state<string | null>(null);
	let clientFaviconBaseHref = $state<string | null>(null);

	const serverFaviconHref = $derived(data.favicon.href);
	// An avatar saved in the page replaces the icon the server rendered.
	const favicon = $derived(
		clientFaviconHref && clientFaviconBaseHref === serverFaviconHref
			? avatarFavicon(clientFaviconHref)
			: data.favicon
	);

	// Routes contribute `meta` from their `load`; the head is rendered here
	// once so a page can never end up with two competing <title> elements.
	const routeMeta = $derived(readRouteMeta(page.data));
	const pathname = $derived(page.url?.pathname);
	// `+error.svelte` has no `load`, so it cannot contribute `meta` the way the
	// real routes do, and `page.data` here still holds whatever the layout load
	// returned — which would title a 404 after the page the visitor never
	// reached. The status is the only title an error page can carry.
	const documentTitle = $derived(page.error ? String(page.status) : routeMeta.title);

	// A release went out while this tab was open: the code it runs asks for
	// hashed files the new build no longer has, the studio model among them. The
	// next page the visitor opens is loaded whole, from the new release.
	beforeNavigate(({ to, willUnload }) => {
		if (updated.current && !willUnload && to?.url) location.href = to.url.href;
	});

	onMount(() => {
		const handleFaviconUpdate = (event: Event) => {
			const customEvent = event as CustomEvent<{ href?: string }>;

			if (typeof customEvent.detail?.href !== 'string') {
				return;
			}

			clientFaviconBaseHref = serverFaviconHref;
			clientFaviconHref = customEvent.detail.href;
		};

		window.addEventListener(faviconUpdateEventName, handleFaviconUpdate);

		return () => {
			window.removeEventListener(faviconUpdateEventName, handleFaviconUpdate);
		};
	});
</script>

<svelte:head>
	<!-- Keyed, so a new icon arrives as a new link: Safari reads a page's icon
	     when a link arrives, never when an existing link's address changes. -->
	{#key favicon.href}
		<link rel="icon" href={favicon.href} type={favicon.type} sizes={favicon.sizes} />
	{/key}

	<link rel="preload" as="font" type="font/woff2" href={balooBodyFontUrl} crossorigin="anonymous" />

	<link
		rel="preload"
		as="font"
		type="font/woff2"
		href={fredokaDisplayFontUrl}
		crossorigin="anonymous"
	/>
</svelte:head>

<SiteMeta
	title={documentTitle}
	description={routeMeta.description}
	image={page.error ? undefined : routeMeta.image}
	{pathname}
/>

{@render children()}

<AmbientAudioController
	bootstrappedPreference={data.ambientAudioEnabled}
	viewerId={data.viewer?.id ?? null}
/>

<!-- The studio asks for nothing but the drawing. -->
{#if page.route?.id !== '/draw'}
	<TipCup />
{/if}
