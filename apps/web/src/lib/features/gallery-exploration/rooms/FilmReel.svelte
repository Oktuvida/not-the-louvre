<script lang="ts">
	import { browser } from '$app/env';
	import { prefersReducedMotion } from 'svelte/motion';
	import { writable, type Writable } from 'svelte/store';
	import type { Artwork } from '#lib/features/artwork-presentation/model/artwork.js';
	import { isArtworkBlurred } from '#lib/features/gallery-exploration/model/sensitivity.js';

	/*
	 * gsap is 27KB gzipped and the reel is the only thing in the whole gallery
	 * tree that uses it, so a static import made /gallery, /gallery/hot-wall and
	 * /gallery/your-studio pay for an animation they never show. Every call site
	 * already runs after mount behind a `browser` guard, so one memoised dynamic
	 * import costs a microtask on the first idle cycle and nothing after that.
	 */
	let gsapModule: Promise<typeof import('#lib/client/gsap.js')> | null = null;
	const loadGsap = () => (gsapModule ??= import('#lib/client/gsap.js'));

	let {
		adultContentEnabled = false,
		artworks,
		onIdleCycleComplete,
		onIdleProgress,
		onLand,
		revealedArtworkIds,
		viewerId = null
	}: {
		adultContentEnabled?: boolean;
		artworks: Artwork[];
		onIdleCycleComplete?: () => void;
		onIdleProgress?: (fraction: number) => void;
		onLand: (artwork: Artwork) => void;
		revealedArtworkIds?: Writable<Set<string>>;
		viewerId?: string | null;
	} = $props();

	let viewportEl: HTMLDivElement | undefined = $state();
	let viewportWidth = $state(0);
	let viewportResizeObserver: ResizeObserver | null = null;

	const BUFFER = 3;
	const IDLE_DURATION_PER_FRAME = 4;
	/*
	 * Travel is capped so the spin does not scale with the pool: at three full
	 * cycles a 200-artwork pool would fling ~75 frames a second past the
	 * viewport, creating and destroying a DOM node for each one.
	 */
	const MAX_SPIN_FRAMES = 12;

	/*
	 * `free-spinning` is the gap the visitor used to stare at: the artwork the
	 * reel lands on comes from the network, and until it answered the reel sat
	 * perfectly still with the button disabled. The reel now leaves at a
	 * constant velocity on the click and `spinToArtwork` retargets that motion
	 * into its decelerating landing when the artwork arrives.
	 */
	type ReelState = 'idle' | 'free-spinning' | 'spinning' | 'stopped';
	// The only thing this component ever does with a tween handle is kill it,
	// so it needs no gsap type — which keeps the module out of the type graph
	// as well as out of the bundle.
	type ReelTween = { kill: () => void };
	let reelState = $state<ReelState>('idle');
	let idleTween: ReelTween | null = null;
	let freeSpinTween: ReelTween | null = null;
	let spinTween: ReelTween | null = null;
	let idleRestartTimer: ReturnType<typeof setTimeout> | null = null;

	// Brisk but not a blur, and long enough that no realistic round trip
	// outlives it.
	const FREE_SPIN_FRAMES_PER_SECOND = 8;
	const FREE_SPIN_FRAMES = 600;

	const fallbackRevealedIds = writable<Set<string>>(new Set());
	const revealedIds = $derived(revealedArtworkIds ?? fallbackRevealedIds);

	/*
	 * Virtual-window approach for efficient circular scrolling.
	 *
	 * `offset` is a continuously-growing logical pixel position.
	 * From it we derive which artwork indices are in view and render
	 * only those (~9-13 DOM nodes regardless of total artwork count).
	 * GSAP animates a plain proxy number; Svelte reactivity maps it
	 * to the visible slot positions each frame.
	 */
	let offset = $state(0);

	// A spun-to artwork that is not in the pool yet is appended locally instead
	// of mutating the `artworks` prop owned by the parent accumulator.
	let injectedArtwork = $state<Artwork | null>(null);

	const reelArtworks = $derived.by(() => {
		const injected = injectedArtwork;
		if (!injected || artworks.some((artwork) => artwork.id === injected.id)) {
			return artworks;
		}
		return [...artworks, injected];
	});

	// A boolean, not a length: growing the pool must not tear down a running
	// idle tween, but going from empty to non-empty must still start one.
	const hasReelArtworks = $derived(reelArtworks.length > 0);

	const reelMetrics = $derived.by(() => {
		const width = viewportWidth || 768;
		const isNarrow = width < 640;
		const frameSize = isNarrow ? Math.max(156, Math.min(200, Math.floor(width * 0.46))) : 256;
		const frameGap = isNarrow ? 10 : 14;
		const viewportHeight = frameSize + (isNarrow ? 20 : 24);
		const highlightSize = frameSize + (isNarrow ? 16 : 24);

		return {
			frameGap,
			frameSize,
			frameStep: frameSize + frameGap,
			highlightSize,
			viewportHeight
		};
	});

	/*
	 * Only `transform` and `opacity` change per tick; the box itself (position,
	 * offsets, size) lives in the stylesheet and is driven by a custom property
	 * that changes once per metrics change. Rebuilding a whole `style`
	 * attribute — including layout properties — for 9-13 elements on every one
	 * of a four-second spin's frames was the file's own stated goal to avoid.
	 */
	const visibleSlots = $derived.by(() => {
		if (!viewportEl || viewportWidth === 0 || reelArtworks.length === 0) return [];

		const { frameSize, frameStep } = reelMetrics;
		const vpWidth = viewportWidth;
		const centerX = vpWidth / 2;
		const totalSlots = Math.ceil(vpWidth / frameStep) + BUFFER * 2;

		const firstSlotLogical = Math.floor(offset / frameStep) - BUFFER;
		const slots: Array<{
			artwork: Artwork;
			key: number;
			opacity: string;
			transform: string;
		}> = [];

		for (let i = 0; i < totalSlots; i++) {
			const slotIndex = firstSlotLogical + i;
			let artworkIndex = slotIndex % reelArtworks.length;
			if (artworkIndex < 0) artworkIndex += reelArtworks.length;

			const x = slotIndex * frameStep - offset;
			const frameCenterX = x + frameSize / 2;
			const distFromCenter = Math.min(Math.abs(frameCenterX - centerX) / (vpWidth / 2), 1);

			slots.push({
				artwork: reelArtworks[artworkIndex]!,
				key: slotIndex,
				opacity: (1 - distFromCenter * 0.85).toFixed(3),
				transform: `translate3d(${x.toFixed(1)}px, -50%, 0) scale(${(1 - distFromCenter * 0.35).toFixed(3)})`
			});
		}

		return slots;
	});

	/* Proxy object that GSAP tweens — we read .value in onUpdate */
	const proxy = { value: 0 };

	const stopIdleRestart = () => {
		if (idleRestartTimer !== null) {
			clearTimeout(idleRestartTimer);
			idleRestartTimer = null;
		}
	};

	const scheduleIdleRestart = (delayMs = 0) => {
		stopIdleRestart();
		idleRestartTimer = setTimeout(() => {
			idleRestartTimer = null;
			if (reelState !== 'idle') return;
			void startIdle();
		}, delayMs);
	};

	const startIdle = async () => {
		if (!browser || reelArtworks.length === 0) return;
		// Ambient auto-scroll is decorative; honor reduced-motion users.
		if (prefersReducedMotion.current) return;

		const { gsap } = await loadGsap();
		// The reel may have been spun or destroyed while the module loaded.
		if (reelState !== 'idle' || reelArtworks.length === 0) return;

		const { frameStep } = reelMetrics;
		const poolSize = reelArtworks.length;

		proxy.value = offset;

		idleTween = gsap.to(proxy, {
			value: `+=${poolSize * frameStep}`,
			duration: poolSize * IDLE_DURATION_PER_FRAME,
			ease: 'none',
			repeat: 0,
			onUpdate() {
				offset = proxy.value;
				// Report idle scroll progress as fraction (0-1) of the current cycle
				if (onIdleProgress && poolSize > 0) {
					const cycleLength = poolSize * frameStep;
					const startOffset = proxy.value - (proxy.value % cycleLength || cycleLength);
					const cycleProgress = (proxy.value - startOffset) / cycleLength;
					onIdleProgress(Math.min(1, Math.max(0, cycleProgress)));
				}
			},
			onComplete() {
				offset = proxy.value;
				idleTween = null;
				onIdleCycleComplete?.();
				// Restart idle asynchronously with whatever artworks are current now.
				// This avoids re-entrant recursion under immediate-complete test mocks.
				scheduleIdleRestart();
			}
		});
	};

	const stopIdle = () => {
		stopIdleRestart();
		if (idleTween) {
			idleTween.kill();
			idleTween = null;
		}
	};

	const stopFreeSpin = () => {
		if (!freeSpinTween) return;
		freeSpinTween.kill();
		freeSpinTween = null;
	};

	/**
	 * Leaves the gate at a constant velocity while the caller fetches the
	 * artwork to land on. Safe to call and forget: `spinToArtwork` takes the
	 * motion over, and `cancelFreeSpin` puts the reel back if nothing arrives.
	 */
	export const startFreeSpin = async () => {
		if (reelState !== 'idle' || reelArtworks.length === 0 || !viewportEl) return;
		// A constant-velocity blur is precisely what reduced motion asks us not
		// to do; those visitors get the short landing tween and nothing else.
		if (prefersReducedMotion.current) return;

		reelState = 'free-spinning';
		stopIdle();

		const { gsap } = await loadGsap();
		// The reel may have been retargeted, cancelled or destroyed while the
		// module loaded.
		if (reelState !== 'free-spinning') return;

		const { frameStep } = reelMetrics;
		proxy.value = offset;

		freeSpinTween = gsap.to(proxy, {
			value: `+=${FREE_SPIN_FRAMES * frameStep}`,
			duration: FREE_SPIN_FRAMES / FREE_SPIN_FRAMES_PER_SECOND,
			ease: 'none',
			onUpdate() {
				offset = proxy.value;
			},
			onComplete() {
				offset = proxy.value;
				freeSpinTween = null;
			}
		});
	};

	/** Puts a free-spinning reel back to idle when the artwork never arrives. */
	export const cancelFreeSpin = () => {
		if (reelState !== 'free-spinning') return;
		stopFreeSpin();
		reelState = 'idle';
	};

	const runSpin = async (targetIndex: number, pool: Artwork[], landOn: Artwork) => {
		const { frameSize, frameStep } = reelMetrics;
		const vpWidth = viewportWidth || viewportEl?.offsetWidth || 0;
		const centerX = vpWidth / 2;

		/* We want the chosen artwork centered:
		 *   targetIndex * FRAME_STEP - targetOffset + FRAME_SIZE/2 = centerX
		 * plus a bounded run-up of full frames for the visual spin effect. */
		const fullCycles = Math.min(3 * pool.length, MAX_SPIN_FRAMES) * frameStep;
		const baseTarget = targetIndex * frameStep - centerX + frameSize / 2;

		const minTarget = offset + fullCycles;
		const cycleLen = pool.length * frameStep;
		const remainder = (baseTarget - minTarget) % cycleLen;
		const adjustedRemainder = remainder < 0 ? remainder + cycleLen : remainder;
		const targetOffset = minTarget + adjustedRemainder;

		const { gsap } = await loadGsap();
		if (reelState !== 'spinning') return;

		proxy.value = offset;

		spinTween = gsap.to(proxy, {
			value: targetOffset,
			duration: prefersReducedMotion.current ? 0.8 : 4,
			ease: 'power4.out',
			onUpdate() {
				offset = proxy.value;
			},
			onComplete: () => {
				spinTween = null;
				reelState = 'stopped';
				onLand(landOn);
			}
		});
	};

	export const spin = () => {
		if (reelState === 'spinning' || reelArtworks.length === 0 || !viewportEl) return;
		const pool = reelArtworks;

		reelState = 'spinning';
		stopIdle();

		const randomIndex = Math.floor(Math.random() * pool.length);
		void runSpin(randomIndex, pool, pool[randomIndex]!);
	};

	export const resetToIdle = () => {
		reelState = 'idle';
		// The $effect watching reelState + hasReelArtworks will start the idle tween.
	};

	export const isSpinning = () => reelState === 'spinning';

	/**
	 * Retargets whatever the reel is doing — resting or free-spinning — onto a
	 * decelerating landing. Returns false when the reel cannot take the artwork,
	 * so the caller can stop pretending a spin is under way.
	 */
	export const spinToArtwork = (artwork: Artwork): boolean => {
		if (reelState === 'spinning' || reelArtworks.length === 0 || !viewportEl) return false;

		// Check if artwork is already in the pool; otherwise append it locally
		let targetIndex = reelArtworks.findIndex((a) => a.id === artwork.id);

		if (targetIndex === -1) {
			injectedArtwork = artwork;
			targetIndex = reelArtworks.findIndex((a) => a.id === artwork.id);
			if (targetIndex === -1) return false;
		}

		const pool = reelArtworks;
		reelState = 'spinning';
		stopIdle();
		// Freeze the run-up before runSpin reads `offset` to compute the landing.
		stopFreeSpin();

		void runSpin(targetIndex, pool, artwork);
		return true;
	};

	$effect(() => {
		if (!browser || !viewportEl) return;

		viewportWidth = viewportEl.offsetWidth;
		viewportResizeObserver?.disconnect();
		viewportResizeObserver = new ResizeObserver(() => {
			if (!viewportEl) return;
			viewportWidth = viewportEl.offsetWidth;
		});
		viewportResizeObserver.observe(viewportEl);

		return () => {
			viewportResizeObserver?.disconnect();
			viewportResizeObserver = null;
		};
	});

	$effect(() => {
		if (!browser || !hasReelArtworks || !viewportEl || viewportWidth === 0) return;

		// Only start idle scrolling when the reel is in the idle state.
		// Idle restarts are scheduled at the end of each cycle after it fires
		// onIdleCycleComplete (so the parent can swap the pool) then
		// restarts with the current artworks.
		if (reelState !== 'idle') return;

		scheduleIdleRestart(100);

		return () => {
			stopIdle();
		};
	});

	/*
	 * Destroy-only teardown. The idle effect above returns early while the reel
	 * is spinning, so its last run registers no cleanup at all — leaving the
	 * four-second spin tween alive after the room is gone, still writing
	 * `offset` and finally calling `onLand`, which pushes detail history for an
	 * artwork under whatever room the visitor moved on to.
	 */
	$effect(() => () => {
		stopIdle();
		stopFreeSpin();
		spinTween?.kill();
		spinTween = null;
	});
</script>

<div
	class="reel-container"
	data-reel-orientation="horizontal"
	data-reel-state={reelState}
	data-testid="film-reel"
>
	<div
		class="reel-viewport"
		bind:this={viewportEl}
		data-testid="film-reel-track"
		style={`--reel-frame-size:${reelMetrics.frameSize}px; --reel-highlight-size:${reelMetrics.highlightSize}px; --reel-viewport-height:${reelMetrics.viewportHeight}px;`}
	>
		{#each visibleSlots as slot (slot.key)}
			{@const isSensitiveBlurred = isArtworkBlurred(slot.artwork, {
				adultContentEnabled,
				id: viewerId,
				revealedIds: $revealedIds
			})}
			<div class="reel-frame" style:opacity={slot.opacity} style:transform={slot.transform}>
				<img
					src={slot.artwork.imageUrl}
					alt={slot.artwork.title}
					class="reel-frame-image"
					class:nsfw-blurred={isSensitiveBlurred}
					width={reelMetrics.frameSize}
					height={reelMetrics.frameSize}
				/>
				{#if isSensitiveBlurred}
					<div class="nsfw-overlay">
						<span class="nsfw-badge">18+</span>
					</div>
				{/if}
			</div>
		{/each}

		<!-- Subtle center highlight -->
		<div class="center-highlight"></div>
	</div>
</div>

<style>
	.reel-container {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.reel-viewport {
		position: relative;
		width: 100%;
		height: var(--reel-viewport-height, 280px);
		overflow: hidden;
		border-radius: 12px;
		/* Static edge fade replaces the old per-frame blur depth cue */
		-webkit-mask-image: linear-gradient(90deg, transparent 0, #000 14%, #000 86%, transparent);
		mask-image: linear-gradient(90deg, transparent 0, #000 14%, #000 86%, transparent);
	}

	.reel-frame {
		position: absolute;
		left: 0;
		top: 50%;
		width: var(--reel-frame-size, 256px);
		height: var(--reel-frame-size, 256px);
		border-radius: var(--radius-panel);
		overflow: hidden;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
		background: var(--color-frame-line);
	}

	/*
	 * The compositor hint follows the reel's state instead of living on
	 * `.reel-frame` forever. There are `ceil(viewportWidth / frameStep) + 6`
	 * frames on screen, and `stopped` is a genuinely still reel — no tween is
	 * touching `transform` or `opacity` — so holding a layer per frame there is
	 * pure GPU memory. The three moving states keep it: the idle ambient scroll,
	 * the flick and the button spin all rewrite exactly these two properties on
	 * every frame.
	 */
	.reel-container[data-reel-state='idle'] .reel-frame,
	.reel-container[data-reel-state='free-spinning'] .reel-frame,
	.reel-container[data-reel-state='spinning'] .reel-frame {
		will-change: transform, opacity;
	}

	/*
	 * Under reduced motion the ambient idle scroll never starts and the flick
	 * spin is refused (both bail on `prefersReducedMotion.current`), so an
	 * `idle` reel is a still reel. Only the deliberate button spin still moves,
	 * and it keeps its hint from the rule above.
	 */
	@media (prefers-reduced-motion: reduce) {
		.reel-container[data-reel-state='idle'] .reel-frame,
		.reel-container[data-reel-state='free-spinning'] .reel-frame {
			will-change: auto;
		}
	}

	.reel-frame-image {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	/* The one censoring treatment, defined in routes/layout.css. The reel cannot
	 * use <NsfwImage> — its slots are recycled mid-spin and the per-src fade
	 * would blank frames — so it reads the same two properties instead of
	 * carrying its own blur radius and scrim alpha. */
	.nsfw-blurred {
		scale: 1.04;
		filter: blur(var(--nsfw-blur, 20px)) saturate(0);
	}

	.nsfw-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		background: var(--nsfw-scrim, rgba(45, 36, 32, 0.68));
		border-radius: var(--radius-panel);
	}

	.nsfw-badge {
		display: inline-block;
		padding: 4px 12px;
		border: 2px solid var(--color-paper-bright);
		border-radius: 9999px;
		font-size: 12px;
		font-weight: 900;
		color: var(--color-paper-bright);
	}

	.center-highlight {
		position: absolute;
		top: 50%;
		left: 50%;
		width: var(--reel-highlight-size, 280px);
		height: var(--reel-highlight-size, 280px);
		transform: translate(-50%, -50%);
		border-radius: 12px;
		box-shadow:
			0 0 30px rgba(201, 169, 110, 0.2),
			0 0 60px rgba(201, 169, 110, 0.08);
		border: 2px solid rgba(201, 169, 110, 0.25);
		pointer-events: none;
		z-index: 3;
	}
</style>
