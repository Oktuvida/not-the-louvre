<script lang="ts">
	import type { Snippet } from 'svelte';
	import { getFrequentReadCanvasContext } from '$lib/client/canvas-2d';
	import {
		createStickerBackgroundUrl,
		drawStickerBackground,
		type StickerVariant
	} from '../../home-entry-scene/canvas/museum-canvas';
	import {
		getStickerControlPreset,
		getStickerControlVars,
		getStickerRotation,
		type StickerControlSize
	} from '../sticker-controls';

	type Variant = 'primary' | 'secondary' | 'accent' | 'danger' | 'ghost';

	let {
		type = 'button',
		variant = 'primary',
		size = 'md',
		disabled = false,
		className = '',
		children,
		onclick
	}: {
		type?: 'button' | 'submit' | 'reset';
		variant?: Variant;
		size?: StickerControlSize;
		disabled?: boolean;
		className?: string;
		children: Snippet;
		onclick?: () => void;
	} = $props();

	let canvasEl: HTMLCanvasElement | undefined = $state();
	let containerEl: HTMLElement | undefined = $state();
	let resizeObserver: ResizeObserver | undefined;

	const stickerVariant: StickerVariant = $derived(variant);
	const stickerPreset = $derived(getStickerControlPreset(size));
	const stickerStyle = $derived(getStickerControlVars(size, variant));
	const rotation = $derived(getStickerRotation(`button:${variant}:${size}:${type}`));
	const stickerBackgroundUrl = $derived.by(() =>
		createStickerBackgroundUrl(stickerPreset.minWidth, stickerPreset.height, {
			variant: stickerVariant
		})
	);

	const redrawSticker = () => {
		if (!canvasEl || !containerEl) return;

		const w = containerEl.offsetWidth;
		const h = containerEl.offsetHeight;

		if (w === 0 || h === 0) return;

		const dpr = window.devicePixelRatio || 1;
		canvasEl.width = Math.round(w * dpr);
		canvasEl.height = Math.round(h * dpr);
		canvasEl.style.width = `${w}px`;
		canvasEl.style.height = `${h}px`;

		const ctx = getFrequentReadCanvasContext(canvasEl);
		if (!ctx) return;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

		drawStickerBackground(ctx, w, h, { variant: stickerVariant });
	};

	$effect(() => {
		if (!canvasEl || !containerEl) return;
		redrawSticker();

		resizeObserver?.disconnect();
		resizeObserver = new ResizeObserver(() => {
			redrawSticker();
		});
		resizeObserver.observe(containerEl);

		return () => {
			resizeObserver?.disconnect();
			resizeObserver = undefined;
		};
	});
</script>

<button
	bind:this={containerEl}
	{type}
	{disabled}
	{onclick}
	data-sticker-size={size}
	data-sticker-variant={variant}
	class="sticker-btn {className}"
	style={stickerStyle}
	style:transform="rotate({rotation.toFixed(1)}deg)"
>
	<img
		data-testid="game-button-bg"
		src={stickerBackgroundUrl}
		alt=""
		aria-hidden="true"
		draggable="false"
		class="sticker-bg"
	/>
	<canvas bind:this={canvasEl} class="sticker-canvas"></canvas>
	<div class="sticker-content">
		{@render children()}
	</div>
</button>

<style>
	.sticker-btn {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		border: none;
		background: none;
		padding: 0;
		min-width: var(--sticker-min-width, 0px);
		min-height: var(--sticker-height);
		padding-inline: var(--sticker-padding-x);
		font-family: 'Fredoka', sans-serif;
		font-size: var(--sticker-font-size);
		font-weight: 700;
		line-height: 1;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--sticker-text-color);
		isolation: isolate;
		transition:
			transform 0.15s ease,
			filter 0.15s ease;
	}

	.sticker-btn:hover {
		transform: translateY(-3px) rotate(0.8deg) !important;
		filter: brightness(1.04);
	}

	.sticker-btn:active {
		transform: translateY(1px) scale(0.97) rotate(-0.3deg) !important;
		filter: brightness(0.97);
		transition-duration: 0.06s;
	}

	.sticker-btn:disabled {
		opacity: 0.55;
		cursor: not-allowed;
		filter: grayscale(0.3);
	}

	.sticker-btn:disabled:hover {
		transform: none !important;
		filter: grayscale(0.3);
	}

	.sticker-bg,
	.sticker-canvas {
		display: block;
		pointer-events: none;
		position: absolute;
		inset: 0;
	}

	.sticker-bg {
		height: 100%;
		width: 100%;
		object-fit: fill;
		user-select: none;
	}

	.sticker-content {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--sticker-gap);
		width: 100%;
		padding-inline: calc(var(--sticker-padding-x) - 2px);
		pointer-events: none;
		z-index: 1;
		text-align: center;
		text-shadow: 0 1px 0 rgba(255, 255, 255, 0.14);
		white-space: nowrap;
	}

	.sticker-content :global(svg) {
		flex-shrink: 0;
		width: var(--sticker-icon-size);
		height: var(--sticker-icon-size);
		transition: transform 0.2s ease;
	}

	.sticker-btn:hover .sticker-content :global(svg) {
		transform: rotate(-8deg) scale(1.1);
	}

	.sticker-content :global(span) {
		display: inline-flex;
		align-items: center;
	}
</style>
