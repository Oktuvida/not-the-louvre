<script lang="ts">
	import { ChevronDown, ChevronUp, ImageUp, Palette, Trash2 } from 'lucide-svelte';
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

	let mobilePaletteExpanded = $state(false);
	const compactPalette = drawingPalette.slice(0, 6);
	const expandedPalette = drawingPalette.slice(compactPalette.length);

	const selectColor = (color: string) => {
		drawingTools.activeColor = color;
		if (mobile) {
			mobilePaletteExpanded = false;
		}
	};
</script>

<div class:tool-tray-mobile={mobile} class="tool-tray">
	<div class="tray-glow" aria-hidden="true"></div>

	<!-- Palette section -->
	<div class:tray-section-mobile-palette={mobile} class="tray-section">
		<div class="tray-label">
			<Palette size={12} />
			<span>Colors</span>
		</div>
		{#if mobile}
			<div class:palette-mobile-row-expanded={mobilePaletteExpanded} class="palette-mobile-row">
				<div class="palette-mobile-grid">
					{#each compactPalette as color (color)}
						<button
							type="button"
							class="palette-swatch"
							class:active={drawingTools.activeColor === color}
							style={`--swatch-color:${color}`}
							onclick={() => selectColor(color)}
							aria-label={`Select color ${color}`}
						></button>
					{/each}
				</div>

				{#if mobilePaletteExpanded && expandedPalette.length > 0}
					<div
						class="palette-popover"
						role="dialog"
						aria-label="Additional colors"
					>
						<div class="palette-popover-scroller">
							<div class="palette-popover-strip">
								{#each expandedPalette as color (color)}
									<button
										type="button"
										class="palette-swatch palette-swatch-popover"
										class:active={drawingTools.activeColor === color}
										style={`--swatch-color:${color}`}
										onclick={() => selectColor(color)}
										aria-label={`Select color ${color}`}
									></button>
								{/each}
							</div>
						</div>
					</div>
				{/if}
			</div>

			<button
				type="button"
				class="palette-expand-button"
				aria-expanded={mobilePaletteExpanded}
				aria-label={mobilePaletteExpanded ? 'Collapse additional colors' : 'Expand additional colors'}
				onclick={() => {
					mobilePaletteExpanded = !mobilePaletteExpanded;
				}}
			>
				<span class="palette-expand-label">
					<span class="palette-expand-preview" style={`--swatch-color:${drawingTools.activeColor}`}></span>
					{mobilePaletteExpanded ? 'Hide palette' : 'More colors'}
				</span>
				{#if mobilePaletteExpanded}
					<ChevronDown size={14} />
				{:else}
					<ChevronUp size={14} />
				{/if}
			</button>
		{:else}
			<div class="palette-grid">
				{#each drawingPalette as color (color)}
					<button
						type="button"
						class="palette-swatch"
						class:active={drawingTools.activeColor === color}
						style={`--swatch-color:${color}`}
						onclick={() => selectColor(color)}
						aria-label={`Select color ${color}`}
					></button>
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
				class="brush-slider"
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
			<div class="brush-preview-shell">
				<div
					class="brush-dot"
					style={`width: ${Math.max(4, Math.min(28, drawingTools.brushSize))}px; height: ${Math.max(4, Math.min(28, drawingTools.brushSize))}px; background: ${drawingTools.activeColor};`}
				></div>
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
			<span>{isPublishing ? 'Publishing...' : 'Publish'}</span>
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
</div>

<style>
	.tool-tray {
		background: linear-gradient(180deg, rgb(251 247 240 / 0.97), rgb(245 235 220 / 0.97));
		border: 3px solid var(--color-ink, #2f241c);
		border-radius: 16px;
		padding: 20px;
		box-shadow:
			0 12px 32px rgb(47 36 28 / 0.18),
			inset 0 1px 0 rgb(255 255 255 / 0.5);
		transform: rotate(1.5deg);
		position: relative;
		overflow: hidden;
	}

	.tray-glow {
		position: absolute;
		inset: 0;
		background: radial-gradient(circle at 30% 20%, rgb(255 255 255 / 0.35), transparent 60%);
		pointer-events: none;
	}

	.tray-section {
		margin-bottom: 16px;
		position: relative;
	}

	.tray-section-mobile-palette {
		z-index: 2;
	}

	.tray-label {
		font-family: var(--font-display, 'Fredoka', sans-serif);
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 2.5px;
		text-transform: uppercase;
		color: var(--color-muted, #6f6257);
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

	/* --- Palette grid: 6 columns x 3 rows --- */

	.palette-grid {
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		gap: 6px;
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

	.palette-mobile-row-expanded {
		z-index: 10;
	}

	.palette-mobile-grid {
		display: grid;
		min-width: 0;
		flex: 1;
		grid-template-columns: repeat(6, minmax(0, 1fr));
		gap: 0.45rem;
	}

	.palette-swatch {
		width: 100%;
		aspect-ratio: 1;
		border-radius: 8px;
		border: 2.5px solid var(--color-ink, #2f241c);
		background-color: var(--swatch-color);
		cursor: pointer;
		transition:
			transform 0.15s,
			box-shadow 0.15s;
		position: relative;
		padding: 0;
	}

	.palette-swatch:hover {
		transform: scale(1.08);
	}

	.palette-swatch.active {
		transform: scale(1.12);
		box-shadow:
			0 0 0 2.5px #f4c430,
			0 3px 8px rgb(244 196 48 / 0.3);
		z-index: 1;
	}

	/* Gloss highlight */
	.palette-swatch::after {
		content: '';
		position: absolute;
		top: 2px;
		left: 2px;
		right: 40%;
		height: 35%;
		border-radius: 4px 4px 50% 0;
		background: linear-gradient(180deg, rgb(255 255 255 / 0.3), transparent);
		pointer-events: none;
	}

	.palette-expand-button {
		display: inline-flex;
		width: 100%;
		align-items: center;
		justify-content: space-between;
		gap: 0.55rem;
		border-radius: 12px;
		border: 2.5px solid var(--color-ink, #2f241c);
		background: rgb(255 250 241 / 0.92);
		padding: 0.6rem 0.75rem;
		font-family: var(--font-body, 'Baloo 2', sans-serif);
		font-size: 0.78rem;
		font-weight: 600;
		color: var(--color-ink, #2f241c);
		box-shadow: 0 8px 20px rgb(47 36 28 / 0.12);
	}

	.palette-expand-label {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
	}

	.palette-expand-preview {
		width: 1rem;
		height: 1rem;
		flex-shrink: 0;
		border-radius: 9999px;
		border: 2px solid var(--color-ink, #2f241c);
		background: var(--swatch-color);
	}

	.palette-popover {
		position: absolute;
		right: 0;
		bottom: calc(100% + 0.8rem);
		left: 0;
		z-index: 30;
		border: 3px solid var(--color-ink, #2f241c);
		border-radius: 16px;
		background: linear-gradient(180deg, rgb(251 247 240 / 0.98), rgb(245 235 220 / 0.98));
		padding: 0.85rem;
		box-shadow:
			0 18px 32px rgb(47 36 28 / 0.16),
			inset 0 1px 0 rgb(255 255 255 / 0.45);
		animation: palettePopoverRise 180ms cubic-bezier(0.22, 1, 0.36, 1) both;
		transform-origin: bottom center;
	}

	.palette-popover-scroller {
		overflow-x: auto;
		overflow-y: visible;
		padding-bottom: 0.1rem;
		-ms-overflow-style: none;
		scrollbar-width: none;
		-webkit-overflow-scrolling: touch;
	}

	.palette-popover-scroller::-webkit-scrollbar {
		display: none;
	}

	.palette-popover-strip {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: minmax(2.9rem, 2.9rem);
		gap: 0.55rem;
		width: max-content;
	}

	.palette-swatch-popover {
		width: 2.9rem;
	}

	@keyframes palettePopoverRise {
		from {
			opacity: 0;
			transform: translateY(0.6rem) scale(0.96);
		}

		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	/* --- Brush size slider --- */

	.slider-wrapper {
		position: relative;
		margin: 10px 0;
	}

	.brush-slider {
		-webkit-appearance: none;
		appearance: none;
		width: 100%;
		height: 5px;
		border-radius: 2.5px;
		background: linear-gradient(
			90deg,
			#d9b07b 0%,
			#d4834a var(--slider-pct, 30%),
			rgb(47 36 28 / 0.1) var(--slider-pct, 30%),
			rgb(47 36 28 / 0.1) 100%
		);
		outline: none;
		cursor: pointer;
	}

	.brush-slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: #fdfbf7;
		border: 2.5px solid var(--color-ink, #2f241c);
		box-shadow: 0 2px 6px rgb(43 38 34 / 0.2);
		cursor: pointer;
	}

	.brush-slider::-moz-range-thumb {
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: #fdfbf7;
		border: 2.5px solid var(--color-ink, #2f241c);
		box-shadow: 0 2px 6px rgb(43 38 34 / 0.2);
		cursor: pointer;
	}

	/* --- Brush preview --- */

	.brush-preview {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		margin-top: 6px;
	}

	.brush-preview-shell {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		border: 1.5px solid rgb(47 36 28 / 0.1);
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgb(255 255 255 / 0.4);
	}

	.brush-dot {
		border-radius: 50%;
		transition:
			width 0.15s,
			height 0.15s;
	}

	.brush-size-text {
		font-family: var(--font-body, 'Baloo 2', sans-serif);
		font-size: 12px;
		color: var(--color-muted, #6f6257);
		font-weight: 600;
	}

	/* --- Separator --- */

	.tray-sep {
		height: 1px;
		background: linear-gradient(90deg, transparent, rgb(47 36 28 / 0.1), transparent);
		margin: 14px 0;
	}

	/* --- Action buttons --- */

	.tray-actions {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.tool-tray-mobile {
		overflow: visible;
		transform: rotate(0.8deg);
	}

	@media (max-width: 700px) {
		.tool-tray-mobile {
			padding: 18px 16px;
		}

		.palette-expand-button {
			padding-inline: 0.65rem;
		}

		.palette-mobile-row {
			gap: 0.65rem;
		}

		.palette-mobile-grid {
			gap: 0.4rem;
		}

		.palette-swatch {
			min-height: 2.45rem;
		}

		.palette-popover {
			padding: 0.75rem;
		}

		.palette-popover-strip {
			grid-auto-columns: minmax(2.75rem, 2.75rem);
		}

		.palette-swatch-popover {
			width: 2.75rem;
		}
	}
</style>
