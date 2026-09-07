<script lang="ts">
	import { ImageUp, Palette, Trash2 } from 'lucide-svelte';
	import GameButton from '$lib/features/shared-ui/components/GameButton.svelte';
	import {
		brushSizeSteps,
		drawingPalette,
		drawingTools
	} from '$lib/features/studio-drawing/state/drawing.svelte';

	let {
		isPublishing = false,
		mobile = false,
		onPublish,
		onClear
	}: {
		isPublishing?: boolean;
		mobile?: boolean;
		onPublish?: () => void;
		onClear?: () => void;
	} = $props();

	const LIGHT_SWATCH_COLORS = new Set([
		'#FFFFFF',
		'#C8C8C8',
		'#FDBCB4',
		'#F5D200',
		'#DCC9A3',
		'#E5DECA'
	]);

	const selectColor = (color: string) => {
		drawingTools.activeColor = color;
	};
</script>

<div class:tool-tray-mobile={mobile} class="tool-tray paper-sheet paper-grain">
	<span class="tray-tape tray-tape-left" aria-hidden="true"></span>
	<span class="tray-tape tray-tape-right" aria-hidden="true"></span>
	<span class="tray-stain tray-stain-a" aria-hidden="true"></span>
	<span class="tray-stain tray-stain-b" aria-hidden="true"></span>

	<!-- Palette section -->
	<div class:tray-section-mobile-palette={mobile} class="tray-section">
		<div class="tray-label">
			<Palette size={12} />
			<span>Paints</span>
		</div>
		<span class="paint-swipe tray-label-swipe" aria-hidden="true"></span>
		{#if mobile}
			<div class="palette-mobile-row">
				<div class="palette-mobile-grid">
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
		{:else}
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
		{/if}
	</div>

	<!-- Brush size section -->
	<div class="tray-section">
		<div class="tray-label">
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

	<div class="tray-sep" aria-hidden="true"></div>

	<!-- Action buttons -->
	<div class="tray-actions">
		<GameButton
			type="button"
			variant="secondary"
			size="sm"
			className="w-full"
			onclick={onPublish}
			disabled={isPublishing}
		>
			<ImageUp size={20} />
			<span>{isPublishing ? 'Publishing…' : 'Publish'}</span>
		</GameButton>

		<GameButton
			type="button"
			variant="danger"
			size="sm"
			className="w-full"
			onclick={onClear}
			disabled={isPublishing}
		>
			<Trash2 size={20} />
			<span>Clear</span>
		</GameButton>
	</div>

	<p class="tray-edge-print">Not the Louvre · Studio Supplies</p>
</div>

<style>
	/*
	 * A scrap of studio paper: the paper itself is `.paper-sheet` +
	 * `.paper-grain`, and how it is torn off and pinned down is here. The tray
	 * used to carry its own copy of both, with the shadow a shade lighter
	 * (0.28/0.16) than the auth sheet a click away — an invisible typo that the
	 * shared class settles.
	 */
	.tool-tray {
		padding: 20px;
		transform: rotate(1.2deg);
	}

	.tray-tape {
		position: absolute;
		top: -10px;
		width: 74px;
		height: 22px;
		background: rgba(243, 235, 216, 0.88);
		box-shadow: 0 1px 3px rgba(45, 36, 32, 0.18);
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
		width: 86px;
		height: 6px;
		margin: -4px 0 12px;
		rotate: -1deg;
	}

	.tray-section {
		margin-bottom: 16px;
		position: relative;
	}

	.tray-section-mobile-palette {
		z-index: 2;
	}

	.tray-label {
		font-family: var(--font-display);
		font-size: 0.62rem;
		font-weight: 700;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		color: var(--color-muted-ink);
		margin-bottom: 10px;
		display: flex;
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
		grid-template-columns: repeat(6, 1fr);
		gap: 9px 8px;
	}

	.palette-mobile-row {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: 0.7rem;
		overflow: visible;
		z-index: 6;
	}

	.palette-mobile-grid {
		display: grid;
		min-width: 0;
		flex: 1;
		grid-template-columns: repeat(6, minmax(0, 1fr));
		gap: 0.5rem;
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
		margin: 10px 0;
	}

	.brush-slider {
		-webkit-appearance: none;
		appearance: none;
		width: 100%;
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
		outline: none;
		cursor: pointer;
	}

	.brush-slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		margin-top: -1px;
		width: 20px;
		height: 20px;
		border: 2px solid var(--color-paper-bright);
		border-radius: 48% 52% 50% 50% / 52% 48% 54% 46%;
		background: radial-gradient(circle at 32% 28%, #c96a5b, var(--color-danger-deep) 55%, #6e211c);
		box-shadow: var(--shadow-chip);
		cursor: pointer;
	}

	.brush-slider::-moz-range-thumb {
		width: 20px;
		height: 20px;
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
		margin-top: 8px;
	}

	.test-scrap {
		position: relative;
		padding: 3px;
		background: var(--color-paper-bright);
		border: 1px solid var(--color-hairline);
		box-shadow: 2px 3px 7px rgba(0, 0, 0, 0.16);
		rotate: 3deg;
	}

	.test-scrap::before {
		content: '';
		position: absolute;
		top: -6px;
		left: 10px;
		width: 26px;
		height: 10px;
		background: rgba(243, 235, 216, 0.9);
		rotate: -4deg;
		box-shadow: 0 1px 2px rgba(45, 36, 32, 0.15);
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

	.tray-sep {
		height: 1px;
		background: linear-gradient(90deg, transparent, rgba(47, 36, 28, 0.14), transparent);
		margin: 14px 0;
	}

	/* --- Action buttons --- */

	.tray-actions {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.tray-edge-print {
		margin: 14px 0 -6px;
		text-align: center;
		font-family: var(--font-display);
		font-size: 0.5rem;
		font-weight: 600;
		letter-spacing: 0.26em;
		text-transform: uppercase;
		color: rgba(138, 108, 82, 0.55);
	}

	.tool-tray-mobile {
		transform: rotate(0.8deg);
	}

	@media (max-width: 700px) {
		.tool-tray-mobile {
			padding: 18px 16px;
		}

		.palette-mobile-row {
			gap: 0.65rem;
		}

		.palette-mobile-grid {
			gap: 0.45rem;
		}
	}
</style>
