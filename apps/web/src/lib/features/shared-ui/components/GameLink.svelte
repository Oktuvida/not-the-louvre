<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Snippet } from 'svelte';
	import {
		drawStickerBackground,
		type StickerVariant
	} from '../../home-entry-scene/canvas/museum-canvas';
	import {
		getStickerControlVars,
		getStickerRotation,
		type StickerControlSize,
		type StickerLinkHref
	} from '../sticker-controls';

	type Variant = 'primary' | 'secondary' | 'accent' | 'danger' | 'ghost';

	let {
		href,
		variant = 'primary',
		className = '',
		contentClassName = '',
		size = 'md',
		children
	}: {
		href: StickerLinkHref;
		variant?: Variant;
		className?: string;
		contentClassName?: string;
		size?: StickerControlSize;
		children: Snippet;
	} = $props();

	let canvasEl: HTMLCanvasElement | undefined = $state();
	let containerEl: HTMLElement | undefined = $state();
	let resizeObserver: ResizeObserver | undefined;

	const stickerVariant: StickerVariant = $derived(variant);
	const rotation = $derived(getStickerRotation(`link:${href}:${variant}:${size}`));
	const stickerVars = $derived(getStickerControlVars(size, variant));
	const resolvedHref = $derived.by(() => {
		if (href === '/') return resolve('/');
		if (href === '/draw') return resolve('/draw');
		if (href === '/gallery') return resolve('/gallery');

		return resolve('/gallery/[room]', { room: href.replace('/gallery/', '') });
	});

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

		const ctx = canvasEl.getContext('2d');
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

<!-- eslint-disable svelte/no-navigation-without-resolve -->
<a
	bind:this={containerEl}
	href={resolvedHref}
	class="sticker-link {className}"
	data-sticker-size={size}
	data-sticker-variant={variant}
	style:transform="rotate({rotation.toFixed(1)}deg)"
	style={stickerVars}
>
	<canvas bind:this={canvasEl} class="sticker-canvas"></canvas>
	<div class="sticker-content {contentClassName}">
		{@render children()}
	</div>
</a>

<!-- eslint-enable svelte/no-navigation-without-resolve -->

<style>
	.sticker-link {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		text-decoration: none;
		border: none;
		background: none;
		min-width: var(--sticker-min-width);
		height: var(--sticker-height);
		padding: 0 var(--sticker-padding-x);
		font-family: 'Fredoka', sans-serif;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		font-size: var(--sticker-font-size);
		color: var(--sticker-text-color);
		transition:
			transform 0.15s ease,
			filter 0.15s ease;
	}

	.sticker-link:hover {
		transform: translateY(-3px) rotate(0.8deg) !important;
		filter: brightness(1.04);
	}

	.sticker-link:active {
		transform: translateY(1px) scale(0.97) rotate(-0.3deg) !important;
		filter: brightness(0.97);
		transition-duration: 0.06s;
	}

	.sticker-canvas {
		display: block;
		pointer-events: none;
		position: absolute;
		inset: 0;
	}

	.sticker-content {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--sticker-gap);
		pointer-events: none;
		z-index: 1;
		width: 100%;
		font-family: 'Fredoka', sans-serif;
		font-size: var(--sticker-font-size);
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--sticker-text-color);
		text-align: center;
		white-space: nowrap;
	}

	.sticker-content :global(svg) {
		flex-shrink: 0;
		width: var(--sticker-icon-size);
		height: var(--sticker-icon-size);
		transition: transform 0.2s ease;
	}

	.sticker-link:hover .sticker-content :global(svg) {
		transform: rotate(-8deg) scale(1.1);
	}
</style>
