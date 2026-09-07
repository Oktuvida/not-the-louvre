<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { StickerVariant } from '../../home-entry-scene/canvas/museum-canvas';
	import { stickerBackgroundAssetUrl } from '../generated-art';
	import {
		getStickerControlVars,
		getStickerRotation,
		type StickerControlSize
	} from '../sticker-controls';

	/*
	 * The one sticker control. GameButton and GameLink are thin typed wrappers
	 * over this, so the geometry, the paper background and the press states are
	 * defined exactly once instead of drifting between an <a> and a <button>.
	 */
	let {
		tag,
		backgroundTestId,
		legacyClassName,
		rotationSeed,
		elementProps = {},
		variant = 'primary',
		size = 'md',
		className = '',
		contentClassName = '',
		children
	}: {
		tag: 'a' | 'button';
		backgroundTestId: string;
		legacyClassName: string;
		rotationSeed: string;
		elementProps?: Record<string, unknown>;
		variant?: StickerVariant;
		size?: StickerControlSize;
		className?: string;
		contentClassName?: string;
		children: Snippet;
	} = $props();

	const rotation = $derived(getStickerRotation(rotationSeed));
	const backgroundUrl = $derived(stickerBackgroundAssetUrl(size, variant));
	const stickerStyle = $derived(
		`${getStickerControlVars(size, variant)};--sticker-rotate:${rotation.toFixed(1)}deg`
	);
</script>

<svelte:element
	this={tag}
	{...elementProps}
	data-sticker-size={size}
	data-sticker-variant={variant}
	class={`sticker-control focus-ring ${legacyClassName} ${className}`}
	style={stickerStyle}
>
	<!-- The sticker paper is the control's entire visual, and the element has no
	     border or background of its own, so this beats the artwork thumbnails to
	     the wire. It is one small, immutable, shared file per size+variant, so
	     it is a cache hit on every route after the first.

	     The file is baked at the preset's minWidth, and a long label makes the
	     control wider than that. It survives the difference because the SVG has
	     no intrinsic size and slices itself into a stretchable middle and two
	     fixed caps (see `createStickerBackgroundUrl`), not because of anything
	     the CSS below does. -->
	<img
		data-testid={backgroundTestId}
		src={backgroundUrl}
		alt=""
		aria-hidden="true"
		draggable="false"
		decoding="async"
		fetchpriority="high"
		class="sticker-bg"
	/>
	<div class={`sticker-content ${contentClassName}`}>
		{@render children()}
	</div>
</svelte:element>

<style>
	/*
	 * Deliberately inside `@layer components`.
	 *
	 * Svelte scoped styles are unlayered, and unlayered author CSS beats every
	 * `@layer` — including Tailwind's `utilities`. That is why call sites used
	 * to need `!h-11 !min-w-11 !px-0` to resize a sticker. Declaring the
	 * component's own geometry in `components` puts it *below* the utilities
	 * layer, so a plain `min-w-11` / `px-0` / `md:h-auto` at a call site simply
	 * wins. Feature components that override these with `:global(.sticker-btn)`
	 * are still unlayered, so their overrides keep winning too.
	 *
	 * The resting tilt rides `transform: rotate(...)`, and the hover/press states
	 * carry it forward in their own `transform`. It cannot use the standalone
	 * `rotate` property: that is the one call sites reach for (`rotate-1`,
	 * `hover:rotate-2`), and a utility in `@layer utilities` replaces this
	 * layer's declaration of the same property outright — which threw away every
	 * seeded angle and left whole rows of stickers at an identical tilt.
	 */
	@layer components {
		.sticker-control {
			position: relative;
			display: inline-flex;
			align-items: center;
			justify-content: center;
			cursor: pointer;
			border: none;
			background: none;
			text-decoration: none;
			padding: 0;
			--focus-ring-offset: 3px;
			min-width: var(--sticker-min-width, 0px);
			min-height: var(--sticker-height);
			padding-inline: var(--sticker-padding-x);
			font-family: var(--font-display);
			font-size: var(--sticker-font-size);
			font-weight: 700;
			line-height: 1;
			letter-spacing: 0.08em;
			text-transform: uppercase;
			color: var(--sticker-text-color);
			isolation: isolate;
			transform: rotate(var(--sticker-rotate, 0deg));
			transition:
				transform var(--duration-fast) ease,
				rotate var(--duration-fast) ease,
				scale var(--duration-fast) ease,
				filter var(--duration-fast) ease;
		}

		.sticker-control:hover {
			transform: translateY(-3px) rotate(calc(var(--sticker-rotate, 0deg) + 0.8deg));
			filter: brightness(1.04);
		}

		.sticker-control:active {
			transform: translateY(1px) rotate(calc(var(--sticker-rotate, 0deg) - 0.3deg));
			scale: 0.97;
			filter: brightness(0.97);
			transition-duration: 0.06s;
		}

		/* The stroke comes from `focus-ring`; the sticker only says how far off
		   its tilted edge it should sit, and what shape to trace. */
		.sticker-control:focus-visible {
			border-radius: var(--radius-tab);
		}

		.sticker-control:disabled {
			opacity: 0.55;
			cursor: not-allowed;
			filter: grayscale(0.3);
		}

		.sticker-control:disabled:hover {
			transform: rotate(var(--sticker-rotate, 0deg));
			filter: grayscale(0.3);
		}

		.sticker-bg {
			display: block;
			pointer-events: none;
			position: absolute;
			inset: 0;
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
			transition: transform var(--duration-ui) ease;
		}

		.sticker-control:hover .sticker-content :global(svg) {
			transform: rotate(-8deg) scale(1.1);
		}

		.sticker-content :global(span) {
			display: inline-flex;
			align-items: center;
		}
	}
</style>
