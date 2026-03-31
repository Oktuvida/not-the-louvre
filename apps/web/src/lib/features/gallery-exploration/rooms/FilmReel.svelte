<script lang="ts">
	import { browser } from '$app/environment';
	import { gsap } from '$lib/client/gsap';
	import type { Artwork } from '$lib/features/artwork-presentation/model/artwork';

	let {
		adultContentEnabled = false,
		artworks,
		onLand
	}: {
		adultContentEnabled?: boolean;
		artworks: Artwork[];
		onLand: (artwork: Artwork) => void;
	} = $props();

	let viewportEl: HTMLDivElement | undefined = $state();

	const FRAME_SIZE = 256;
	const FRAME_GAP = 14;
	const FRAME_STEP = FRAME_SIZE + FRAME_GAP;
	const BUFFER = 3;
	const IDLE_DURATION_PER_FRAME = 5;

	type ReelState = 'idle' | 'spinning' | 'stopped';
	let reelState = $state<ReelState>('idle');
	let idleTween: gsap.core.Tween | null = null;

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

	const visibleSlots = $derived.by(() => {
		if (!viewportEl || artworks.length === 0) return [];

		const vpWidth = viewportEl.offsetWidth;
		const centerX = vpWidth / 2;
		const totalSlots = Math.ceil(vpWidth / FRAME_STEP) + BUFFER * 2;

		const firstSlotLogical = Math.floor(offset / FRAME_STEP) - BUFFER;
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

			const x = slotIndex * FRAME_STEP - offset;
			const frameCenterX = x + FRAME_SIZE / 2;
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
		const d = slot.distFromCenter;
		const scale = 1 - d * 0.35;
		const opacity = 1 - d * 0.85;
		const blur = d * 5;

		return (
			`position:absolute;left:${slot.x.toFixed(1)}px;top:50%;` +
			`width:${FRAME_SIZE}px;height:${FRAME_SIZE}px;` +
			`transform:translateY(-50%) scale(${scale.toFixed(3)});` +
			`opacity:${opacity.toFixed(3)};` +
			`filter:blur(${blur.toFixed(1)}px);`
		);
	};

	/* Proxy object that GSAP tweens — we read .value in onUpdate */
	const proxy = { value: 0 };

	const startIdle = () => {
		if (!browser || artworks.length === 0) return;

		proxy.value = offset;

		idleTween = gsap.to(proxy, {
			value: `+=${artworks.length * FRAME_STEP}`,
			duration: artworks.length * IDLE_DURATION_PER_FRAME,
			ease: 'none',
			repeat: -1,
			onUpdate() {
				offset = proxy.value;
			}
		});
	};

	const stopIdle = () => {
		if (idleTween) {
			idleTween.kill();
			idleTween = null;
		}
	};

	export const spin = () => {
		if (reelState === 'spinning' || artworks.length === 0 || !viewportEl) return;

		reelState = 'spinning';
		stopIdle();

		const randomIndex = Math.floor(Math.random() * artworks.length);

		const vpWidth = viewportEl.offsetWidth;
		const centerX = vpWidth / 2;

		/* We want the chosen artwork centered:
		 *   randomIndex * FRAME_STEP - targetOffset + FRAME_SIZE/2 = centerX
		 * Plus at least 3 full cycles of travel for the visual spin effect. */
		const fullCycles = 3 * artworks.length * FRAME_STEP;
		const baseTarget = randomIndex * FRAME_STEP - centerX + FRAME_SIZE / 2;

		const minTarget = offset + fullCycles;
		const cycleLen = artworks.length * FRAME_STEP;
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
		startIdle();
	};

	export const isSpinning = () => reelState === 'spinning';

	$effect(() => {
		if (!browser || artworks.length === 0 || !viewportEl) return;

		const timer = setTimeout(() => startIdle(), 100);

		return () => {
			clearTimeout(timer);
			stopIdle();
		};
	});
</script>

<div class="reel-container" data-testid="film-reel">
	<div class="reel-viewport" bind:this={viewportEl} data-testid="film-reel-track">
		{#each visibleSlots as slot (slot.key)}
			{@const isSensitiveBlurred = slot.artwork.isNsfw && !adultContentEnabled}
			<div class="reel-frame" style={getSlotStyle(slot)}>
				<img
					src={slot.artwork.imageUrl}
					alt={slot.artwork.title}
					class="reel-frame-image"
					class:nsfw-blurred={isSensitiveBlurred}
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
		height: 280px;
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
		width: 280px;
		height: 280px;
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
