<script lang="ts">
	import { untrack, type Snippet } from 'svelte';
	import { on } from 'svelte/events';
	import bookclothUrl from '#lib/assets/sketchbook/bookcloth.webp';
	import coverWearUrl from '#lib/assets/sketchbook/cover-wear.webp';
	import { prefersReducedMotion } from '#lib/features/home-entry-scene/reduced-motion.js';
	import { SKETCHBOOK_COVER } from '#lib/features/shared-ui/sketchbook/cover.js';

	// A 950ms 3D cover flip is the biggest motion on /draw. Under reduced motion it
	// becomes an instant cut: the same duration feeds `--book-open-duration` and the
	// unlock timer below, so CSS and callbacks stay in step either way.
	const REDUCED_MOTION_OPENING_DURATION_MS = 1;

	export type BookStageState = 'closed' | 'opening' | 'open' | 'closing';

	/*
	 * The cover's cloth and wear, and where its elastic and its label sit: the
	 * same images and measures the 3D sketchbook on the home's side table
	 * wears, so the zoom from the room hands over the same book. Measures are
	 * shares of the cover (cqw and cqh, against .cover-front).
	 */
	const coverMaterial = [
		`--cover-cloth: url(${bookclothUrl})`,
		`--cover-wear: url(${coverWearUrl})`,
		`--cover-tile: ${SKETCHBOOK_COVER.tile * 100}cqw`,
		`--cover-elastic-centre: ${SKETCHBOOK_COVER.elastic.fromEdge * 100}cqw`,
		`--cover-elastic-width: ${SKETCHBOOK_COVER.elastic.width * 100}cqw`,
		`--cover-label-centre: ${SKETCHBOOK_COVER.label.centre * 100}%`,
		`--cover-label-foot: ${SKETCHBOOK_COVER.label.foot * 100}cqh`,
		`--cover-label-turn: ${SKETCHBOOK_COVER.label.turn}deg`
	].join('; ');

	let {
		arriving = false,
		children,
		coverBack,
		coverElement = $bindable(null),
		coverShown = $bindable(true),
		onClosed,
		onOpened,
		onOpenRequest,
		openingDurationMs = 950,
		stageState
	}: {
		/**
		 * The book takes over from the home room's sketchbook, which has no
		 * lettering, ribbon or page edges: those join it after the cut.
		 */
		arriving?: boolean;
		children?: Snippet;
		/** What lies on the inside of the cover, turning open and shut with it. */
		coverBack?: Snippet;
		/** The closed cover, for the page to lay the book by. */
		coverElement?: HTMLElement | null;
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

	/*
	 * The book around the canvas is paper, not a control. A pen or finger that
	 * lands on the page's margin, the line under the drawing or the open cover
	 * starts no magnifier, no text selection and no Scribble there, as on the
	 * canvas: iPad keeps all three running unless a touchstart that is not
	 * passive is prevented (Svelte registers `ontouchstart` as passive). What
	 * can be pressed or typed in the book still can.
	 */
	let shellElement = $state<HTMLElement | null>(null);
	const PRESSABLE = 'a, button, input, label, select, textarea, [contenteditable], [role="button"]';

	$effect(() => {
		if (!shellElement) return;
		return on(
			shellElement,
			'touchstart',
			(event) => {
				if (event.target instanceof Element && event.target.closest(PRESSABLE)) return;
				event.preventDefault();
			},
			{ passive: false }
		);
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
	bind:this={shellElement}
	class="book-shell"
	data-arriving={arriving || undefined}
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

			<div class="book-cover" bind:this={coverElement} style={coverMaterial}>
				<button
					type="button"
					class="cover-front focus-ring-cover"
					onclick={onOpenRequest}
					disabled={stageState !== 'closed'}
					aria-label="Open sketchbook"
				>
					<!-- The bookcloth with its spine, corners and wear; the block of
					     pages and the back board showing past it; the ribbon marker
					     hanging out of the foot; the elastic that keeps it shut. -->
					<span class="cover-cloth" aria-hidden="true"></span>
					<span class="cover-pages cover-pages-side" aria-hidden="true"></span>
					<span class="cover-pages cover-pages-foot" aria-hidden="true"></span>
					<span class="cover-ribbon" aria-hidden="true"></span>
					<span class="cover-elastic" aria-hidden="true"></span>
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
				<!-- The inside of the cover: the endpaper, and whatever the page lays
				     on it (the drawing's notes, on a desk-shaped screen). -->
				<div class="cover-back-face">{@render coverBack?.()}</div>
			</div>
		</div>
	</div>
</section>

<style>
	.book-shell {
		/*
		 * The endpaper's grain inside the cover — coarser than the shared
		 * `.paper-grain` utility, so it stays local.
		 */
		--book-endpaper-grain: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.5' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.07'/%3E%3C/svg%3E");
		--book-endpaper-print: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='72' height='72' viewBox='0 0 72 72'%3E%3Cg fill='none' stroke='%23a9825c' stroke-width='1.2' stroke-linecap='round' stroke-linejoin='round' opacity='.36'%3E%3Cpath d='M8 14c4-6 14-6 16 0c2 5-4 7-8 6c-3 0-2 3-4 4c-3 1-6-5-4-10z'/%3E%3Ccircle cx='13' cy='12' r='1.2'/%3E%3Ccircle cx='18' cy='11' r='1.2'/%3E%3Cpath d='M44 44l14-14M56 29l3-3c1-1 3 1 2 2l-3 3'/%3E%3Crect x='40' y='6' width='14' height='11' rx='1'/%3E%3Crect x='43' y='9' width='8' height='5'/%3E%3Cpath d='M16 50l2 4 4 .6-3 3 .8 4-3.8-2-3.8 2 .8-4-3-3 4-.6z'/%3E%3C/g%3E%3C/svg%3E");

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

	/* --- Book cover (3D flip) --- */

	.book-cover {
		display: var(--studio-cover-display, block);
		position: absolute;
		inset: var(--studio-book-edge, 0.5rem);
		border-radius: 3px 7px 7px 3px;
		/* The cloth's own colour, until its images arrive. */
		background-color: #b8aa8f;
		/* Lying on the desk: tight where the board touches it, softer further out. */
		box-shadow:
			0 1px 1px rgb(30 20 12 / 0.45),
			0 0.4rem 0.9rem rgb(30 20 12 / 0.24),
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
		   and the pages' edge. Colour comes from `focus-ring-cover`. */
		--focus-ring-offset: 5px;
		/* Everything on the cover is measured against its width (cqw), as on
		 * the 3D sketchbook. No padding: cqw counts the content box. */
		container-type: size;
		position: absolute;
		inset: 0;
		display: block;
		padding: 0;
		border: 0;
		border-radius: inherit;
		background: transparent;
		color: inherit;
		text-align: center;
		/* Each face stands a hair off the cover's own plane, on its side of it,
		 * and holds everything on it in one layer: Safari otherwise sorts the
		 * faces and the label against the cover's background as the cover
		 * turns, and the label vanished until it lay flat again. The postcard's
		 * faces stand off their card the same way. */
		transform: translateZ(0.1px);
		backface-visibility: hidden;
		cursor: pointer;
		transition: opacity 160ms ease;
	}

	.cover-front:disabled {
		cursor: default;
	}

	.cover-front:active {
		transform: translateZ(0.1px);
		scale: 1;
	}

	/* Apply the press feedback to the whole cover instead of the inner button contents. */
	.book-cover:has(.cover-front:active) {
		transform: scale(0.985);
	}

	/*
	 * The bookcloth: a tile of linen, and over it this book's own wear (the
	 * dark cloth spine and corners, the rubbed edges, the grime where it is
	 * held), drawn for a square cover, which this one always nearly is. Both
	 * images come from scripts/generate-sketchbook-cloth.ts. One element, one
	 * draw each: pieces drawn side by side would show their seams on the
	 * tilted desk.
	 */
	.cover-cloth {
		position: absolute;
		inset: 0;
		border-radius: inherit;
		background:
			var(--cover-wear) 0 0 / 100% 100% no-repeat,
			var(--cover-cloth) 0 0 / var(--cover-tile) auto repeat;
		pointer-events: none;
	}

	/* The desk lamp's fall-off across the board, and the board's edges. */
	.cover-cloth::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		background:
			radial-gradient(130% 100% at 18% 0%, rgb(255 246 228 / 0.12), transparent 60%),
			radial-gradient(110% 110% at 100% 100%, rgb(36 24 12 / 0.16), transparent 62%);
		box-shadow:
			inset 0 1px 0 rgb(255 248 236 / 0.28),
			inset -1px 0 0 rgb(30 20 10 / 0.3),
			inset 0 -1px 0 rgb(30 20 10 / 0.34);
	}

	/* The pages' edges, and the back board under them, just past the front
	 * board on the open side and the foot: the book's thickness. They sit
	 * outside the cover's box, so nothing of them lies over the cloth, and
	 * they turn away with the cover's front when it opens. */
	.cover-pages {
		position: absolute;
		pointer-events: none;
	}

	.cover-pages-side {
		top: 4px;
		right: -8px;
		bottom: -8px;
		width: 8px;
		border-radius: 0 3px 3px 0;
		background:
			/* the back board's cloth edge */
			linear-gradient(90deg, transparent 5px, #7d705c 5px, #6a5d4b),
			/* thumbed darker towards the corners */
			linear-gradient(
					180deg,
					rgb(110 84 50 / 0.22),
					transparent 14%,
					transparent 78%,
					rgb(110 84 50 / 0.26)
				),
			/* the front board's shadow on the pages */
			linear-gradient(90deg, rgb(40 28 16 / 0.35), transparent 2px),
			repeating-linear-gradient(
				90deg,
				#efe6d3 0 0.6px,
				#d6cab3 0.6px 1px,
				#e9dfca 1px 1.7px,
				#cfc2aa 1.7px 2.1px
			);
	}

	.cover-pages-foot {
		right: -8px;
		bottom: -8px;
		left: 6px;
		height: 8px;
		border-radius: 0 0 3px 3px;
		background:
			linear-gradient(180deg, transparent 5px, #7d705c 5px, #6a5d4b),
			linear-gradient(
				90deg,
				rgb(110 84 50 / 0.12),
				transparent 10%,
				transparent 80%,
				rgb(110 84 50 / 0.26)
			),
			linear-gradient(180deg, rgb(40 28 16 / 0.35), transparent 2px),
			repeating-linear-gradient(
				180deg,
				#efe6d3 0 0.6px,
				#d6cab3 0.6px 1px,
				#e9dfca 1px 1.7px,
				#cfc2aa 1.7px 2.1px
			);
	}

	/* The ribbon marker: a grosgrain ribbon hanging out of the foot, its end
	 * cut in a V. */
	.cover-ribbon {
		position: absolute;
		top: calc(100% + 5px);
		left: 68%;
		width: 2.1cqw;
		height: 5.6cqw;
		background:
			repeating-linear-gradient(180deg, rgb(0 0 0 / 0.16) 0 1px, transparent 1px 2.2px),
			linear-gradient(
				90deg,
				rgb(0 0 0 / 0.25),
				transparent 30%,
				transparent 72%,
				rgb(0 0 0 / 0.25)
			),
			#7a2c23;
		clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 80%, 0 100%);
		pointer-events: none;
	}

	/* The thin elastic that keeps the book shut, bending over the head and the
	 * tail of the board. Knitted, not glossy. */
	.cover-elastic {
		position: absolute;
		top: -0.4rem;
		bottom: -0.4rem;
		right: calc(var(--cover-elastic-centre) - var(--cover-elastic-width) / 2);
		width: var(--cover-elastic-width);
		border-radius: 1.5px;
		background:
			linear-gradient(
				180deg,
				rgb(8 5 3 / 0.6),
				transparent 0.55rem,
				transparent calc(100% - 0.55rem),
				rgb(8 5 3 / 0.65)
			),
			repeating-linear-gradient(180deg, rgb(255 240 220 / 0.07) 0 1px, transparent 1px 3px),
			linear-gradient(
				90deg,
				rgb(255 240 220 / 0.12) 0 1px,
				transparent 1px calc(100% - 1px),
				rgb(0 0 0 / 0.4) calc(100% - 1px)
			),
			#2b231d;
		box-shadow:
			1px 1px 1.5px rgb(20 12 6 / 0.5),
			2px 2px 4px rgb(20 12 6 / 0.2);
		pointer-events: none;
		z-index: 6;
	}

	.book-shell[data-arriving] :is(.cover-title-area, .cover-invite, .cover-ribbon, .cover-pages) {
		animation: coverArrival 600ms 300ms ease-out both;
	}

	@keyframes coverArrival {
		from {
			opacity: 0;
		}
	}

	.cover-title-area {
		position: absolute;
		top: 15cqh;
		left: var(--cover-label-centre);
		transform: translateX(-50%);
		z-index: 5;
		width: max-content;
	}

	/* "SKETCHBOOK", blind-stamped into the cloth: a darker pressed letter,
	 * shaded along its top edge and lit along its bottom one. Its colour
	 * stays translucent, so the stamp is decoration, not low-contrast text
	 * for axe; the button's name is its aria-label. */
	.cover-title {
		display: block;
		margin-right: -0.36em;
		font-family: var(--font-display);
		font-size: 4.6cqw;
		font-weight: 600;
		letter-spacing: 0.36em;
		line-height: 1;
		text-transform: uppercase;
		color: transparent;
		-webkit-text-fill-color: rgb(62 46 28 / 0.2);
		text-shadow: 0 1px 0 rgb(255 247 230 / 0.36);
	}

	/* A paper label glued on a little crooked, yellowed and foxed with the
	 * years, inside a double rule printed in brown ink. */
	.cover-label {
		position: absolute;
		bottom: var(--cover-label-foot);
		left: var(--cover-label-centre);
		z-index: 5;
		padding: 2.5cqw 5.4cqw 2.1cqw;
		border-radius: 2px 2px 4px 2px;
		background-color: #ede0c3;
		background-image:
			radial-gradient(circle 0.2rem at 87% 26%, rgb(138 88 36 / 0.3), rgb(138 88 36 / 0) 100%),
			radial-gradient(circle 0.3rem at 10% 70%, rgb(138 88 36 / 0.2), rgb(138 88 36 / 0) 100%),
			radial-gradient(circle 0.14rem at 64% 86%, rgb(138 88 36 / 0.24), rgb(138 88 36 / 0) 100%),
			radial-gradient(90% 80% at 42% 45%, rgb(255 251 238 / 0.62), rgb(255 251 238 / 0) 72%);
		box-shadow:
			inset 0 0 0.9rem rgb(160 118 58 / 0.24),
			inset 0 0 0 1px rgb(140 100 56 / 0.2),
			0 1px 1px rgb(40 26 12 / 0.32),
			0 1px 3px rgb(40 26 12 / 0.14);
		text-align: center;
		white-space: nowrap;
		transform: translateX(-50%) rotate(var(--cover-label-turn));
	}

	.cover-label::before {
		content: '';
		position: absolute;
		inset: 0.8cqw;
		border: 1px solid rgb(112 60 38 / 0.55);
		outline: 1px solid rgb(112 60 38 / 0.32);
		outline-offset: 2px;
		border-radius: 1px;
		pointer-events: none;
	}

	.cover-label-title {
		display: block;
		font-family: var(--font-display);
		font-size: 2.45cqw;
		font-weight: 600;
		letter-spacing: 0.24em;
		text-transform: uppercase;
		color: rgb(52 34 24 / 0.92);
	}

	.cover-label-line {
		width: 9cqw;
		height: 1px;
		margin: 0.8cqw auto 0.5cqw;
		background: rgb(112 60 38 / 0.35);
	}

	.cover-label-sub {
		font-family: var(--font-hand);
		font-size: 2.9cqw;
		color: rgb(58 54 66 / 0.62);
	}

	.cover-invite {
		position: absolute;
		bottom: 6cqh;
		left: var(--cover-label-centre);
		transform: translateX(-50%);
		max-width: 20ch;
		font-family: var(--font-hand);
		font-size: 1.5rem;
		line-height: 1.5;
		color: rgb(40 32 24 / 0.86);
		white-space: nowrap;
	}

	/* Inside the board: the cloth turned in round its edges, and the endpaper
	 * pasted over the rest. The drawing's notes lie here once it opens. */
	.cover-back-face {
		position: absolute;
		inset: 0;
		border-radius: inherit;
		background: var(--cover-cloth) 0 0 / 34% auto repeat;
		backface-visibility: hidden;
		transform: rotateY(180deg) translateZ(0.1px);
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.cover-back-face::before {
		content: '';
		position: absolute;
		inset: 1.6%;
		border-radius: 1px;
		background-color: #e9dfca;
		/* A printed endpaper: palettes, brushes, frames and stars in faded
		 * sienna, under the grain and the shade of the hinge. */
		background-image:
			var(--book-endpaper-grain), linear-gradient(270deg, rgb(70 50 30 / 0.12), transparent 9%),
			radial-gradient(120% 90% at 40% 30%, rgb(255 250 240 / 0.35), transparent 70%),
			var(--book-endpaper-print);
		background-size:
			auto,
			auto,
			auto,
			4.5rem 4.5rem;
		box-shadow:
			0 0 0 1px rgb(60 44 28 / 0.18),
			0 1px 2px rgb(40 28 16 / 0.2);
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
