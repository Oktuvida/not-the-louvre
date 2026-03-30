<script lang="ts">
	import { onMount } from 'svelte';
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
	<title>Not the Louvre</title>
	<meta
		name="description"
		content="A playful studio-world where sketchy masterpieces, strange rankings, and a 3D room all collide."
	/>
</svelte:head>

{@render children()}
