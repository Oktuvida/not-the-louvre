<script lang="ts">
	import { untrack, type Snippet } from 'svelte';
	import { prefersReducedMotion } from '#lib/features/home-entry-scene/reduced-motion.js';

	// A 950ms 3D cover flip is the biggest motion on /draw. Under reduced motion it
	// becomes an instant cut: the same duration feeds `--book-open-duration` and the
	// unlock timer below, so CSS and callbacks stay in step either way.
	const REDUCED_MOTION_OPENING_DURATION_MS = 1;

	export type BookStageState = 'closed' | 'opening' | 'open' | 'closing';

	let {
		children,
		coverShown = $bindable(true),
		onClosed,
		onOpened,
		onOpenRequest,
		openingDurationMs = 950,
		stageState
	}: {
		children?: Snippet;
		/**
		 * Whether this screen's layout shows the cover at all. The studio layout
		 * (studio-layout.css) drops it where there is no room for an open book,
		 * and the page is then open from the start; this reads what the CSS
		 * decided rather than repeating its media queries.
		 */
		coverShown?: boolean;
		onClosed?: () => void;
		onOpened?: () => void;
		onOpenRequest?: () => void;
		openingDurationMs?: number;
		stageState: BookStageState;
	} = $props();

	let coverElement = $state<HTMLElement | null>(null);

	$effect(() => {
		const cover = coverElement;
		if (!cover) return;

		const readCover = () => {
			const shown = getComputedStyle(cover).display !== 'none';
			if (shown !== untrack(() => coverShown)) coverShown = shown;
		};
		readCover();
		window.addEventListener('resize', readCover);
		return () => window.removeEventListener('resize', readCover);
	});

	let effectiveOpeningDurationMs = $derived(
		prefersReducedMotion() ? REDUCED_MOTION_OPENING_DURATION_MS : openingDurationMs
	);
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
				<div class="inside-cover">
					<div class="inside-cover-content" aria-hidden="true">
						<div class="inside-cover-ornament"></div>
						<span class="inside-cover-text">Not the Louvre</span>
						<div class="inside-cover-ornament"></div>
						<div class="inside-cover-circle">
							<div class="inside-cover-dot"></div>
						</div>
					</div>
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

			<div class="book-cover" bind:this={coverElement}>
				<button
					type="button"
					class="cover-front focus-ring-cover"
					onclick={onOpenRequest}
					disabled={stageState !== 'closed'}
					aria-label="Open sketchbook"
				>
					<div class="cover-surface" aria-hidden="true"></div>
					<div class="cover-spine-strip" aria-hidden="true"></div>
					<!-- Leather corners, the block of pages showing past the board, and
					     the ribbon marker hanging out of the bottom. -->
					<span class="cover-corner cover-corner-top" aria-hidden="true"></span>
					<span class="cover-corner cover-corner-bottom" aria-hidden="true"></span>
					<span class="cover-pages cover-pages-side" aria-hidden="true"></span>
					<span class="cover-pages cover-pages-foot" aria-hidden="true"></span>
					<span class="cover-ribbon" aria-hidden="true"></span>
					<div class="cover-strap" aria-hidden="true"></div>
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
				<!-- The drawing's notes lie on this side once it opens; they are the
				     studio's own piece, placed over it by the layout. -->
				<div class="cover-back-face"></div>
			</div>
		</div>
	</div>
</section>

<style>
	.book-shell {
		/*
		 * The book's own linen tile — a coarser weave than the shared
		 * `.paper-grain` utility, so it stays local — declared once here and
		 * worn by both the front cover and the cover back.
		 */
		--book-linen: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.5' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.07'/%3E%3C/svg%3E");

		display: inline-flex;
	}

	.book-perspective {
		position: relative;
		perspective: 2400px;
		display: flex;
		flex-direction: column;
		justify-content: center;
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

	/* Every measure below comes from studio-layout.css; the fallbacks only keep
	 * the book in one piece if it is ever shown outside the studio. */
	.book-block {
		position: relative;
		width: fit-content;
		padding: var(--studio-book-edge, 0.5rem);
	}

	/* --- Book spread (open state interior) --- */

	.book-spread {
		position: relative;
		display: flex;
		width: fit-content;
		border: var(--studio-book-border, 3px) solid #1a1611;
		border-radius: var(--radius-hairline);
		background: var(--color-paper);
		box-shadow:
			inset 0 0 0 1px rgb(255 255 255 / 0.06),
			0 1.5rem 3rem rgb(47 36 28 / 0.2);
		overflow: hidden;
	}

	/* --- Spine --- */

	.book-spine {
		display: var(--studio-spine-display, block);
		flex-shrink: 0;
		width: var(--studio-spine, 14px);
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
		display: var(--studio-inside-cover-display, flex);
		flex-direction: column;
		flex-shrink: 0;
		width: var(--studio-inside-cover, 72px);
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
		font-family: var(--font-display);
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
		background: var(--color-paper);
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
		flex-direction: column;
		box-sizing: content-box;
		width: var(--studio-canvas, 30rem);
		padding: var(--studio-page-top, 1rem) var(--studio-page-pad, 1rem) 0;
	}

	.canvas-window {
		position: relative;
		z-index: 2;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	/* The drawing's own square: always as wide as it is tall. */
	.canvas-square {
		display: flex;
		width: var(--studio-canvas, 30rem);
		height: var(--studio-canvas, 30rem);
		align-items: stretch;
		justify-content: center;
	}

	/* --- Tagline below canvas --- */

	.page-tagline {
		display: var(--studio-tagline-display, block);
		position: relative;
		z-index: 2;
		box-sizing: border-box;
		height: var(--studio-page-foot, 3rem);
		margin-top: 0;
		padding-top: 0.65rem;
		text-align: center;
		font-family: var(--font-hand);
		/* `font-size: 7` is not a length, so it was dropped while the matching
		 * `line-height: 7` stood: a ~7-line box under the canvas, stealing height
		 * from `.canvas-window` (flex: 1) on every viewport. */
		font-size: 1rem;
		color: rgba(80, 71, 63, 0.806);
		font-style: italic;
		line-height: 1.35;
	}

	/* --- Book cover (3D flip) — cloth surface --- */

	.book-cover {
		display: var(--studio-cover-display, block);
		position: absolute;
		inset: var(--studio-book-edge, 0.5rem);
		border-radius: 3px 8px 8px 3px;
		/* Bookcloth: the weave's warp and weft, the light catching the top left
		 * and the board darkening towards the far corner. The same linen, spine
		 * and strap the sketchbook on the 3D studio's side table wears. */
		background-color: #d8cfc0;
		background-image:
			repeating-linear-gradient(0deg, rgb(80 64 44 / 0.07) 0 1px, transparent 1px 3px),
			repeating-linear-gradient(90deg, rgb(80 64 44 / 0.06) 0 1px, transparent 1px 3px),
			radial-gradient(ellipse at 30% 20%, rgb(255 255 255 / 0.25), transparent 55%),
			radial-gradient(ellipse at 100% 100%, rgb(60 40 20 / 0.18), transparent 50%);
		box-shadow:
			inset 0 0 0 1px rgb(255 255 255 / 0.3),
			inset -3px 0 15px rgb(0 0 0 / 0.06),
			0 1.6rem 3rem rgb(47 36 28 / 0.3);
		color: var(--color-paper);
		text-align: left;
		transform-origin: left center;
		transform-style: preserve-3d;
		transition:
			transform var(--book-open-duration) var(--ease-glide),
			box-shadow var(--book-open-duration) ease;
		z-index: 5;
	}

	.cover-front {
		/* The cover fills its book, so the ring needs room to clear the spine
		   and the leather edge. Colour comes from `focus-ring-cover`. */
		--focus-ring-offset: 5px;
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
		transition: opacity 160ms ease;
	}

	.cover-front:disabled {
		cursor: default;
	}

	.cover-front:active {
		transform: none;
		scale: 1;
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
		background: var(--book-linen);
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

	.cover-spine-strip {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 26px;
		background: linear-gradient(90deg, #2a221b, #3b3027 60%, #241d17);
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

	/* The leather corners that keep the board's edges from fraying. */
	.cover-corner {
		position: absolute;
		right: 0;
		width: 2.875rem;
		height: 2.875rem;
		pointer-events: none;
	}

	.cover-corner-top {
		top: 0;
		border-top-right-radius: 8px;
		background: linear-gradient(225deg, #3b3027 50%, transparent 50%);
	}

	.cover-corner-bottom {
		bottom: 0;
		border-bottom-right-radius: 8px;
		background: linear-gradient(315deg, #3b3027 50%, transparent 50%);
	}

	/* The pages' edges, just past the board on the open side and the foot.
	 * They sit outside the cover's box, so nothing of them lies over the cloth,
	 * and they turn away with the cover's front when it opens. */
	.cover-pages {
		position: absolute;
		background: repeating-linear-gradient(0deg, #f3ecdf 0 2px, #d9cfbe 2px 3px);
		pointer-events: none;
	}

	.cover-pages-side {
		top: 6px;
		right: -6px;
		bottom: -6px;
		width: 6px;
		border-radius: 0 3px 3px 0;
		background: repeating-linear-gradient(90deg, #f3ecdf 0 2px, #d9cfbe 2px 3px);
	}

	.cover-pages-foot {
		right: -6px;
		bottom: -6px;
		left: 10px;
		height: 6px;
		border-radius: 0 0 3px 3px;
	}

	/* The ribbon marker, hanging out of the foot of the pages. */
	.cover-ribbon {
		position: absolute;
		top: calc(100% + 6px);
		left: 70%;
		width: 1.25rem;
		height: 2.25rem;
		background: linear-gradient(90deg, #8f2a22, #b5473c 50%, #8f2a22);
		clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 80%, 0 100%);
		pointer-events: none;
	}

	/* The elastic band that keeps the book shut. */
	.cover-strap {
		position: absolute;
		top: -4px;
		right: 11%;
		bottom: -4px;
		width: 12px;
		border-radius: 6px;
		background: linear-gradient(90deg, #b8642f, #e08a4c 45%, #b8642f);
		box-shadow: 3px 0 6px rgb(0 0 0 / 0.35);
		pointer-events: none;
		z-index: 6;
	}

	.cover-title-area {
		position: absolute;
		/* Was `clamp(7rem, 3vw, 2rem)`: min above max, so it resolved to a flat
		 * 7rem at every width. The cap keeps the offset the wide cover ships with
		 * and the preferred value now lets the title ride up on narrow ones. */
		top: clamp(2rem, 8vw, 7rem);
		left: 50%;
		transform: translateX(-50%);
		z-index: 5;
		text-align: center;
		width: max-content;
	}

	.cover-title {
		font-family: var(--font-display);
		font-size: clamp(3rem, 9vw, 4.5rem);
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		/* Pressed into the cloth: a faint darkening where the die bit, lit along
		 * its lower edge and shadowed along its upper one. The colour itself
		 * stays transparent, so the deboss is decoration, not low-contrast text. */
		color: transparent;
		-webkit-text-fill-color: rgb(120 100 70 / 0.1);
		text-shadow:
			0 1px 0 rgb(255 255 255 / 0.55),
			0 -1px 0 rgb(70 55 35 / 0.35);
		line-height: 1;
	}

	/* Paper label sticker on cover */
	.cover-label {
		position: absolute;
		bottom: clamp(3.5rem, 12vh, 6rem);
		left: 50%;
		transform: translateX(-50%);
		background: #fdfbf7;
		border: 1px solid rgb(0 0 0 / 0.06);
		border-radius: 3px;
		box-shadow: 0 2px 5px rgb(0 0 0 / 0.18);
		padding: 14px 36px 12px;
		rotate: -1deg;
		text-align: center;
		z-index: 5;
		white-space: nowrap;
	}

	.cover-label-title {
		font-family: var(--font-display);
		font-size: 1.3rem;
		font-weight: 600;
		letter-spacing: 4px;
		text-transform: uppercase;
		color: var(--color-ink);
		display: block;
	}

	.cover-label-line {
		width: 60px;
		height: 1px;
		background: rgb(47 36 28 / 0.12);
		margin: 6px auto;
	}

	.cover-label-sub {
		font-family: var(--font-hand);
		font-size: 1.35rem;
		color: rgb(47 36 28 / 0.45);
	}

	.cover-invite {
		position: absolute;
		bottom: clamp(1rem, 2.5vw, 2rem);
		left: 50%;
		transform: translateX(-50%);
		max-width: 20ch;
		font-family: var(--font-hand);
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
		background: var(--book-linen);
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

	.book-shell[data-state='opening'] .cover-front,
	.book-shell[data-state='open'] .cover-front {
		opacity: 0;
	}
</style>
