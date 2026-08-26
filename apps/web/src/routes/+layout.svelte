<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import AmbientAudioController from '$lib/features/ambient-audio/AmbientAudioController.svelte';
	// Self-hosted fonts (same families and weights the Google Fonts link
	// used to serve) — bundled woff2, no render-blocking third-party CSS.
	import '@fontsource/baloo-2/400.css';
	import '@fontsource/baloo-2/500.css';
	import '@fontsource/baloo-2/600.css';
	import '@fontsource/baloo-2/700.css';
	import '@fontsource/baloo-2/800.css';
	import '@fontsource/caveat/400.css';
	import '@fontsource/caveat/700.css';
	import '@fontsource/fredoka/400.css';
	import '@fontsource/fredoka/500.css';
	import '@fontsource/fredoka/600.css';
	import '@fontsource/fredoka/700.css';
	import './layout.css';
	import type { LayoutProps } from './$types';
	import { faviconUpdateEventName } from '$lib/favicon';

	const STUDIO_BACKGROUND_URL = '/table.avif';
	const STUDIO_BACKGROUND_WARMUP_DELAY_MS = 1200;
	let studioBackgroundWarmupStarted = false;

	let { children, data }: LayoutProps = $props();
	let clientFaviconHref = $state<string | null>(null);
	let clientFaviconBaseHref = $state<string | null>(null);

	const serverFaviconHref = $derived(data.favicon.href);
	const faviconHref = $derived(
		clientFaviconHref && clientFaviconBaseHref === serverFaviconHref
			? clientFaviconHref
			: serverFaviconHref
	);

	onMount(() => {
		let idleHandle: number | null = null;
		let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

		const warmStudioBackground = () => {
			if (studioBackgroundWarmupStarted) {
				return;
			}

			studioBackgroundWarmupStarted = true;
			const image = new Image();
			image.decoding = 'async';
			image.src = STUDIO_BACKGROUND_URL;
		};

		const scheduleStudioBackgroundWarmup = () => {
			if ('requestIdleCallback' in window) {
				idleHandle = window.requestIdleCallback(() => {
					warmStudioBackground();
				});
				return;
			}

			timeoutHandle = setTimeout(warmStudioBackground, STUDIO_BACKGROUND_WARMUP_DELAY_MS);
		};

		const handleFaviconUpdate = (event: Event) => {
			const customEvent = event as CustomEvent<{ href?: string }>;

			if (typeof customEvent.detail?.href !== 'string') {
				return;
			}

			clientFaviconBaseHref = serverFaviconHref;
			clientFaviconHref = customEvent.detail.href;
		};

		window.addEventListener(faviconUpdateEventName, handleFaviconUpdate);
		scheduleStudioBackgroundWarmup();

		return () => {
			if (idleHandle !== null && 'cancelIdleCallback' in window) {
				window.cancelIdleCallback(idleHandle);
			}

			if (timeoutHandle !== null) {
				clearTimeout(timeoutHandle);
			}

			window.removeEventListener(faviconUpdateEventName, handleFaviconUpdate);
		};
	});
</script>

<svelte:head>
	<link rel="icon" href={faviconHref} sizes="any" />
	<title>Not the Louvre</title>
	<meta
		name="description"
		content="A playful studio-world where sketchy masterpieces, strange rankings, and a 3D room all collide."
	/>
</svelte:head>

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
		top: 1rem;
		right: 1rem;
		z-index: 1000;
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

	@media (max-width: 700px) {
		.ops-link {
			top: auto;
			bottom: 1rem;
			right: 1rem;
			left: auto;
		}
	}
</style>
