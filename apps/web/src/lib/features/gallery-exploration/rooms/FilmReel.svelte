<script lang="ts">
	import { untrack } from 'svelte';
	import { prefersReducedMotion } from 'svelte/motion';
	import { writable, type Writable } from 'svelte/store';
	import type { Artwork } from '#lib/features/artwork-presentation/model/artwork.js';
	import { isArtworkBlurred } from '#lib/features/gallery-exploration/model/sensitivity.js';
	import ReelFramePhoto from './ReelFramePhoto.svelte';

	let {
		adultContentEnabled = false,
		held = false,
		onDeveloped,
		onLand,
		onOpen,
		revealedArtworkIds,
		viewerId = null
	}: {
		adultContentEnabled?: boolean;
		/** Keeps the line where it is, for as long as the postcard is what is being looked at. */
		held?: boolean;
		/** The photo has come up all the way. */
		onDeveloped: (artwork: Artwork) => void;
		/** The line has stopped, with the artwork in the ring. */
		onLand?: (artwork: Artwork) => void;
		/** The visitor pressed the photo, developed or not. */
		onOpen?: (artwork: Artwork) => void;
		revealedArtworkIds?: Writable<Set<string>>;
		viewerId?: string | null;
	} = $props();

	/*
	 * A line of undeveloped polaroids, run by the browser.
	 *
	 * This was the heaviest thing in the gallery: gsap wrote a number on every
	 * frame, and from it every photo on screen was worked out again, its size
	 * and its opacity, with real photos fading in and out over the wall. Now
	 * the frames are one still strip with no photos in it, painted once, and
	 * spinning is a transform on that strip, which the compositor animates on
	 * its own: no script and no style run while it moves, whatever the main
	 * thread is doing. At rest the stylesheet keeps it drifting the same way.
	 * Nothing is fetched until the spin has an artwork, and that one photo lies
	 * over the strip instead of in it, so the strip is never painted again.
	 *
	 * The frames repeat every PATTERN, and the strip is long enough for the
	 * line to stop TRAVEL frames on. That is a whole number of patterns, so a
	 * stopped strip can go back to where it started without a pixel changing,
	 * ready for the next spin.
	 */
	const PATTERN = 4;
	const TRAVEL = PATTERN * 2;
	const FRAMES_BESIDE = 6;
	const FRAME_COUNT = FRAMES_BESIDE * 2 + TRAVEL + 1;

	// In frames a millisecond. Each stretch of the spin meets the next at this
	// speed: an easing's slope where it joins the steady run says how long the
	// stretch has to be for that.
	const TOP_SPEED = 10 / 1000;
	const RUN_UP_EASING = 'cubic-bezier(0.4, 0, 0.8, 0.6)';
	const RUN_UP_MS = (2 * PATTERN) / TOP_SPEED;
	const LAP_MS = PATTERN / TOP_SPEED;
	const LANDING_EASING = 'cubic-bezier(0.15, 0.6, 0.1, 1)';
	const LANDING_SLOPE = 4;
	const WIND_DOWN_MS = 700;
	const DEVELOP_MS = 1000;

	type ReelState = 'resting' | 'spinning' | 'landing' | 'developing' | 'developed' | 'stopping';
	let reelState = $state<ReelState>('resting');

	let stripElement = $state<HTMLDivElement>();
	let revealElement = $state<HTMLButtonElement>();
	/** The strip's one running animation. */
	let movement: Animation | null = null;
	/** Read once a spin, from the frames: the stylesheet sizes them. */
	let frameStep = 0;

	/** What is up on the line, or on its way to landing there. */
	let artwork = $state<Artwork | null>(null);
	/** The artwork to land on, once the run-up is over. */
	let arrival: Artwork | null = null;
	/** The photo, once it has come from the network. */
	let photoElement = $state<HTMLImageElement | null>(null);

	const fallbackRevealedIds = writable<Set<string>>(new Set());
	const revealedIds = $derived(revealedArtworkIds ?? fallbackRevealedIds);

	const after = (animation: Animation, then: () => void) => {
		// A cancelled animation rejects: whoever cancelled it has moved on.
		animation.finished.then(then, () => {});
	};

	const at = (frames: number) => ({
		transform: `translate3d(${-(FRAMES_BESIDE + frames) * frameStep}px, 0, 0)`
	});

	/** Where the line is within its pattern. One style read, only at a hand-over. */
	const framesRun = (strip: HTMLElement) => {
		const run = -new DOMMatrix(getComputedStyle(strip).transform).m41 / frameStep - FRAMES_BESIDE;
		return ((run % PATTERN) + PATTERN) % PATTERN;
	};

	const land = (landed: Artwork) => {
		movement = null;
		reelState = 'developing';
		onLand?.(landed);
	};

	const startLanding = (strip: HTMLElement, landing: Artwork) => {
		const from = framesRun(strip);
		movement?.cancel();
		// Mounted now so the photo is on its way while the line slows down.
		artwork = landing;
		reelState = 'landing';
		const slowing = strip.animate([at(from), at(TRAVEL)], {
			duration: (LANDING_SLOPE * (TRAVEL - from)) / TOP_SPEED,
			easing: LANDING_EASING
		});
		movement = slowing;
		after(slowing, () => land(landing));
	};

	/**
	 * Sets the line going on the click, before the artwork is known: waiting
	 * for the round trip left the button disabled over a line standing still.
	 * `spinToArtwork` brings it down, `cancelFreeSpin` if nothing arrives.
	 */
	export const startFreeSpin = () => {
		const strip = stripElement;
		if (!strip || reelState === 'spinning' || reelState === 'landing') return;

		const reveal = revealElement;
		arrival = null;
		photoElement = null;

		// Less motion: the line stays still and the photo simply goes.
		if (prefersReducedMotion.current) {
			reelState = 'spinning';
			artwork = null;
			return;
		}

		const [first, second] = strip.children as unknown as [HTMLElement, HTMLElement];
		frameStep = second.offsetLeft - first.offsetLeft;

		// Read while the drift still holds them: it stops with the state.
		const from = framesRun(strip);
		const carried = reveal ? new DOMMatrix(getComputedStyle(reveal).transform).m41 : 0;
		movement?.cancel();
		reelState = 'spinning';

		// The last photo keeps the strip's pace, so it leaves with the line.
		const runUp = { duration: RUN_UP_MS, easing: RUN_UP_EASING, fill: 'forwards' } as const;
		const rising = strip.animate([at(from), at(from + PATTERN)], runUp);
		reveal?.animate(
			[
				{ transform: `translate3d(${carried}px, 0, 0)` },
				{ transform: `translate3d(${carried - PATTERN * frameStep}px, 0, 0)` }
			],
			runUp
		);
		movement = rising;

		after(rising, () => {
			artwork = null;
			if (arrival) {
				startLanding(strip, arrival);
				return;
			}
			rising.cancel();
			movement = strip.animate([at(from), at(from + PATTERN)], {
				duration: LAP_MS,
				iterations: Infinity
			});
		});
	};

	/**
	 * Brings a spinning line down onto the artwork. Returns false when no spin
	 * is under way, so the caller can stop pretending one is.
	 */
	export const spinToArtwork = (next: Artwork): boolean => {
		const strip = stripElement;
		if (!strip || reelState !== 'spinning') return false;

		if (prefersReducedMotion.current) {
			artwork = next;
			land(next);
			return true;
		}

		arrival = next;
		// Still in the run-up, its end picks the artwork up.
		if (movement?.effect?.getComputedTiming().iterations === Infinity) {
			startLanding(strip, next);
		}
		return true;
	};

	/** Winds the line down when the artwork never arrives. */
	export const cancelFreeSpin = () => {
		const strip = stripElement;
		if (!strip || reelState !== 'spinning') return;

		arrival = null;
		artwork = null;
		if (!movement) {
			reelState = 'resting';
			return;
		}

		const from = framesRun(strip);
		movement.cancel();
		reelState = 'stopping';
		const stopping = strip.animate([at(from), at(TRAVEL)], {
			duration: WIND_DOWN_MS,
			easing: LANDING_EASING
		});
		movement = stopping;
		after(stopping, () => {
			movement = null;
			reelState = 'resting';
		});
	};

	// Decoded before it counts as here, off the main thread: the one moment the
	// visitor is staring at must not start with a stall.
	const photoArrived = ({ target }: Event) => {
		if (!(target instanceof HTMLImageElement)) return;
		const ready = () => {
			if (target.isConnected) photoElement = target;
		};
		target.decode().then(ready, ready);
	};

	const open = () => {
		if (!artwork) return;
		if (reelState === 'developing') reelState = 'developed';
		onOpen?.(artwork);
	};

	// The drift has carried the photo off the far side of the window.
	const carriedAway = (event: AnimationEvent) => {
		if (event.target !== event.currentTarget) return;
		artwork = null;
		photoElement = null;
		reelState = 'resting';
	};

	// The photo comes up in front of the visitor once the line has stopped and
	// the photo is here, whichever is last. Only its opacity moves, so this too
	// stays on the compositor.
	$effect(() => {
		const photo = photoElement;
		if (reelState !== 'developing' || !photo) return;

		const developed = () => {
			reelState = 'developed';
			onDeveloped(untrack(() => artwork)!);
		};
		if (prefersReducedMotion.current) {
			developed();
			return;
		}

		const comingUp = photo.animate(
			{ opacity: [0, 1] },
			{ duration: DEVELOP_MS, easing: 'ease-out', fill: 'forwards' }
		);
		after(comingUp, developed);
		return () => comingUp.cancel();
	});

	// Destroy-only: nothing should be left to call back after the room is gone.
	$effect(() => () => {
		movement?.cancel();
	});
</script>

<div
	class="reel-container"
	data-reel-held={held || undefined}
	data-reel-state={reelState}
	data-testid="film-reel"
>
	<div class="reel-viewport" style:--reel-lap={PATTERN} style:--reel-rest={FRAMES_BESIDE}>
		<div
			bind:this={stripElement}
			class="reel-strip"
			aria-hidden="true"
			data-testid="film-reel-track"
		>
			{#each { length: FRAME_COUNT }, index (index)}
				<div class="reel-frame polaroid-paper">
					<span class="reel-frame-photo"></span>
					<span class="reel-frame-mark">?</span>
				</div>
			{/each}
		</div>

		{#if artwork}
			{@const blurred = isArtworkBlurred(artwork, {
				adultContentEnabled,
				id: viewerId,
				revealedIds: $revealedIds
			})}
			<button
				bind:this={revealElement}
				type="button"
				class="reel-reveal focus-ring"
				aria-label={`Open ${artwork.title}`}
				onanimationend={carriedAway}
				onclick={open}
				onloadcapture={photoArrived}
			>
				<span class="reel-reveal-photo">
					<ReelFramePhoto alt={artwork.title} {blurred} src={artwork.imageUrl} />
				</span>
				<span class="reel-reveal-caption">
					<span class="reel-reveal-title">{artwork.title}</span>
					<span class="reel-reveal-artist">{artwork.artist}</span>
				</span>
			</button>
		{/if}

		<!-- A red pencil ring on the wall: whatever stops inside it is the one. -->
		<svg class="reel-ring" viewBox="0 0 300 340" preserveAspectRatio="none" aria-hidden="true">
			<path
				d="M62 13 C 120 6, 214 5, 262 12 C 287 17, 293 34, 293 74 C 295 140, 296 214, 291 278 C 288 316, 272 329, 232 330 C 170 333, 96 335, 42 329 C 15 325, 8 306, 8 262 C 5 196, 6 118, 10 58 C 12 26, 30 11, 78 8 C 120 5, 170 4, 214 7"
			></path>
		</svg>
	</div>
</div>

<style>
	.reel-container {
		container: reel / inline-size;
		width: 100%;
	}

	/* A big polaroid, as tall as the window allows and as wide as a phone
	 * leaves room for its neighbours to show. All of it hangs from the size. */
	.reel-viewport {
		--reel-frame-size: clamp(11rem, min(46dvh, 64cqw), 30rem);
		--reel-gap: clamp(1.1rem, 3cqw, 2.25rem);
		--reel-step: calc(var(--reel-frame-size) + var(--reel-gap));
		--reel-card-height: calc(var(--reel-frame-size) * 1.16);
		--reel-inset: calc(var(--reel-frame-size) * 0.035);
		--reel-card-top: 1.75rem;
		position: relative;
		height: calc(var(--reel-card-top) + var(--reel-card-height) + 2rem);
		overflow: hidden;
	}

	/* The twine does not move: it looks the same whether it runs or not. */
	.reel-viewport::before {
		content: '';
		position: absolute;
		top: 1rem;
		right: 0;
		left: 0;
		height: 3px;
		background: repeating-linear-gradient(112deg, #8f7048 0 3px, #bb9a68 3px 5px, #7a5d3a 5px 7px);
		box-shadow: 0 3px 3px rgb(40 25 10 / 0.3);
	}

	.reel-strip {
		position: absolute;
		top: var(--reel-card-top);
		left: calc(50% - var(--reel-frame-size) / 2);
		display: flex;
		gap: var(--reel-gap);
		transform: translate3d(calc(var(--reel-step) * var(--reel-rest) * -1), 0, 0);
	}

	/* At rest the line drifts, a pattern of frames at a time and for ever: it
	 * looks the same where it ends as where it began. A running CSS animation of
	 * a transform needs no script, so standing idle costs nothing but the
	 * compositor's frames. A photo that is up goes with it, off the far side. */
	.reel-container[data-reel-state='resting'] .reel-strip,
	.reel-container[data-reel-state='developed'] .reel-strip {
		animation: reel-drift 16s linear infinite;
	}

	.reel-container[data-reel-state='developed'] .reel-reveal {
		animation: reel-photo-drift 16s linear forwards;
	}

	.reel-container[data-reel-held] .reel-strip,
	.reel-container[data-reel-held] .reel-reveal {
		animation-play-state: paused;
	}

	@keyframes reel-drift {
		to {
			transform: translate3d(
				calc(var(--reel-step) * (var(--reel-rest) + var(--reel-lap)) * -1),
				0,
				0
			);
		}
	}

	@keyframes reel-photo-drift {
		to {
			transform: translate3d(calc(var(--reel-step) * var(--reel-lap) * -1), 0, 0);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.reel-container[data-reel-state='resting'] .reel-strip,
		.reel-container[data-reel-state='developed'] .reel-strip,
		.reel-container[data-reel-state='developed'] .reel-reveal {
			animation: none;
		}
	}

	/* A layer only while it moves: at rest the strip is part of the page. */
	.reel-container[data-reel-state='spinning'] .reel-strip,
	.reel-container[data-reel-state='landing'] .reel-strip,
	.reel-container[data-reel-state='stopping'] .reel-strip {
		will-change: transform;
	}

	.reel-frame {
		position: relative;
		flex: none;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		align-items: center;
		width: var(--reel-frame-size);
		height: var(--reel-card-height);
		padding: var(--reel-inset) var(--reel-inset) 0;
		rotate: var(--reel-tilt, 0deg);
		transform-origin: 50% -0.5rem;
	}

	/* A clothes peg on the twine. */
	.reel-frame::before {
		content: '';
		position: absolute;
		top: -1.35rem;
		left: 50%;
		width: 0.8rem;
		height: 2.2rem;
		translate: -50% 0;
		border-radius: 2px 2px 3px 3px;
		background:
			linear-gradient(180deg, transparent 44%, rgb(70 50 30 / 0.55) 44% 50%, transparent 50%),
			linear-gradient(90deg, #b48d5c, #d9b98a 45%, #c9a673 60%, #a57f50);
		box-shadow: 0 2px 3px rgb(40 25 10 / 0.4);
	}

	.reel-frame:nth-child(4n + 1) {
		--reel-tilt: -1.4deg;
		--reel-cloud: 30% 34%;
		--reel-cloud-two: 68% 72%;
	}

	.reel-frame:nth-child(4n + 2) {
		--reel-tilt: 1.1deg;
		--reel-cloud: 62% 28%;
		--reel-cloud-two: 34% 66%;
	}

	/* The frame the line rests and stops on hangs straight in the ring. */
	.reel-frame:nth-child(4n + 3) {
		--reel-cloud: 44% 56%;
		--reel-cloud-two: 74% 30%;
	}

	.reel-frame:nth-child(4n + 4) {
		--reel-tilt: -0.8deg;
		--reel-cloud: 70% 60%;
		--reel-cloud-two: 26% 30%;
	}

	/* Film that has not come up yet: milky grey-green, with clouds of paler
	 * chemistry. Drawn, not a photo, so it costs nothing to fetch or decode. */
	.reel-frame-photo {
		display: block;
		flex: none;
		width: 100%;
		aspect-ratio: 1;
		background:
			radial-gradient(38% 30% at var(--reel-cloud), rgb(214 212 196 / 0.62), transparent 100%),
			radial-gradient(30% 36% at var(--reel-cloud-two), rgb(198 200 186 / 0.48), transparent 100%),
			radial-gradient(120% 120% at 50% 50%, transparent 52%, rgb(52 56 50 / 0.42) 100%), #8e9186;
		box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.08);
	}

	.reel-frame-mark {
		margin-top: calc(var(--reel-frame-size) * 0.012);
		color: var(--color-pencil);
		font-family: var(--font-hand);
		font-size: calc(var(--reel-frame-size) * 0.1);
		font-weight: 700;
		line-height: 1;
		opacity: 0.8;
	}

	/* The photo that came, lying exactly over the frame in the ring. It is off
	 * the strip so that putting it up does not paint the strip again. */
	.reel-reveal {
		position: absolute;
		top: var(--reel-card-top);
		left: calc(50% - var(--reel-frame-size) / 2);
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		width: var(--reel-frame-size);
		height: var(--reel-card-height);
		padding: var(--reel-inset) var(--reel-inset) 0;
		border: 0;
		background: none;
		cursor: pointer;
		--focus-ring-offset: 4px;
	}

	/* Fetching, while the line slows down, but not out yet. */
	.reel-container[data-reel-state='landing'] .reel-reveal {
		visibility: hidden;
	}

	.reel-reveal-photo {
		position: relative;
		display: block;
		flex: none;
		width: 100%;
		aspect-ratio: 1;
		overflow: hidden;
		box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.08);
	}

	.reel-container[data-reel-state='developing'] .reel-reveal-photo :global(.reel-frame-image) {
		opacity: 0;
	}

	.reel-reveal-caption {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-width: 0;
		padding-inline: 0.5rem;
		background: #fbf8f2;
		font-family: var(--font-hand);
		line-height: 1.1;
		text-align: center;
		animation: reel-caption-in 400ms ease-out;
	}

	.reel-container[data-reel-state='developing'] .reel-reveal-caption {
		visibility: hidden;
	}

	.reel-reveal-title,
	.reel-reveal-artist {
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.reel-reveal-title {
		color: var(--color-ink-warm);
		font-size: max(1rem, calc(var(--reel-frame-size) * 0.056));
		font-weight: 700;
	}

	.reel-reveal-artist {
		color: var(--color-muted-ink);
		font-size: max(0.875rem, calc(var(--reel-frame-size) * 0.042));
	}

	@keyframes reel-caption-in {
		from {
			opacity: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.reel-reveal-caption {
			animation: none;
		}
	}

	.reel-ring {
		position: absolute;
		top: calc(var(--reel-card-top) + var(--reel-card-height) / 2);
		left: 50%;
		width: calc(var(--reel-frame-size) + 2.75rem);
		height: calc(var(--reel-card-height) + 1.9rem);
		translate: -50% -50%;
		overflow: visible;
		pointer-events: none;
	}

	.reel-ring path {
		fill: none;
		stroke: var(--color-pencil);
		stroke-linecap: round;
		stroke-linejoin: round;
		stroke-width: 4.5px;
		vector-effect: non-scaling-stroke;
	}
</style>
