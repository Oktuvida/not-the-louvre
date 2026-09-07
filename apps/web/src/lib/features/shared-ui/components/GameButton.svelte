<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { StickerVariant } from '../../home-entry-scene/canvas/museum-canvas';
	import type { StickerControlSize } from '../sticker-controls';
	import StickerControl from './StickerControl.svelte';

	/*
	 * Thin typed wrapper over StickerControl so every call site keeps its API.
	 * The geometry, the paper background and the press states live in
	 * StickerControl and are shared with GameLink.
	 */
	let {
		type = 'button',
		ariaLabel = undefined,
		ariaPressed = undefined,
		variant = 'primary',
		size = 'md',
		disabled = false,
		className = '',
		contentClassName = '',
		children,
		onclick
	}: {
		type?: 'button' | 'submit' | 'reset';
		ariaLabel?: string;
		/**
		 * Marks the sticker as a toggle button. Left undefined the attribute is
		 * not rendered at all, so a plain button never claims a pressed state it
		 * does not have.
		 */
		ariaPressed?: boolean;
		variant?: StickerVariant;
		size?: StickerControlSize;
		disabled?: boolean;
		className?: string;
		contentClassName?: string;
		children: Snippet;
		onclick?: () => void;
	} = $props();

	const elementProps = $derived({
		type,
		disabled,
		onclick,
		'aria-label': ariaLabel,
		'aria-pressed': ariaPressed
	});
</script>

<StickerControl
	tag="button"
	legacyClassName="sticker-btn"
	backgroundTestId="game-button-bg"
	rotationSeed={`button:${variant}:${size}:${type}`}
	{elementProps}
	{variant}
	{size}
	{className}
	{contentClassName}
>
	{@render children()}
</StickerControl>
