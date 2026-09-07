<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import AmbientAudioController from '$lib/features/ambient-audio/AmbientAudioController.svelte';
	import SiteMeta from '$lib/features/shared-ui/components/SiteMeta.svelte';
	import { readRouteMeta } from '$lib/features/shared-ui/site-meta';
	/*
	 * Self-hosted fonts, latin + latin-ext subsets only.
	 *
	 * The aggregate entry points (`@fontsource/baloo-2/400.css`) declare EVERY
	 * subset the family ships — devanagari, vietnamese, cyrillic(-ext) and
	 * hebrew as well — which put 40 @font-face rules on the render-blocking
	 * path of every route and pushed 2MB of never-requested font files into the
	 * Workers asset bundle. The per-subset entry points below carry the 22
	 * faces this UI can actually paint.
	 *
	 * The accepted trade: user-generated text in a non-Latin script (a nickname,
	 * a guestbook note) renders in the system fallback stack rather than in
	 * Baloo 2 / Fredoka / Caveat.
	 */
	import '@fontsource/baloo-2/latin-400.css';
	import '@fontsource/baloo-2/latin-ext-400.css';
	import '@fontsource/baloo-2/latin-500.css';
	import '@fontsource/baloo-2/latin-ext-500.css';
	import '@fontsource/baloo-2/latin-600.css';
	import '@fontsource/baloo-2/latin-ext-600.css';
	import '@fontsource/baloo-2/latin-700.css';
	import '@fontsource/baloo-2/latin-ext-700.css';
	// Weight 800 stays: `font-black` (900) has no 900 face anywhere and matches
	// upward onto it, so dropping it would visibly lighten 11 call sites.
	import '@fontsource/baloo-2/latin-800.css';
	import '@fontsource/baloo-2/latin-ext-800.css';
	import '@fontsource/caveat/latin-400.css';
	import '@fontsource/caveat/latin-ext-400.css';
	import '@fontsource/caveat/latin-700.css';
	import '@fontsource/caveat/latin-ext-700.css';
	import '@fontsource/fredoka/latin-400.css';
	import '@fontsource/fredoka/latin-ext-400.css';
	import '@fontsource/fredoka/latin-500.css';
	import '@fontsource/fredoka/latin-ext-500.css';
	import '@fontsource/fredoka/latin-600.css';
	import '@fontsource/fredoka/latin-ext-600.css';
	import '@fontsource/fredoka/latin-700.css';
	import '@fontsource/fredoka/latin-ext-700.css';
	/*
	 * The two faces that paint above the fold on every route: Baloo 2 400 is
	 * the body font and Fredoka 700 letters every sticker control and the home
	 * hero. Imported as URLs so Vite hashes them and the preload can never
	 * drift from the emitted filename. `crossorigin` is mandatory even
	 * same-origin — without it the preload does not match the font fetch and
	 * the file is downloaded twice.
	 */
	import balooBodyFontUrl from '@fontsource/baloo-2/files/baloo-2-latin-400-normal.woff2?url';
	import fredokaDisplayFontUrl from '@fontsource/fredoka/files/fredoka-latin-700-normal.woff2?url';
	import './layout.css';
	import type { LayoutProps } from './$types';
	import { faviconUpdateEventName } from '$lib/favicon';

	let { children, data }: LayoutProps = $props();
	let clientFaviconHref = $state<string | null>(null);
	let clientFaviconBaseHref = $state<string | null>(null);

	const serverFaviconHref = $derived(data.favicon.href);
	const faviconHref = $derived(
		clientFaviconHref && clientFaviconBaseHref === serverFaviconHref
			? clientFaviconHref
			: serverFaviconHref
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
	<link rel="icon" href={faviconHref} sizes="any" />
	<link rel="preload" as="font" type="font/woff2" href={balooBodyFontUrl} crossorigin="anonymous" />
	<link
		rel="preload"
		as="font"
		type="font/woff2"
		href={fredokaDisplayFontUrl}
		crossorigin="anonymous"
	/>
</svelte:head>

<SiteMeta title={documentTitle} description={routeMeta.description} {pathname} />

{@render children()}

<AmbientAudioController
	bootstrappedPreference={data.ambientAudioEnabled}
	viewerId={data.viewer?.id ?? null}
/>

{#if data.viewer && !data.viewer.isBanned && data.viewer.role !== 'user'}
	<a class="ops-link" href={resolve('/admin')}>Ops</a>
{/if}

<style>
	.ops-link {
		position: fixed;
		/* Stays top-right at every width: the mobile override used to move it
		   into the bottom-right corner, straight on top of the ambient audio
		   tab. */
		top: 1rem;
		right: 1rem;
		z-index: var(--z-ops);
		padding: 0.7rem 1rem;
		border: 1px solid rgba(27, 33, 30, 0.18);
		border-radius: 999px;
		background:
			linear-gradient(135deg, rgba(253, 248, 237, 0.96), rgba(238, 224, 199, 0.94)),
			rgba(255, 255, 255, 0.75);
		color: #1b211e;
		font-size: 0.78rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-decoration: none;
		text-transform: uppercase;
		backdrop-filter: blur(12px);
		box-shadow: 0 14px 32px rgba(51, 43, 26, 0.18);
	}

	.ops-link:hover {
		transform: translateY(-1px);
		box-shadow: 0 18px 36px rgba(51, 43, 26, 0.22);
	}

	.ops-link:focus-visible {
		outline: 3px solid var(--focus-ring-color, #4ecdc4);
		outline-offset: 3px;
	}
</style>
