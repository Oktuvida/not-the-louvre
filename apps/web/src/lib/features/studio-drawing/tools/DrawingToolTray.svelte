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
		onPublish,
		onClear
	}: {
		isPublishing?: boolean;
		onPublish?: () => void;
		onClear?: () => void;
	} = $props();
</script>

<div class="tool-tray">
	<div class="tray-glow" aria-hidden="true"></div>

	<!-- Palette section -->
	<div class="tray-section">
		<div class="tray-label">
			<Palette size={12} />
			<span>Colors</span>
		</div>
		<div class="palette-grid">
			{#each drawingPalette as color (color)}
				<button
					type="button"
					class="palette-swatch"
					class:active={drawingTools.activeColor === color}
					style={`--swatch-color:${color}`}
					onclick={() => {
						drawingTools.activeColor = color;
					}}
					aria-label={`Select color ${color}`}
				></button>
			{/each}
		</div>
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
</style>
