<script lang="ts">
	import type { Snippet } from 'svelte';

	export type BookStageState = 'closed' | 'opening' | 'open';

	let {
		children,
		coverBack,
		pageFields,
		onOpened,
		onOpenRequest,
		openingDurationMs = 950,
		stageState
	}: {
		children?: Snippet;
		coverBack?: Snippet;
		pageFields?: Snippet;
		onOpened?: () => void;
		onOpenRequest?: () => void;
		openingDurationMs?: number;
		stageState: BookStageState;
	} = $props();

	let effectiveOpeningDurationMs = $derived(openingDurationMs);
	let stageStatus = $derived(
		stageState === 'closed'
			? 'Closed sketchbook. Activate to begin drawing.'
			: stageState === 'opening'
				? 'Sketchbook opening.'
				: 'Sketchbook open. Drawing surface ready.'
	);

	$effect(() => {
		if (stageState !== 'opening') {
			return;
		}

		const timer = window.setTimeout(() => {
			onOpened?.();
		}, effectiveOpeningDurationMs);

		return () => {
			window.clearTimeout(timer);
		};
	});
</script>

<section
	class="book-shell"
	data-state={stageState}
	style={`--book-open-duration:${effectiveOpeningDurationMs}ms;`}
>
	<p class="sr-only" aria-live="polite">{stageStatus}</p>

	<div class="book-perspective">
		<div class="book-floor-shadow" aria-hidden="true"></div>
		<div class="book-block">
			<div class="book-spread">
				<!-- Spine -->
				<div class="book-spine" aria-hidden="true"></div>

				<!-- Inside cover decorative peek -->
				<div class="inside-cover" aria-hidden="true">
					<div class="inside-cover-content">
						<div class="inside-cover-ornament"></div>
						<span class="inside-cover-text">Not the Louvre</span>
						<div class="inside-cover-ornament"></div>
						<div class="inside-cover-circle">
							<div class="inside-cover-dot"></div>
						</div>
					</div>
					{@render coverBack?.()}
				</div>

				<!-- Main page -->
				<div class="page canvas-page">
					<div class="canvas-window">
						{@render children?.()}
					</div>
					{#if pageFields}
						<div class="page-fields">
							{@render pageFields()}
						</div>
					{/if}
				</div>
			</div>

			<div class="book-cover">
				<button
					type="button"
					class="cover-front"
					onclick={onOpenRequest}
					disabled={stageState !== 'closed'}
					aria-label="Open sketchbook"
				>
					<div class="cover-surface" aria-hidden="true"></div>
					<div class="cover-border-outer" aria-hidden="true"></div>
					<div class="cover-border-inner" aria-hidden="true"></div>
					<div class="cover-spine-strip" aria-hidden="true"></div>
					<div class="cover-strap" aria-hidden="true">
						<span class="cover-strap-text">Sketch & Create</span>
					</div>
					<div class="cover-title-area">
						<strong class="cover-title">Sketchbook</strong>
						<div class="cover-divider" aria-hidden="true"></div>
						<span class="cover-subtitle">Not the Louvre</span>
					</div>
					<span class="cover-invite">Tap the cover to begin</span>
				</button>
				<div class="cover-back-face" aria-hidden="true"></div>
			</div>
		</div>
	</div>
</section>

<style>
	.book-shell {
		display: inline-flex;
		height: 100%;
	}

	.book-perspective {
		position: relative;
		perspective: 2400px;
		height: 100%;
		display: flex;
		flex-direction: column;
		justify-content: center;
		padding: 0.75rem 0 1.5rem;
	}

	.book-floor-shadow {
		position: absolute;
		left: 8%;
		right: 8%;
		bottom: 0.4rem;
		height: 2rem;
		border-radius: 9999px;
		background:
			radial-gradient(circle at center, rgb(70 48 29 / 0.35), transparent 68%),
			linear-gradient(90deg, transparent, rgb(70 48 29 / 0.14), transparent);
		filter: blur(12px);
	}

	.book-block {
		position: relative;
		flex: 1;
		min-height: 0;
		width: fit-content;
		padding: clamp(0.5rem, 1vw, 1rem);
	}

	/* --- Book spread (open state interior) --- */

	.book-spread {
		position: relative;
		display: flex;
		width: fit-content;
		height: 100%;
		border: 3px solid #8a8078;
		border-radius: 0.375rem 1rem 1rem 0.375rem;
		background: #fbf7f0;
		box-shadow:
			inset 0 0 0 1px rgb(255 255 255 / 0.25),
			0 1.5rem 3rem rgb(47 36 28 / 0.2);
		overflow: hidden;
	}

	/* --- Spine --- */

	.book-spine {
		flex-shrink: 0;
		width: 14px;
		background: linear-gradient(
			90deg,
			#8a8078 0%,
			#9e968d 20%,
			#7a736b 40%,
			#6e675f 50%,
			#7a736b 60%,
			#9e968d 80%,
			#8a8078 100%
		);
		position: relative;
		z-index: 2;
		box-shadow:
			2px 0 8px rgb(0 0 0 / 0.15),
			-1px 0 3px rgb(0 0 0 / 0.1);
	}

	.book-spine::before {
		content: '';
		position: absolute;
		inset: 8px 3px;
		border-left: 1px solid rgb(255 255 255 / 0.12);
		border-right: 1px solid rgb(0 0 0 / 0.08);
	}

	.book-spine::after {
		content: '';
		position: absolute;
		top: 12px;
		bottom: 12px;
		left: 50%;
		width: 1px;
		background: repeating-linear-gradient(
			180deg,
			transparent,
			transparent 4px,
			rgb(255 255 255 / 0.1) 4px,
			rgb(255 255 255 / 0.1) 5px
		);
	}

	/* --- Inside cover decorative peek --- */

	.inside-cover {
		display: flex;
		flex-direction: column;
		flex-shrink: 0;
		width: 72px;
		background: linear-gradient(135deg, #c6b69a, #b8a88e, #a89878);
		border-top: 2px solid #8a8078;
		border-bottom: 2px solid #8a8078;
		position: relative;
		overflow: hidden;
	}

	/* Subtle cross-hatch texture overlay */
	.inside-cover::before {
		content: '';
		position: absolute;
		inset: 0;
		background:
			repeating-linear-gradient(
				0deg,
				transparent,
				transparent 18px,
				rgb(140 124 96 / 0.12) 18px,
				rgb(140 124 96 / 0.12) 19px
			),
			repeating-linear-gradient(
				90deg,
				transparent,
				transparent 14px,
				rgb(140 124 96 / 0.06) 14px,
				rgb(140 124 96 / 0.06) 15px
			);
		pointer-events: none;
	}

	/* Right edge shadow */
	.inside-cover::after {
		content: '';
		position: absolute;
		right: 0;
		top: 0;
		bottom: 0;
		width: 12px;
		background: linear-gradient(90deg, transparent, rgb(0 0 0 / 0.06));
		pointer-events: none;
	}

	.inside-cover-content {
		position: relative;
		z-index: 1;
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 16px 8px;
		gap: 8px;
	}

	.inside-cover-ornament {
		width: 1px;
		height: 30px;
		background: linear-gradient(180deg, transparent, rgb(111 98 87 / 0.25), transparent);
	}

	.inside-cover-text {
		writing-mode: vertical-rl;
		transform: rotate(180deg);
		font-family: var(--font-display, 'Fredoka', sans-serif);
		font-size: 7px;
		letter-spacing: 3px;
		text-transform: uppercase;
		color: rgb(111 98 87 / 0.35);
	}

	.inside-cover-circle {
		width: 20px;
		height: 20px;
		border: 1px solid rgb(111 98 87 / 0.15);
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.inside-cover-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: rgb(111 98 87 / 0.15);
	}

	/* --- Main page --- */

	.page {
		position: relative;
		border-radius: 0 0.5rem 0.5rem 0;
		background: #fbf7f0;
		border-left: 1px solid rgb(138 128 120 / 0.3);
	}

	/* Page aging — corner gradients */
	.page::before {
		content: '';
		position: absolute;
		inset: 0;
		background:
			radial-gradient(ellipse at 0% 0%, rgb(200 185 160 / 0.15) 0%, transparent 50%),
			radial-gradient(ellipse at 100% 100%, rgb(200 185 160 / 0.12) 0%, transparent 40%),
			radial-gradient(ellipse at 50% 50%, transparent 60%, rgb(200 185 160 / 0.08) 100%);
		pointer-events: none;
		z-index: 3;
		border-radius: inherit;
	}

	/* Left edge darkening */
	.page::after {
		content: '';
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 20px;
		background: linear-gradient(90deg, rgb(180 170 155 / 0.1), transparent);
		pointer-events: none;
		z-index: 3;
		border-radius: inherit;
	}

	.canvas-page {
		display: flex;
		flex-shrink: 0;
		min-width: 0;
		flex-direction: column;
		padding: clamp(0.75rem, 1.5vw, 1.125rem);
		height: 100%;
		aspect-ratio: 10 / 12;
	}

	.canvas-window {
		position: relative;
		z-index: 2;
		display: flex;
		flex: 1;
		min-height: 0;
		align-items: center;
		justify-content: center;
	}

	/* --- Fields below canvas --- */

	.page-fields {
		position: relative;
		z-index: 2;
		margin-top: clamp(0.5rem, 1vw, 0.875rem);
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	/* --- Book cover (3D flip) — sandstone surface --- */

	.book-cover {
		position: absolute;
		inset: clamp(0.5rem, 1vw, 1rem);
		border-radius: 0.375rem 1rem 1rem 0.375rem;
		background: linear-gradient(145deg, #c6b69a 0%, #b8a88e 30%, #a89878 60%, #9e8e72 100%);
		box-shadow:
			inset 0 0 0 2px rgb(255 248 230 / 0.14),
			inset -22px 0 30px rgb(0 0 0 / 0.08),
			0 1.6rem 3rem rgb(47 36 28 / 0.3);
		color: #fbf7f0;
		text-align: left;
		transform-origin: left center;
		transform-style: preserve-3d;
		transition:
			transform var(--book-open-duration) cubic-bezier(0.23, 1, 0.32, 1),
			box-shadow var(--book-open-duration) ease;
		z-index: 5;
	}

	.cover-front {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		padding: clamp(1.2rem, 2.5vw, 2rem);
		border: 0;
		border-radius: inherit;
		background: transparent;
		color: inherit;
		text-align: center;
		backface-visibility: hidden;
		cursor: pointer;
	}

	.cover-front:disabled {
		cursor: default;
	}

	.cover-front:focus-visible {
		outline: 3px solid #f4c430;
		outline-offset: 5px;
	}

	/* Sandstone texture overlay on cover */
	.cover-surface {
		position: absolute;
		inset: 0;
		border-radius: inherit;
		background: repeating-linear-gradient(
			45deg,
			transparent,
			transparent 3px,
			rgb(255 255 255 / 0.02) 3px,
			rgb(255 255 255 / 0.02) 6px
		);
		mix-blend-mode: overlay;
		pointer-events: none;
	}

	.cover-surface::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		background:
			radial-gradient(ellipse at 30% 20%, rgb(255 248 230 / 0.18), transparent 50%),
			radial-gradient(ellipse at 80% 80%, rgb(0 0 0 / 0.08), transparent 50%);
		pointer-events: none;
	}

	.cover-border-outer {
		position: absolute;
		inset: 0;
		border: 3px solid #8a8078;
		border-radius: inherit;
		pointer-events: none;
	}

	.cover-border-inner {
		position: absolute;
		inset: 10px;
		border: 1px solid rgb(111 98 87 / 0.2);
		border-radius: 0.375rem;
		pointer-events: none;
	}

	.cover-spine-strip {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 12px;
		background: linear-gradient(90deg, #8a8078, #9e968d, #8a8078);
		border-radius: 0.375rem 0 0 0.375rem;
		box-shadow: 2px 0 6px rgb(0 0 0 / 0.1);
		pointer-events: none;
	}

	.cover-spine-strip::after {
		content: '';
		position: absolute;
		top: 16px;
		bottom: 16px;
		left: 50%;
		width: 1px;
		background: repeating-linear-gradient(
			180deg,
			transparent,
			transparent 5px,
			rgb(255 255 255 / 0.12) 5px,
			rgb(255 255 255 / 0.12) 6px
		);
	}

	/* Cover strap band */
	.cover-strap {
		position: absolute;
		top: 52%;
		left: 14px;
		right: 0;
		transform: translateY(-50%);
		height: 34px;
		background: linear-gradient(180deg, #918779, #7e756a, #918779);
		border-top: 1px solid rgb(255 255 255 / 0.1);
		border-bottom: 1px solid rgb(0 0 0 / 0.08);
		display: flex;
		align-items: center;
		justify-content: center;
		pointer-events: none;
	}

	.cover-strap-text {
		font-family: var(--font-display, 'Fredoka', sans-serif);
		font-size: 8px;
		letter-spacing: 4px;
		text-transform: uppercase;
		color: rgb(251 247 240 / 0.45);
	}

	.cover-title-area {
		position: relative;
		z-index: 5;
		text-align: center;
		margin-bottom: 40px;
	}

	.cover-title {
		font-family: Georgia, 'Times New Roman', serif;
		font-size: clamp(1.2rem, 3vw, 1.4rem);
		color: rgb(251 247 240 / 0.8);
		letter-spacing: 1px;
		text-shadow: 0 1px 3px rgb(0 0 0 / 0.15);
		line-height: 1;
	}

	.cover-divider {
		width: 40px;
		height: 1px;
		background: linear-gradient(90deg, transparent, rgb(251 247 240 / 0.3), transparent);
		margin: 8px auto;
	}

	.cover-subtitle {
		font-family: var(--font-display, 'Fredoka', sans-serif);
		font-size: 9px;
		letter-spacing: 3px;
		text-transform: uppercase;
		color: rgb(251 247 240 / 0.35);
	}

	.cover-invite {
		position: absolute;
		bottom: clamp(1rem, 2vw, 1.5rem);
		left: 50%;
		transform: translateX(-50%);
		max-width: 16ch;
		font-size: clamp(0.75rem, 1.2vw, 0.95rem);
		line-height: 1.5;
		color: rgb(251 247 240 / 0.5);
		white-space: nowrap;
	}

	.cover-back-face {
		position: absolute;
		inset: 0;
		border-radius: inherit;
		background: linear-gradient(135deg, #c6b69a 0%, #b8a88e 40%, #a89878 100%);
		backface-visibility: hidden;
		transform: rotateY(180deg);
	}

	.book-shell[data-state='opening'] .book-cover,
	.book-shell[data-state='open'] .book-cover {
		transform: rotateY(-180deg);
		box-shadow:
			inset 0 0 0 2px rgb(255 248 230 / 0.1),
			0 1rem 2rem rgb(47 36 28 / 0.16);
	}

	.book-shell[data-state='open'] .book-cover {
		pointer-events: none;
	}

	/* --- Responsive --- */

	@media (max-width: 700px) {
		.book-block {
			padding: 0.4rem;
		}

		.book-spread {
			border-radius: 0.25rem 0.75rem 0.75rem 0.25rem;
		}

		.book-spine {
			width: 10px;
		}

		.inside-cover {
			width: 48px;
		}

		.canvas-page {
			padding: 1rem;
		}

		.cover-invite {
			font-size: 0.78rem;
		}

		.book-cover strong {
			font-size: clamp(1.2rem, 9vw, 1.4rem);
		}

		.book-cover {
			border-radius: 0.25rem 0.75rem 0.75rem 0.25rem;
		}
	}
</style>
