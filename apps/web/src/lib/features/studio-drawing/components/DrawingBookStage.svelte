<script lang="ts">
	import type { Snippet } from 'svelte';

	export type BookStageState = 'closed' | 'opening' | 'open' | 'closing';

	let {
		children,
		coverBack,
		coverFields,
		onClosed,
		onOpened,
		onOpenRequest,
		openingDurationMs = 950,
		stageState
	}: {
		children?: Snippet;
		coverBack?: Snippet;
		coverFields?: Snippet;
		onClosed?: () => void;
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
				: stageState === 'closing'
					? 'Sketchbook closing.'
					: 'Sketchbook open. Drawing surface ready.'
	);

	$effect(() => {
		if (stageState !== 'opening' && stageState !== 'closing') {
			return;
		}

		const timer = window.setTimeout(() => {
			if (stageState === 'opening') {
				onOpened?.();
				return;
			}

			onClosed?.();
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
						<div class="canvas-square">
							{@render children?.()}
						</div>
					</div>
					<div class="page-tagline" aria-hidden="true">
						<span
							>U might get a very expensive frame, so try not to do a very questionable drawing.</span
						>
					</div>
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
					</div>
					<div class="cover-label" aria-hidden="true">
						<span class="cover-label-title">Not the Louvre</span>
						<div class="cover-label-line"></div>
						<span class="cover-label-sub">sketch & create</span>
					</div>
					<span class="cover-invite">Tap the cover to begin</span>
				</button>
				<div class="cover-back-face">
					{#if coverFields}
						<div class="cover-fields-area">
							{@render coverFields()}
						</div>
					{/if}
				</div>
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
		border: 3px solid #1a1611;
		border-radius: 2px;
		background: #fbf7f0;
		box-shadow:
			inset 0 0 0 1px rgb(255 255 255 / 0.06),
			0 1.5rem 3rem rgb(47 36 28 / 0.2);
		overflow: hidden;
	}

	/* --- Spine --- */

	.book-spine {
		flex-shrink: 0;
		width: 14px;
		background: linear-gradient(
			90deg,
			#1a1611 0%,
			#252019 20%,
			#2a241c 50%,
			#252019 80%,
			#1a1611 100%
		);
		position: relative;
		z-index: 2;
		box-shadow:
			2px 0 10px rgb(0 0 0 / 0.3),
			-2px 0 10px rgb(0 0 0 / 0.3);
	}

	.book-spine::before {
		content: '';
		position: absolute;
		inset: 8px 3px;
		border-left: 1px solid rgb(255 255 255 / 0.04);
		border-right: 1px solid rgb(0 0 0 / 0.15);
	}

	.book-spine::after {
		content: '';
		position: absolute;
		top: 14px;
		bottom: 14px;
		left: 50%;
		width: 1px;
		background: repeating-linear-gradient(
			180deg,
			transparent,
			transparent 5px,
			rgb(212 131 74 / 0.15) 5px,
			rgb(212 131 74 / 0.15) 6px
		);
	}

	/* --- Inside cover decorative peek --- */

	.inside-cover {
		display: flex;
		flex-direction: column;
		flex-shrink: 0;
		width: 72px;
		background: #1e1a14;
		border-top: 2px solid #1a1611;
		border-bottom: 2px solid #1a1611;
		position: relative;
		overflow: hidden;
	}

	/* Subtle grid texture overlay */
	.inside-cover::before {
		content: '';
		position: absolute;
		inset: 0;
		background:
			repeating-linear-gradient(
				0deg,
				transparent,
				transparent 20px,
				rgb(255 255 255 / 0.015) 20px,
				rgb(255 255 255 / 0.015) 21px
			),
			repeating-linear-gradient(
				90deg,
				transparent,
				transparent 16px,
				rgb(255 255 255 / 0.01) 16px,
				rgb(255 255 255 / 0.01) 17px
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
		background: linear-gradient(90deg, transparent, rgb(0 0 0 / 0.15));
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
		background: linear-gradient(180deg, transparent, rgb(212 131 74 / 0.12), transparent);
	}

	.inside-cover-text {
		writing-mode: vertical-rl;
		transform: rotate(180deg);
		font-family: var(--font-display, 'Fredoka', sans-serif);
		font-size: 7px;
		letter-spacing: 3px;
		text-transform: uppercase;
		color: rgb(255 255 255 / 0.1);
	}

	.inside-cover-circle {
		width: 20px;
		height: 20px;
		border: 1px solid rgb(212 131 74 / 0.12);
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.inside-cover-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: rgb(212 131 74 / 0.15);
	}

	/* --- Main page --- */

	.page {
		position: relative;
		border-radius: 0;
		background: #fbf7f0;
		border-left: 1px solid rgb(30 26 20 / 0.15);
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
		width: 100%;
		align-self: center;
		align-items: center;
		justify-content: center;
		max-height: 100%;
	}

	.canvas-square {
		display: flex;
		width: 100%;
		height: auto;
		max-width: 100%;
		max-height: 100%;
		aspect-ratio: 1 / 1;
		align-items: stretch;
		justify-content: center;
		margin-block: auto;
	}

	/* --- Cover fields area (cover back post-its) --- */

	.cover-fields-area {
		position: relative;
		z-index: 2;
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: flex-start;
		align-items: flex-end;
		padding: 2rem;
		padding-top: 10rem;
		/* padding: clamp(16px, 1.5vw, 18px); */
		gap: 2rem;
	}

	/* --- Tagline below canvas --- */

	.page-tagline {
		position: relative;
		z-index: 2;
		margin-top: 0;
		text-align: center;
		font-family: 'Caveat', cursive;
		font-size: 7;
		color: rgba(80, 71, 63, 0.806);
		font-style: italic;
		line-height: 7;
	}

	/* --- Book cover (3D flip) — cloth surface --- */

	.book-cover {
		position: absolute;
		inset: clamp(0.5rem, 1vw, 1rem);
		border-radius: 3px 6px 6px 3px;
		background: linear-gradient(155deg, #e8e0d4 0%, #ddd5c8 30%, #d5cdc0 60%, #cec5b8 100%);
		box-shadow:
			inset 0 0 0 1px rgb(255 255 255 / 0.3),
			inset -3px 0 15px rgb(0 0 0 / 0.06),
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

	.cover-front:active {
		transform: none !important;
	}

	/* Apply the press feedback to the whole cover instead of the inner button contents. */
	.book-cover:has(.cover-front:active) {
		transform: scale(0.985);
	}

	/* Linen cloth texture overlay on cover */
	.cover-surface {
		position: absolute;
		inset: 0;
		border-radius: inherit;
		background: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.5' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.07'/%3E%3C/svg%3E");
		mix-blend-mode: multiply;
		pointer-events: none;
	}

	.cover-surface::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		background: radial-gradient(ellipse at 35% 25%, rgb(255 255 255 / 0.12), transparent 55%);
		pointer-events: none;
	}

	.cover-border-outer {
		position: absolute;
		inset: 0;
		border: none;
		border-radius: inherit;
		pointer-events: none;
	}

	.cover-border-inner {
		position: absolute;
		inset: 10px;
		border: none;
		border-radius: 2px;
		pointer-events: none;
	}

	.cover-spine-strip {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 16px;
		background: linear-gradient(
			90deg,
			#1a1611 0%,
			#252019 30%,
			#2a241c 50%,
			#252019 70%,
			#1a1611 100%
		);
		border-radius: 0;
		box-shadow: 3px 0 12px rgb(0 0 0 / 0.3);
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
			rgb(212 131 74 / 0.12) 5px,
			rgb(212 131 74 / 0.12) 6px
		);
	}

	/* Cover elastic band (replaces old strap) */
	.cover-strap {
		position: absolute;
		right: 9px;
		top: -4px;
		bottom: -4px;
		width: 3px;
		height: auto;
		transform: none;
		background: var(--color-primary, #d4834a);
		border: none;
		border-radius: 2px;
		display: block;
		box-shadow: 0 0 8px rgb(212 131 74 / 0.25);
		pointer-events: none;
		z-index: 6;
	}

	.cover-strap-text {
		display: none;
	}

	.cover-title-area {
		position: absolute;
		top: clamp(7rem, 3vw, 2rem);
		left: 50%;
		transform: translateX(-50%);
		z-index: 5;
		text-align: center;
		width: max-content;
	}

	.cover-title {
		font-family: var(--font-display, 'Fredoka', sans-serif);
		font-size: clamp(3rem, 9vw, 4.5rem);
		font-weight: 700;
		letter-spacing: 6px;
		text-transform: uppercase;
		color: transparent;
		-webkit-text-stroke: 1px rgb(160 150 135 / 0.45);
		text-shadow: 0 1px 0 rgb(255 255 255 / 0.35);
		line-height: 1;
	}

	/* Paper label sticker on cover */
	.cover-label {
		position: absolute;
		bottom: clamp(3.5rem, 12vh, 6rem);
		left: 50%;
		transform: translateX(-50%);
		background: #fbf7f0;
		border: 1px solid rgb(0 0 0 / 0.06);
		border-radius: 3px;
		box-shadow: 0 2px 6px rgb(0 0 0 / 0.1);
		padding: 14px 36px 12px;
		text-align: center;
		z-index: 5;
		white-space: nowrap;
	}

	.cover-label-title {
		font-family: var(--font-display, 'Fredoka', sans-serif);
		font-size: 1.3rem;
		font-weight: 600;
		letter-spacing: 4px;
		text-transform: uppercase;
		color: #2f241c;
		display: block;
	}

	.cover-label-line {
		width: 60px;
		height: 1px;
		background: rgb(47 36 28 / 0.12);
		margin: 6px auto;
	}

	.cover-label-sub {
		font-family: 'Caveat', cursive;
		font-size: 1.35rem;
		color: rgb(47 36 28 / 0.45);
	}

	.cover-invite {
		position: absolute;
		bottom: clamp(1rem, 2.5vw, 2rem);
		left: 50%;
		transform: translateX(-50%);
		max-width: 20ch;
		font-family: 'Caveat', cursive;
		font-size: 1.5rem;
		line-height: 1.5;
		color: rgba(33, 31, 29, 0.76);
		white-space: nowrap;
	}

	.cover-back-face {
		position: absolute;
		inset: 0;
		border-radius: inherit;
		background: linear-gradient(135deg, #e8e0d4 0%, #ddd5c8 40%, #cec5b8 100%);
		backface-visibility: hidden;
		transform: rotateY(180deg);
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	/* Linen texture on cover back */
	.cover-back-face::before {
		content: '';
		position: absolute;
		inset: 0;
		background: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.5' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.07'/%3E%3C/svg%3E");
		mix-blend-mode: multiply;
		pointer-events: none;
		z-index: 0;
	}

	.book-shell[data-state='opening'] .book-cover,
	.book-shell[data-state='open'] .book-cover {
		transform: rotateY(-180deg);
		box-shadow:
			inset 0 0 0 1px rgb(255 255 255 / 0.15),
			0 1rem 2rem rgb(47 36 28 / 0.16);
	}

	.book-shell[data-state='open'] .cover-front {
		pointer-events: none;
	}

	/* --- Responsive --- */

	@media (max-width: 700px) {
		.book-block {
			padding: 0.4rem;
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
			font-size: 0.9rem;
		}

		.cover-title {
			font-size: clamp(1.8rem, 9vw, 2.4rem);
			letter-spacing: 4px;
		}

		.cover-label {
			padding: 10px 20px 8px;
		}

		.cover-label-title {
			font-size: 0.9rem;
			letter-spacing: 2px;
		}

		.cover-label-sub {
			font-size: 1rem;
		}
	}
</style>
