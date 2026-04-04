<script lang="ts">
	import { browser } from '$app/environment';
	import { gsap } from '$lib/client/gsap';
	import type { Artwork } from '$lib/features/artwork-presentation/model/artwork';

	let {
		adultContentEnabled = false,
		artworks,
		onIdleCycleComplete,
		onIdleProgress,
		onLand
	}: {
		adultContentEnabled?: boolean;
		artworks: Artwork[];
		onIdleCycleComplete?: () => void;
		onIdleProgress?: (fraction: number) => void;
		onLand: (artwork: Artwork) => void;
	} = $props();

	let viewportEl: HTMLDivElement | undefined = $state();
	let viewportWidth = $state(0);
	let viewportResizeObserver: ResizeObserver | null = null;

	const BUFFER = 3;
	const IDLE_DURATION_PER_FRAME = 4;

	type ReelState = 'idle' | 'spinning' | 'stopped';
	let reelState = $state<ReelState>('idle');
	let idleTween: gsap.core.Tween | null = null;
	let idleRestartTimer: ReturnType<typeof setTimeout> | null = null;

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

	const visibleSlots = $derived.by(() => {
		if (!viewportEl || viewportWidth === 0 || artworks.length === 0) return [];

		const { frameSize, frameStep } = reelMetrics;
		const vpWidth = viewportWidth;
		const centerX = vpWidth / 2;
		const totalSlots = Math.ceil(vpWidth / frameStep) + BUFFER * 2;

		const firstSlotLogical = Math.floor(offset / frameStep) - BUFFER;
		const slots: Array<{
			artwork: Artwork;
			key: number;
			x: number;
			distFromCenter: number;
		}> = [];

		for (let i = 0; i < totalSlots; i++) {
			const slotIndex = firstSlotLogical + i;
			let artworkIndex = slotIndex % artworks.length;
			if (artworkIndex < 0) artworkIndex += artworks.length;

			const x = slotIndex * frameStep - offset;
			const frameCenterX = x + frameSize / 2;
			const distFromCenter = Math.abs(frameCenterX - centerX) / (vpWidth / 2);

			slots.push({
				artwork: artworks[artworkIndex]!,
				key: slotIndex,
				x,
				distFromCenter: Math.min(distFromCenter, 1)
			});
		}

		return slots;
	});

	const getSlotStyle = (slot: { x: number; distFromCenter: number }): string => {
		const { frameSize } = reelMetrics;
		const d = slot.distFromCenter;
		const scale = 1 - d * 0.35;
		const opacity = 1 - d * 0.85;
		const blur = d * 5;

		return (
			`position:absolute;left:${slot.x.toFixed(1)}px;top:50%;` +
			`width:${frameSize}px;height:${frameSize}px;` +
			`transform:translateY(-50%) scale(${scale.toFixed(3)});` +
			`opacity:${opacity.toFixed(3)};` +
			`filter:blur(${blur.toFixed(1)}px);`
		);
	};

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
			startIdle();
		}, delayMs);
	};

	const startIdle = () => {
		if (!browser || artworks.length === 0) return;
		const { frameStep } = reelMetrics;

		proxy.value = offset;

		idleTween = gsap.to(proxy, {
			value: `+=${artworks.length * frameStep}`,
			duration: artworks.length * IDLE_DURATION_PER_FRAME,
			ease: 'none',
			repeat: 0,
			onUpdate() {
				offset = proxy.value;
				// Report idle scroll progress as fraction (0-1) of the current cycle
				if (onIdleProgress && artworks.length > 0) {
					const cycleLength = artworks.length * frameStep;
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

	export const spin = () => {
		if (reelState === 'spinning' || artworks.length === 0 || !viewportEl) return;
		const { frameSize, frameStep } = reelMetrics;

		reelState = 'spinning';
		stopIdle();

		const randomIndex = Math.floor(Math.random() * artworks.length);

		const vpWidth = viewportWidth || viewportEl.offsetWidth;
		const centerX = vpWidth / 2;

		/* We want the chosen artwork centered:
		 *   randomIndex * FRAME_STEP - targetOffset + FRAME_SIZE/2 = centerX
		 * Plus at least 3 full cycles of travel for the visual spin effect. */
		const fullCycles = 3 * artworks.length * frameStep;
		const baseTarget = randomIndex * frameStep - centerX + frameSize / 2;

		const minTarget = offset + fullCycles;
		const cycleLen = artworks.length * frameStep;
		const remainder = (baseTarget - minTarget) % cycleLen;
		const adjustedRemainder = remainder < 0 ? remainder + cycleLen : remainder;
		const targetOffset = minTarget + adjustedRemainder;

		proxy.value = offset;

		gsap.to(proxy, {
			value: targetOffset,
			duration: 4,
			ease: 'power4.out',
			onUpdate() {
				offset = proxy.value;
			},
			onComplete: () => {
				reelState = 'stopped';
				onLand(artworks[randomIndex]!);
			}
		});
	};

	export const resetToIdle = () => {
		reelState = 'idle';
		// The $effect watching reelState + artworks.length will start the idle tween.
	};

	export const isSpinning = () => reelState === 'spinning';

	export const spinToArtwork = (artwork: Artwork) => {
		if (reelState === 'spinning' || artworks.length === 0 || !viewportEl) return;
		const { frameSize, frameStep } = reelMetrics;

		// Check if artwork is already in the pool
		let targetIndex = artworks.findIndex((a) => a.id === artwork.id);

		if (targetIndex === -1) {
			// Inject the artwork at a random position in the pool
			targetIndex = Math.floor(Math.random() * (artworks.length + 1));
			artworks.splice(targetIndex, 0, artwork);
			// Trigger reactivity (artworks is a prop, but parent should pass the same reference)
			artworks = [...artworks];
		}

		reelState = 'spinning';
		stopIdle();

		const vpWidth = viewportWidth || viewportEl.offsetWidth;
		const centerX = vpWidth / 2;

		const fullCycles = 3 * artworks.length * frameStep;
		const baseTarget = targetIndex * frameStep - centerX + frameSize / 2;

		const minTarget = offset + fullCycles;
		const cycleLen = artworks.length * frameStep;
		const remainder = (baseTarget - minTarget) % cycleLen;
		const adjustedRemainder = remainder < 0 ? remainder + cycleLen : remainder;
		const targetOffset = minTarget + adjustedRemainder;

		proxy.value = offset;

		gsap.to(proxy, {
			value: targetOffset,
			duration: 4,
			ease: 'power4.out',
			onUpdate() {
				offset = proxy.value;
			},
			onComplete: () => {
				reelState = 'stopped';
				onLand(artwork);
			}
		});
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
		if (!browser || artworks.length === 0 || !viewportEl || viewportWidth === 0) return;

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
</script>

<div class="reel-container" data-reel-orientation="horizontal" data-testid="film-reel">
	<div
		class="reel-viewport"
		bind:this={viewportEl}
		data-testid="film-reel-track"
		style={`--reel-highlight-size:${reelMetrics.highlightSize}px; --reel-viewport-height:${reelMetrics.viewportHeight}px;`}
	>
		{#each visibleSlots as slot (slot.key)}
			{@const isSensitiveBlurred = slot.artwork.isNsfw && !adultContentEnabled}
			<div class="reel-frame" style={getSlotStyle(slot)}>
				<img
					src={slot.artwork.imageUrl}
					alt={slot.artwork.title}
					class="reel-frame-image"
					class:nsfw-blurred={isSensitiveBlurred}
					width={reelMetrics.frameSize}
					height={reelMetrics.frameSize}
					loading="lazy"
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
	}

	.reel-frame {
		position: relative;
		border-radius: 8px;
		overflow: hidden;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
		will-change: transform, opacity, filter;
		background: #e5dfd5;
	}

	.reel-frame-image {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.nsfw-blurred {
		scale: 1.04;
		filter: blur(20px) saturate(0);
	}

	.nsfw-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		background: rgba(45, 36, 32, 0.72);
		border-radius: 8px;
	}

	.nsfw-badge {
		display: inline-block;
		padding: 4px 12px;
		border: 2px solid #fdfbf7;
		border-radius: 9999px;
		font-size: 12px;
		font-weight: 900;
		color: #fdfbf7;
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
