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
	import { resolve } from '$app/paths';
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

{#if data.viewer && !data.viewer.isBanned && data.viewer.role !== 'user'}
	<a class="ops-link focus-ring" href={resolve('admin')}>Ops</a>
{/if}

<style>
	.ops-link {
		/* The ring itself comes from the `focus-ring` utility; only the offset
		   is local, so the stroke clears the pill's own border. */
		--focus-ring-offset: 3px;
		position: fixed;
		/* Top-right from `md` up. The mobile override this replaced parked the
		   pill in the bottom-right corner, straight on top of the ambient audio
		   tab; the corner it moves to below is the one free corner left. */
		top: 1rem;
		right: 1rem;
		z-index: var(--z-ops);
		padding: 0.7rem 1rem;
		border: 1px solid rgba(27, 33, 30, 0.18);
		border-radius: var(--radius-pill);
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

	/*
	 * On a phone the top-right corner belongs to the gallery header: its Create
	 * Art and Refresh stickers are two 44px controls at `top-3 right-3`, and a
	 * root-level fixed pill at `--z-ops` paints over them and swallows the tap,
	 * so Refresh navigated to /admin instead. The bottom-right is the ambient
	 * audio tab's, and both top corners are chrome — which leaves bottom-left.
	 */
	@media (max-width: 700px) {
		.ops-link {
			top: auto;
			right: auto;
			bottom: 1rem;
			left: 1rem;
		}
	}

	.ops-link:hover {
		transform: translateY(-1px);
		box-shadow: 0 18px 36px rgba(51, 43, 26, 0.22);
	}

	/*
	 * Same treatment as the ambient audio tab: a fixed pill above every modal
	 * (`--z-ops` outranks the artwork panel and the avatar preview) stays
	 * clickable and tabbable while an `aria-modal="true"` dialog claims the
	 * screen. Global because the dialog lives elsewhere in the tree.
	 */
	:global(body:has([role='dialog'][aria-modal='true'])) .ops-link {
		display: none;
	}
</style>
