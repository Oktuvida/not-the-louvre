<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Snippet } from 'svelte';
	import type { StickerVariant } from '../../home-entry-scene/canvas/museum-canvas';
	import type { StickerControlSize, StickerLinkHref } from '../sticker-controls';
	import StickerControl from './StickerControl.svelte';

	/*
	 * Thin typed wrapper over StickerControl so every call site keeps its API.
	 * The geometry, the paper background and the press states live in
	 * StickerControl and are shared with GameButton.
	 */
	let {
		href,
		variant = 'primary',
		className = '',
		contentClassName = '',
		size = 'md',
		children,
		...restProps
	}: {
		href: StickerLinkHref;
		variant?: StickerVariant;
		className?: string;
		contentClassName?: string;
		size?: StickerControlSize;
		children: Snippet;
		[key: string]: unknown;
	} = $props();

	const resolvedHref = $derived.by(() => {
		if (href === '/') return resolve('/');
		if (href === '/draw') return resolve('draw');
		// `/gallery` and every room share one route node with an optional
		// parameter; omitting it resolves to the bare `/gallery` entry point.
		if (href === '/gallery') return resolve('/gallery/[[room]]', {});

		return resolve('/gallery/[[room]]', { room: href.replace('/gallery/', '') });
	});

	const elementProps = $derived({ ...restProps, href: resolvedHref });
</script>

<StickerControl
	tag="a"
	legacyClassName="sticker-link"
	backgroundTestId="game-link-bg"
	rotationSeed={`link:${href}:${variant}:${size}`}
	{elementProps}
	{variant}
	{size}
	{className}
	{contentClassName}>{@render children()}</StickerControl
>
