<script lang="ts">
	import { Eraser, Palette, Redo2, Undo2 } from 'lucide-svelte';
	import { INK_SHOWN_LEVEL, INK_WARNING_LEVEL } from '#lib/features/stroke-json/ink.js';
	import {
		brushSizeSteps,
		drawingPalette,
		drawingTools
	} from '#lib/features/studio-drawing/state/drawing.svelte.js';

	let {
		canRedo = false,
		canUndo = false,
		inkUsed = 0,
		onRedo,
		onUndo
	}: {
		canRedo?: boolean;
		canUndo?: boolean;
		/** How much of what the server accepts the drawing has used, 0 to 1. */
		inkUsed?: number;
		onRedo?: () => void;
		onUndo?: () => void;
	} = $props();

	const LIGHT_SWATCH_COLORS = new Set([
		'#FFFFFF',
		'#C8C8C8',
		'#FDBCB4',
		'#F5D200',
		'#DCC9A3',
		'#E5DECA'
	]);

	const inkLeft = $derived(Math.max(0, Math.round((1 - inkUsed) * 100)));

	const selectColor = (color: string) => {
		drawingTools.activeColor = color;
	};
</script>

<!-- How the tray is laid out (a card beside the canvas, a band under it, a
     strip on a phone) is the studio layout's call, through the --tray-* custom
     properties it sets per screen in studio-layout.css. -->
<div class="tool-tray paper-sheet paper-grain">
	<span class="tray-tape tray-tape-left tape" aria-hidden="true"></span>
	<span class="tray-tape tray-tape-right tape" aria-hidden="true"></span>
	<span class="tray-stain tray-stain-a" aria-hidden="true"></span>
	<span class="tray-stain tray-stain-b" aria-hidden="true"></span>

	<!-- Palette section -->
	<div class="tray-section tray-palette">
		<div class="tray-label tray-palette-label">
			<Palette size={12} />
			<span>Paints</span>
		</div>
		<span class="paint-swipe tray-label-swipe" aria-hidden="true"></span>
		<div class="palette-grid">
			{#each drawingPalette as color (color)}
				<button
					type="button"
					class="palette-swatch focus-ring"
					class:active={drawingTools.activeColor === color}
					style={`--swatch-color:${color}`}
					onclick={() => selectColor(color)}
					aria-label={`Select color ${color}`}
				>
					<span
						class="swatch-paint"
						class:swatch-paint-light={LIGHT_SWATCH_COLORS.has(color)}
						aria-hidden="true"
					></span>
				</button>
			{/each}
		</div>
	</div>

	<!-- Brush size section -->
	<div class="tray-section tray-brush">
		<div class="tray-label tray-brush-label">
			<span>Brush</span>
		</div>
		<div class="slider-wrapper">
			<input
				id="brush-size"
				class="brush-slider focus-ring"
				type="range"
				min="0"
				max={brushSizeSteps.length - 1}
				step="1"
				bind:value={drawingTools.brushSizeIndex}
				aria-label="Brush size"
				style={`--slider-pct: ${(drawingTools.brushSizeIndex / (brushSizeSteps.length - 1)) * 100}%`}
			/>
		</div>
		<div class="brush-preview">
			<div class="test-scrap">
				<span class="test-scrap-tape tape" aria-hidden="true"></span>
				<div class="brush-preview-shell">
					<div
						class="brush-dot"
						style={`width: ${Math.max(4, Math.min(28, drawingTools.brushSize))}px; height: ${Math.max(4, Math.min(28, drawingTools.brushSize))}px; background: ${drawingTools.activeColor};`}
					></div>
				</div>
			</div>
			<span class="brush-size-text">{drawingTools.brushSize}px</span>
		</div>
	</div>

	<!-- Eraser, and taking lines back -->
	<div class="tray-tools">
		<button
			type="button"
			class="tray-tool focus-ring"
			class:tray-tool-active={drawingTools.tool === 'eraser'}
			aria-pressed={drawingTools.tool === 'eraser'}
			onclick={() => (drawingTools.tool = drawingTools.tool === 'eraser' ? 'brush' : 'eraser')}
		>
			<Eraser size={18} aria-hidden="true" />
			<span class="tray-tool-text">Eraser</span>
		</button>
		<button
			type="button"
			class="tray-tool focus-ring"
			aria-label="Undo"
			disabled={!canUndo}
			onclick={onUndo}
		>
			<Undo2 size={18} aria-hidden="true" />
		</button>
		<button
			type="button"
			class="tray-tool focus-ring"
			aria-label="Redo"
			disabled={!canRedo}
			onclick={onRedo}
		>
			<Redo2 size={18} aria-hidden="true" />
		</button>
	</div>

	<!-- The ink is the drawing's budget: it runs out where the server would say no.
	     It only shows up when it is running low. -->
	{#if inkUsed >= INK_SHOWN_LEVEL}
		<div class="ink">
			<div
				class="ink-meter"
				role="meter"
				aria-label="Ink left"
				aria-valuemin="0"
				aria-valuemax="100"
				aria-valuenow={inkLeft}
			>
				<span
					class="ink-level"
					class:ink-level-low={inkUsed >= INK_WARNING_LEVEL}
					style:width={`${inkLeft}%`}
				></span>
			</div>
			{#if inkUsed >= 1}
				<p class="ink-note ink-note-out">Out of ink</p>
			{:else if inkUsed >= INK_WARNING_LEVEL}
				<p class="ink-note">Running low on ink</p>
			{/if}
		</div>
	{/if}

	<p class="tray-edge-print" aria-hidden="true">Not the Louvre · Studio Supplies</p>
</div>

<style>
	.ink {
		grid-area: ink;
		margin-top: 12px;
	}

	.ink-meter {
		height: 8px;
		overflow: hidden;
		border: 1px solid rgba(45, 36, 32, 0.3);
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.5);
	}

	.ink-level {
		display: block;
		height: 100%;
		background: var(--color-ink-warm, #2d2420);
		transition: width 200ms ease-out;
	}

	.ink-level-low {
		background: var(--color-danger-bright, #c0392b);
	}

	.ink-note {
		margin-top: 4px;
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-ink-warm, #2d2420);
	}

	.ink-note-out {
		color: var(--color-danger-bright, #c0392b);
	}

	.tray-tools {
		grid-area: tools;
		display: flex;
		align-self: var(--tray-tools-align, auto);
		gap: 8px;
		margin-top: var(--tray-tools-gap, 14px);
	}

	.tray-tool {
		display: inline-flex;
		flex: 0 0 auto;
		align-items: center;
		justify-content: center;
		gap: 6px;
		min-width: 44px;
		min-height: 44px;
		padding: 0 12px;
		border: 2px solid rgba(45, 36, 32, 0.35);
		border-radius: 12px;
		background: rgba(255, 255, 255, 0.55);
		color: var(--color-ink-warm, #2d2420);
		font-family: var(--font-display, inherit);
		font-size: 0.85rem;
		font-weight: 600;
		cursor: pointer;
	}

	.tray-tool:first-child {
		flex: var(--tray-eraser-flex, 1 1 auto);
	}

	/* Where the row is short (a phone) the layout keeps the word for screen
	 * readers and shows only the eraser's picture. */
	.tray-tool-text {
		position: var(--tray-tool-text-position, static);
		width: var(--tray-tool-text-size, auto);
		height: var(--tray-tool-text-size, auto);
		clip-path: var(--tray-tool-text-clip, none);
		white-space: nowrap;
	}

	.tray-tool-active {
		border-color: var(--color-ink-warm, #2d2420);
		background: var(--color-ink-warm, #2d2420);
		color: var(--color-paper-bright, #fdfbf7);
	}

	.tray-tool:disabled {
		cursor: not-allowed;
		opacity: 0.4;
	}

	/*
	 * A scrap of studio paper: the paper itself is `.paper-sheet` +
	 * `.paper-grain`, and how it is torn off and pinned down is here. The tray
	 * used to carry its own copy of both, with the shadow a shade lighter
	 * (0.28/0.16) than the auth sheet a click away — an invisible typo that the
	 * shared class settles.
	 */
	.tool-tray {
		display: grid;
		grid-template-areas: var(--tray-areas, 'palette' 'brush' 'tools' 'ink' 'print');
		grid-template-columns: var(--tray-columns, minmax(0, 1fr));
		column-gap: var(--tray-column-gap, 1.25rem);
		align-items: var(--tray-align, stretch);
		padding: var(--tray-padding, 20px);
		transform: rotate(var(--tray-tilt, 1.2deg));
	}

	.tray-palette {
		grid-area: palette;
	}

	.tray-brush {
		grid-area: brush;
		display: flex;
		flex-direction: var(--tray-brush-direction, column);
		align-items: var(--tray-brush-align, stretch);
		gap: var(--tray-brush-gap, 0);
	}

	.tray-tape {
		position: absolute;
		top: -10px;
		width: 74px;
		height: 22px;
	}

	.tray-tape-left {
		left: 18px;
		rotate: -6deg;
	}

	.tray-tape-right {
		right: 22px;
		rotate: 5deg;
	}

	/* faint paint stains — radial gradients on purpose, never filter: blur */
	.tray-stain {
		position: absolute;
		pointer-events: none;
		border-radius: 50%;
	}

	.tray-stain-a {
		width: 150px;
		height: 120px;
		right: -26px;
		top: 34%;
		background: radial-gradient(closest-side, rgba(113, 145, 127, 0.14), transparent 70%);
	}

	.tray-stain-b {
		width: 130px;
		height: 110px;
		left: -22px;
		bottom: -18px;
		background: radial-gradient(closest-side, rgba(244, 196, 48, 0.13), transparent 70%);
	}

	/* How long and how crooked this swipe is; the paint is `.paint-swipe`. */
	.tray-label-swipe {
		display: var(--tray-palette-label, block);
		width: 86px;
		height: 6px;
		margin: -4px 0 12px;
		rotate: -1deg;
	}

	.tray-section {
		margin-bottom: var(--tray-section-gap, 16px);
		position: relative;
	}

	.tray-palette-label {
		display: var(--tray-palette-label, flex);
	}

	.tray-brush-label {
		display: var(--tray-brush-label, flex);
	}

	.tray-label {
		font-family: var(--font-display);
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		color: var(--color-muted-ink);
		margin-bottom: 10px;
		align-items: center;
		gap: 5px;
	}

	.tray-label :global(svg) {
		width: 14px;
		height: 14px;
		flex-shrink: 0;
	}

	/* --- Paint dabs: 6 columns --- */

	.palette-grid {
		display: grid;
		grid-template-columns: var(
			--tray-palette-template,
			repeat(var(--tray-palette-columns, 6), minmax(0, 1fr))
		);
		grid-auto-flow: var(--tray-palette-flow, row);
		grid-auto-columns: var(--tray-palette-cell, auto);
		gap: var(--tray-palette-gap, 9px 8px);
		overflow-x: var(--tray-palette-overflow, visible);
		/* Room for the pencil circle round the chosen paint inside a strip that clips. */
		padding: var(--tray-palette-padding, 0);
		scrollbar-width: none;
	}

	/* The button box stays still — the blob inside animates — so pointer
	 * clicks always land where the press started. */
	.palette-swatch {
		position: relative;
		width: 100%;
		aspect-ratio: 1;
		border: 0;
		padding: 0;
		background: transparent;
		cursor: pointer;
	}

	.swatch-paint {
		position: absolute;
		inset: 1px;
		display: block;
		background: var(--swatch-color);
		box-shadow: 1px 2px 3px rgba(45, 36, 32, 0.28);
		transition:
			scale 130ms var(--ease-spring),
			rotate 130ms ease;
	}

	/* four blob silhouettes, rotated per cell — every dab is hand-squeezed */
	.palette-swatch:nth-child(4n + 1) .swatch-paint {
		border-radius: 58% 42% 55% 45% / 48% 60% 40% 52%;
		rotate: -4deg;
		translate: 0 1px;
	}
	.palette-swatch:nth-child(4n + 2) .swatch-paint {
		border-radius: 45% 55% 48% 52% / 60% 42% 58% 40%;
		rotate: 3deg;
		translate: 1px -2px;
		scale: 0.94;
	}
	.palette-swatch:nth-child(4n + 3) .swatch-paint {
		border-radius: 52% 48% 60% 40% / 45% 55% 45% 55%;
		rotate: -2deg;
		translate: -1px 2px;
		scale: 1.05;
	}
	.palette-swatch:nth-child(4n + 4) .swatch-paint {
		border-radius: 40% 60% 44% 56% / 55% 45% 60% 40%;
		rotate: 5deg;
		translate: 0 -1px;
	}
	/* a second rhythm every 5 cells so rows never repeat the same dance */
	.palette-swatch:nth-child(5n + 2) .swatch-paint {
		translate: 2px 1px;
	}
	.palette-swatch:nth-child(5n + 4) .swatch-paint {
		scale: 0.92;
	}

	/* gloss — fresh paint catches the studio lights */
	.swatch-paint::before {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		background: radial-gradient(circle at 30% 26%, rgba(255, 255, 255, 0.5), transparent 46%);
	}

	.swatch-paint-light {
		border: 1px solid rgba(47, 36, 28, 0.22);
	}

	.palette-swatch:hover .swatch-paint {
		scale: 1.14;
	}

	.palette-swatch.active .swatch-paint {
		scale: 1.1;
		translate: 0 0;
	}

	/* selection = circled in pencil */
	.palette-swatch.active::after {
		content: '';
		position: absolute;
		inset: -4px -3px -3px -4px;
		border: 2.5px dashed rgba(47, 36, 28, 0.75);
		border-radius: 54% 46% 50% 50% / 48% 52% 46% 54%;
		rotate: -6deg;
	}

	/* --- Brush: pencil line + wax knob --- */

	.slider-wrapper {
		position: relative;
		flex: 1;
		margin: 2px 0;
	}

	/*
	 * The input is as tall as a fingertip (44px) and paints nothing itself; the
	 * pencil line is its track. It used to be the 7px line, so a finger or a
	 * pen aimed at the stroke and missed.
	 */
	.brush-slider {
		-webkit-appearance: none;
		appearance: none;
		display: block;
		width: 100%;
		height: 44px;
		margin: 0;
		background: transparent;
		/* No `outline: none` here: a scoped, unlayered declaration beats every
		   cascade layer regardless of specificity, so it would shadow the
		   `focus-ring` utility (which lives in `@layer utilities`) and leave the
		   control with no visible focus at all. An `appearance: none` range paints
		   no UA outline of its own, so there is nothing to reset. */
		cursor: pointer;
	}

	.brush-slider::-webkit-slider-runnable-track {
		height: 7px;
		rotate: -0.8deg;
		/* a drying brushstroke: thick where it starts, thin where it lifts */
		border-radius: 4px 12px 10px 6px / 6px 8px 12px 4px;
		background: linear-gradient(
			90deg,
			#d9a468 0%,
			var(--color-primary) var(--slider-pct, 30%),
			rgba(107, 74, 46, 0.18) var(--slider-pct, 30%),
			rgba(107, 74, 46, 0.12) 100%
		);
	}

	.brush-slider::-moz-range-track {
		height: 7px;
		border-radius: 4px 12px 10px 6px / 6px 8px 12px 4px;
		background: linear-gradient(
			90deg,
			#d9a468 0%,
			var(--color-primary) var(--slider-pct, 30%),
			rgba(107, 74, 46, 0.18) var(--slider-pct, 30%),
			rgba(107, 74, 46, 0.12) 100%
		);
	}

	.brush-slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		margin-top: -8px;
		width: 22px;
		height: 22px;
		border: 2px solid var(--color-paper-bright);
		border-radius: 48% 52% 50% 50% / 52% 48% 54% 46%;
		background: radial-gradient(circle at 32% 28%, #c96a5b, var(--color-danger-deep) 55%, #6e211c);
		box-shadow: var(--shadow-chip);
		cursor: pointer;
	}

	.brush-slider::-moz-range-thumb {
		width: 22px;
		height: 22px;
		border: 2px solid var(--color-paper-bright);
		border-radius: 50%;
		background: radial-gradient(circle at 32% 28%, #c96a5b, var(--color-danger-deep) 55%, #6e211c);
		box-shadow: var(--shadow-chip);
		cursor: pointer;
	}

	/* --- Brush preview: a taped test scrap --- */

	.brush-preview {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		margin-top: var(--tray-brush-preview-gap, 4px);
	}

	.test-scrap {
		display: var(--tray-brush-scrap, block);
		position: relative;
		padding: 3px;
		background: var(--color-paper-bright);
		border: 1px solid var(--color-hairline);
		box-shadow: 2px 3px 7px rgba(0, 0, 0, 0.16);
		rotate: 3deg;
	}

	.test-scrap-tape {
		position: absolute;
		top: -7px;
		left: 8px;
		width: 30px;
		height: 12px;
		rotate: -4deg;
	}

	.brush-preview-shell {
		width: 40px;
		height: 40px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.brush-dot {
		border-radius: 50%;
		border: 1px solid rgba(47, 36, 28, 0.14);
		transition:
			width var(--duration-fast),
			height var(--duration-fast);
	}

	.brush-size-text {
		font-family: var(--font-hand);
		font-size: 1.05rem;
		font-weight: 600;
		color: var(--color-muted-ink);
		rotate: -2deg;
	}

	/* --- Separator --- */

	/* --- Action buttons --- */

	/* Decoration, so hidden from screen readers; the studio layout drops it where room is short. */
	.tray-edge-print {
		grid-area: print;
		display: var(--tray-print, block);
		margin: 14px 0 -6px;
		text-align: center;
		font-family: var(--font-display);
		font-size: 0.5625rem;
		font-weight: 600;
		letter-spacing: 0.26em;
		text-transform: uppercase;
		color: rgba(138, 108, 82, 0.55);
	}
</style>
