<script lang="ts">
	import { Paintbrush } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import { gsap } from '#lib/client/gsap.js';
	import GameButton from '#lib/features/shared-ui/components/GameButton.svelte';
	import graffitiLogoUrl from '#lib/assets/logo-graffiti.svg';
	import { applyMuseumWallWillChange } from '#lib/features/home-entry-scene/components/museum-wall-will-change.js';
	import {
		WALL_ZOOM_REDUCED_MOTION_DURATION_MS,
		playWallZoomIn,
		playWallZoomOut,
		resetWallZoom,
		type WallZoomGeometry
	} from '#lib/features/home-entry-scene/components/museum-wall-zoom.js';
	import { prefersReducedMotion } from '#lib/features/home-entry-scene/reduced-motion.js';
	import { waitForPageLayoutReady } from '#lib/features/home-entry-scene/components/page-layout-ready.js';
	import MuseumWindowFrame from '#lib/features/home-entry-scene/components/MuseumWindowFrame.svelte';
	import {
		museumWindowAspectRatio,
		museumWindowOpening
	} from '#lib/features/home-entry-scene/canvas/museum-canvas.js';
	import { rasterizeSvgUrl } from '#lib/features/home-entry-scene/canvas/svg-bitmap.js';
	import { museumWallPatternAssetUrl } from '#lib/features/shared-ui/generated-art.js';
	import type {
		EntryFlowEvent,
		EntryFlowState
	} from '#lib/features/home-entry-scene/state/entry-state.svelte.js';

	const WINDOW_MARGIN = 80;
	const FINAL_ZOOM_MULTIPLIER = 1.1;
	const ENTER_DURATION = 2.08;
	const RESET_DURATION = 1.13;
	const WALL_OPENING_OFFSETS_PX = {
		bottom: 0,
		left: 0,
		right: 0,
		top: 0
	} as const;
	const GLASS_FOCUS_BOUNDS = {
		left: 0.376,
		top: 1.06,
		width: 0.246,
		height: 2.395
	};
	// The window's opening before anything is measured, from the same numbers
	// that place the window (.wall-layout below), so the first paint cuts the
	// wall in the right place on every screen.
	const OPENING_LEFT_CSS = 'calc(var(--frame-left) + (var(--frame-width) * 130 / 720))';
	const OPENING_RIGHT_CSS = 'calc(var(--frame-left) + (var(--frame-width) * 590 / 720))';
	const OPENING_TOP_CSS = 'calc(var(--frame-top) + (var(--frame-height) * 118 / 640))';
	const OPENING_BOTTOM_CSS = 'calc(var(--frame-top) + (var(--frame-height) * 533 / 640))';

	let {
		entryState,
		dispatch,
		authOverlayElement = null
	}: {
		entryState: EntryFlowState;
		dispatch: (event: EntryFlowEvent) => void;
		authOverlayElement?: HTMLDivElement | null;
	} = $props();

	let overlayElement = $state<HTMLDivElement | null>(null);
	let wallSceneElement = $state<HTMLDivElement | null>(null);
	let wallTextureElement = $state<HTMLDivElement | null>(null);
	let frameVisualElement = $state<HTMLDivElement | null>(null);
	let frameElement = $state<HTMLDivElement | null>(null);
	let openingElement = $state<HTMLDivElement | null>(null);
	const zoomGeometry: WallZoomGeometry = { finalScale: 1, translateX: 0, translateY: 0 };
	// SVG sources render the first frame; bitmaps replace them after mount so
	// the zoom never triggers main-thread SVG re-rasterization (see svg-bitmap).
	const WALL_TILE_CSS_PX = 512;
	const LOGO_MAX_WIDTH_CSS_PX = 544; // .wall-sign's 34rem upper bound
	const LOGO_VIEWBOX_RATIO = 440 / 680;
	// A committed static file rather than an inlined data: URL — the pattern is
	// 42.7KB of markup and it was serialized into the home document twice.
	const wallPatternSvgUrl = museumWallPatternAssetUrl;
	let wallPatternUrl = $state(wallPatternSvgUrl);
	let logoUrl = $state(graffitiLogoUrl);
	let wallOpeningBounds = $state({
		bottom: OPENING_BOTTOM_CSS,
		left: OPENING_LEFT_CSS,
		right: OPENING_RIGHT_CSS,
		top: OPENING_TOP_CSS
	});

	let enterFallbackHandle: ReturnType<typeof setTimeout> | null = null;
	let resetFallbackHandle: ReturnType<typeof setTimeout> | null = null;
	let measurePending = false;
	let needsRemeasure = false;

	const clampUnit = (value: number) => Math.min(1, Math.max(0, value));
	const toPercent = (value: number) => `${clampUnit(value) * 100}%`;

	const isVisible = $derived(entryState !== 'inside');
	const showCta = $derived(entryState === 'outside');

	const clearFallbacks = () => {
		if (enterFallbackHandle) {
			clearTimeout(enterFallbackHandle);
			enterFallbackHandle = null;
		}

		if (resetFallbackHandle) {
			clearTimeout(resetFallbackHandle);
			resetFallbackHandle = null;
		}
	};

	const wallElements = () =>
		overlayElement && wallSceneElement && wallTextureElement && frameVisualElement
			? { frameVisualElement, overlayElement, wallSceneElement, wallTextureElement }
			: null;

	const resetWallStyles = () => {
		const elements = wallElements();
		if (!elements) {
			return;
		}

		// Keep will-change:transform on the wall scene so its compositor layer (and
		// its full-resolution raster) survives between the open/close animations.
		// Toggling it off destroys the layer; Chrome then recreates it at the ~14x
		// zoomed scale when the close starts and only rasters the visible centre,
		// so shrinking reveals un-rastered wall edges as white/checkerboard patches.
		resetWallZoom(elements);
	};

	const updateMeasurements = () => {
		if (!overlayElement || !frameElement || !openingElement || typeof window === 'undefined') {
			return;
		}

		const overlayRect = overlayElement.getBoundingClientRect();
		const measuredOpening = openingElement.getBoundingClientRect();
		const focusRect = new DOMRect(
			measuredOpening.left + measuredOpening.width * GLASS_FOCUS_BOUNDS.left,
			measuredOpening.top + measuredOpening.height * GLASS_FOCUS_BOUNDS.top,
			measuredOpening.width * GLASS_FOCUS_BOUNDS.width,
			measuredOpening.height * GLASS_FOCUS_BOUNDS.height
		);

		const targetScale = Math.max(
			(window.innerWidth + WINDOW_MARGIN * 2) / focusRect.width,
			(window.innerHeight + WINDOW_MARGIN * 2) / focusRect.height
		);

		wallOpeningBounds = {
			bottom: toPercent(
				(measuredOpening.bottom - overlayRect.top + WALL_OPENING_OFFSETS_PX.bottom) /
					overlayRect.height
			),
			left: toPercent(
				(measuredOpening.left - overlayRect.left + WALL_OPENING_OFFSETS_PX.left) / overlayRect.width
			),
			right: toPercent(
				(measuredOpening.right - overlayRect.left + WALL_OPENING_OFFSETS_PX.right) /
					overlayRect.width
			),
			top: toPercent(
				(measuredOpening.top - overlayRect.top + WALL_OPENING_OFFSETS_PX.top) / overlayRect.height
			)
		};

		zoomGeometry.finalScale = targetScale * FINAL_ZOOM_MULTIPLIER;
		zoomGeometry.translateX = window.innerWidth / 2 - (focusRect.left + focusRect.width / 2);
		zoomGeometry.translateY = window.innerHeight / 2 - (focusRect.top + focusRect.height / 2);
	};

	const scheduleMeasurement = async () => {
		if (measurePending || typeof window === 'undefined' || typeof document === 'undefined') {
			return;
		}

		measurePending = true;
		await waitForPageLayoutReady({ document, window });
		measurePending = false;
		updateMeasurements();
	};

	onMount(() => {
		const handleResize = () => {
			// `outside` is the only state in which the wall is untransformed, and
			// updateMeasurements reads the opening's live client rect. Measuring
			// during the zoom (orientation change, or a desktop resize while the auth
			// sheet is open) reads the ~14x-scaled opening: targetScale collapses and
			// the two slabs' clip-path percentages saturate to 0%/100%, so the close
			// then animates from geometry the wall is not actually sitting at.
			if (entryState !== 'outside') {
				needsRemeasure = true;
				return;
			}

			void scheduleMeasurement();
		};

		void scheduleMeasurement();

		const rasterScale = Math.min(window.devicePixelRatio || 1, 2);
		void rasterizeSvgUrl(wallPatternSvgUrl, {
			height: WALL_TILE_CSS_PX * rasterScale,
			width: WALL_TILE_CSS_PX * rasterScale
		})
			.then((url) => {
				wallPatternUrl = url;
			})
			.catch(() => {
				// Keep the SVG source if rasterization fails.
			});
		void rasterizeSvgUrl(graffitiLogoUrl, {
			height: LOGO_MAX_WIDTH_CSS_PX * rasterScale * LOGO_VIEWBOX_RATIO,
			width: LOGO_MAX_WIDTH_CSS_PX * rasterScale
		})
			.then((url) => {
				logoUrl = url;
			})
			.catch(() => {
				// Keep the SVG source if rasterization fails.
			});

		window.addEventListener('resize', handleResize);

		return () => {
			window.removeEventListener('resize', handleResize);
			clearFallbacks();
		};
	});

	$effect(() => {
		const reducedMotion = prefersReducedMotion();

		if (entryState === 'transitioning-in') {
			clearFallbacks();
			const elements = wallElements();

			if (elements) {
				// The wall is untransformed while outside, so this measurement is fresh.
				updateMeasurements();
				applyMuseumWallWillChange(elements, true);

				if (authOverlayElement) {
					gsap.set(authOverlayElement, { opacity: 0, scale: 0.95 });
				}

				const zoom = playWallZoomIn(elements, zoomGeometry, { reducedMotion });
				zoom.finished
					.then(() => {
						// Intentionally keep will-change:transform active here. Removing it
						// destroys the wall's compositor layer; the close animation would then
						// recreate it at the zoomed-in scale and re-raster from scratch,
						// producing checkerboard patches (see resetWallStyles).
						dispatch('TRANSITION_DONE');
					})
					.catch(() => {
						// Cancelled by a newer state change; that path owns cleanup.
					});
			}

			enterFallbackHandle = setTimeout(
				() => {
					if (entryState === 'transitioning-in') {
						dispatch('TRANSITION_DONE');
					}
				},
				reducedMotion ? WALL_ZOOM_REDUCED_MOTION_DURATION_MS + 150 : ENTER_DURATION * 1000 + 150
			);
		}

		if (entryState === 'transitioning-out') {
			clearFallbacks();
			const elements = wallElements();

			if (elements) {
				applyMuseumWallWillChange(elements, true);

				if (authOverlayElement) {
					// Same duration collapse as the wall zoom beside it: a GSAP tween
					// is invisible to the global reduced-motion CSS reset, so the
					// preference has to be applied here.
					gsap.to(authOverlayElement, {
						opacity: 0,
						scale: 0.95,
						duration: reducedMotion ? 0 : 0.3,
						ease: 'power1.in'
					});
				}

				const zoom = playWallZoomOut(elements, zoomGeometry, { reducedMotion });
				zoom.finished
					.then(() => {
						resetWallStyles();
						dispatch('TRANSITION_RESET_DONE');
					})
					.catch(() => {
						// Cancelled by a newer state change; that path owns cleanup.
					});
			}

			resetFallbackHandle = setTimeout(
				() => {
					if (entryState === 'transitioning-out') {
						dispatch('TRANSITION_RESET_DONE');
					}
				},
				reducedMotion ? WALL_ZOOM_REDUCED_MOTION_DURATION_MS + 150 : RESET_DURATION * 1000 + 150
			);
		}

		if (entryState === 'outside') {
			clearFallbacks();
			resetWallStyles();

			if (needsRemeasure) {
				needsRemeasure = false;
				// resetWallStyles() cancelled the WAAPI animations and removed the
				// inline transform, so the opening measures untransformed again. This
				// is the only safe moment to consume a deferred resize: remeasuring
				// before the close would replace the geometry the wall is sitting at.
				void scheduleMeasurement();
			}
		}

		if (
			entryState === 'auth-login' ||
			entryState === 'auth-signup' ||
			entryState === 'auth-recovery' ||
			entryState === 'inside'
		) {
			clearFallbacks();
		}
	});
</script>

{#if isVisible}
	<div
		bind:this={overlayElement}
		class="wall-layout pointer-events-none absolute inset-0 z-20 overflow-hidden"
	>
		<div
			bind:this={wallSceneElement}
			data-testid="museum-wall-scene"
			class="absolute inset-0 origin-center"
		>
			<!-- Wall texture rebuilt as two L-shaped slabs instead of a fullscreen mask. -->
			<div bind:this={wallTextureElement} class="absolute inset-0">
				<div
					data-testid="museum-wall-slab-left"
					class="absolute inset-0 bg-wall"
					style={`background-image:url('${wallPatternUrl}');background-size:512px 512px;background-repeat:repeat;clip-path:polygon(0% 0%,100% 0%,100% ${wallOpeningBounds.top},${wallOpeningBounds.left} ${wallOpeningBounds.top},${wallOpeningBounds.left} 100%,0% 100%);`}
				></div>
				<div
					data-testid="museum-wall-slab-right"
					class="absolute inset-0 bg-wall"
					style={`background-image:url('${wallPatternUrl}');background-size:512px 512px;background-repeat:repeat;clip-path:polygon(100% 0%,100% 100%,0% 100%,0% ${wallOpeningBounds.bottom},${wallOpeningBounds.right} ${wallOpeningBounds.bottom},${wallOpeningBounds.right} 0%);`}
				></div>
			</div>
			<!-- Warm top-right bloom that makes the wall feel sunlit. -->
			<div
				class="absolute inset-0 bg-[radial-gradient(circle_at_86%_12%,rgba(255,247,214,0.42)_0%,rgba(255,243,201,0.24)_18%,rgba(255,241,196,0.08)_36%,transparent_58%)]"
			></div>
			<!-- Lower vertical shading to ground the scene and darken the base of the wall. -->
			<div
				class="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,transparent_52%,rgba(46,28,11,0.16)_74%,rgba(20,12,6,0.36)_100%)]"
			></div>
			<!-- Bottom-left vignette that adds depth around the corner. -->
			<div
				class="absolute inset-0 bg-[radial-gradient(circle_at_12%_92%,rgba(18,10,4,0.52)_0%,rgba(18,10,4,0.34)_26%,rgba(18,10,4,0.14)_46%,transparent_66%)]"
			></div>
			<!-- Overall vignette to keep focus near the center window. -->
			<div
				class="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,transparent_38%,rgba(12,9,7,0.16)_62%,rgba(12,9,7,0.38)_100%)]"
			></div>

			<!-- The window, its sign and its button, placed for the screen (.wall-layout). -->
			<div class="absolute inset-0">
				<div bind:this={frameVisualElement} class="wall-window">
					<!-- The graffiti sign beside the window, or above it on an upright screen. -->
					<div class="wall-sign pointer-events-none z-1">
						<!-- Soft shadow that anchors the sign to the wall. -->
						<div
							class="wall-sign-shadow pointer-events-none bg-[radial-gradient(ellipse_at_62%_24%,rgba(26,14,6,0.2)_0%,rgba(26,14,6,0.28)_28%,rgba(26,14,6,0.16)_52%,transparent_72%)] blur-[10px]"
						></div>
						<img
							src={logoUrl}
							data-testid="museum-wall-logo"
							alt=""
							draggable="false"
							class="relative block w-full opacity-95"
							style="filter: sepia(0.42) saturate(1.08) contrast(0.96) brightness(0.88) drop-shadow(0 8px 16px rgba(44, 24, 8, 0.18));"
						/>
					</div>
					<div
						bind:this={frameElement}
						class="relative h-full w-full"
						style={`aspect-ratio:${museumWindowAspectRatio};`}
					>
						<!-- Outer glow catching light on the frame edges. -->
						<div
							class="pointer-events-none absolute -inset-[2%] rounded-4xl bg-[radial-gradient(circle_at_88%_12%,rgba(255,249,226,0.34)_0%,rgba(255,243,210,0.16)_24%,transparent_56%)]"
						></div>
						<!-- Broad frame shadow that gives the piece weight. -->
						<div
							class="pointer-events-none absolute inset-0 rounded-[1.6rem] shadow-[-26px_28px_36px_rgba(52,32,14,0.18),18px_-18px_28px_rgba(255,247,223,0.1)]"
						></div>
						<!-- Side shadow to separate the frame from the wall. -->
						<div
							class="pointer-events-none absolute top-[12%] -left-[8%] h-[88%] w-[92%] bg-[radial-gradient(ellipse_at_88%_12%,rgba(46,28,11,0.16)_0%,rgba(46,28,11,0.24)_34%,rgba(46,28,11,0.12)_58%,transparent_82%)]"
						></div>
						<div
							bind:this={openingElement}
							class="absolute overflow-hidden rounded-sm border border-[#24180e]/25 bg-[linear-gradient(180deg,rgba(255,255,255,0.16),rgba(255,255,255,0.03))] shadow-[inset_0_0_40px_rgba(26,18,12,0.28)]"
							style={`left:${museumWindowOpening.left * 100}%;top:${museumWindowOpening.top * 100}%;width:${museumWindowOpening.width * 100}%;height:${museumWindowOpening.height * 100}%;`}
						>
							<!-- Reflections across the glass surface. -->
							<div
								class="absolute inset-0 bg-[radial-gradient(circle_at_72%_16%,rgba(255,251,236,0.26),transparent_22%),radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.1),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.08),transparent_26%,transparent_68%,rgba(255,246,216,0.14))]"
							></div>
							<!-- Dark edge on the left to suggest glass thickness. -->
							<div
								class="absolute inset-y-0 left-0 w-[16%] bg-[linear-gradient(90deg,rgba(35,22,11,0.18),transparent)]"
							></div>
							<!-- Bottom tint that deepens the window cavity. -->
							<div
								class="absolute inset-x-0 bottom-0 h-[18%] bg-[linear-gradient(180deg,transparent,rgba(34,21,10,0.14))]"
							></div>
							<!-- Stable glass wash for Chrome; avoids backdrop-filter compositing shifts during transforms. -->
							<div
								class="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.025)_48%,rgba(24,14,8,0.06))]"
							></div>
							<div
								class="absolute inset-y-[12%] right-[8%] w-[22%] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.05)_45%,transparent_72%)]"
							></div>
						</div>

						<!-- Ornamental frame artwork rendered as a separate component. -->
						<MuseumWindowFrame />
					</div>

					<!-- Entry button shown only when the visitor is outside. -->
					<div class="wall-cta pointer-events-none z-25">
						<GameButton
							onclick={() => dispatch('COME_IN')}
							size="hero"
							className={`pointer-events-auto shadow-[0_16px_40px_rgba(0,0,0,0.35)] transition-[opacity,transform] duration-300 ${showCta ? 'opacity-100 translate-y-0' : 'pointer-events-none opacity-0 -translate-y-3'}`}
						>
							<Paintbrush size={28} />
							<span>Come In</span>
						</GameButton>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	/*
	 * The front door, laid out for the screen it is on, from the window's size:
	 * the window as large as both the width and the height allow, Come In just
	 * under it, and the sign beside it (landscape) or above it (portrait), all
	 * clear of what stands around them: Gallery at the bottom, the best pieces
	 * down the right. (A signed-in artist starts inside, past the wall.) It used to size the window from the width alone,
	 * so on most laptops the sign hung past the left edge and on a 1280×720
	 * screen Come In sat below the fold.
	 *
	 * The variables live on the overlay so the wall slabs, which cut the
	 * window's opening from them before anything is measured, see them too.
	 */
	.wall-layout {
		--cta-height: 4.25rem;
		--gap: 1rem;
		--top-reserve: 1rem;
		--bottom-reserve: 2rem;
		--side-reserve: 0px;
		--avail: calc(100dvh - var(--top-reserve) - var(--bottom-reserve));
		--frame-width: min(
			49rem,
			80vw,
			calc((var(--avail) - var(--gap) - var(--cta-height)) * 720 / 640),
			calc(100vw - 2 * var(--side-reserve))
		);
		--frame-height: calc(var(--frame-width) * 640 / 720);
		--frame-left: calc(50% - var(--frame-width) / 2);
		--frame-top: calc(
			var(--top-reserve) + (var(--avail) - var(--frame-height) - var(--gap) - var(--cta-height)) / 2
		);
		/* Hung from the window's left, over its moulding by 4.5rem: as wide as the
		 * wall left of the window holds (tilted 10°, its box is a tenth wider than
		 * the sign), and short enough to clear Gallery below it. */
		--sign-width: min(
			34rem,
			36vw,
			calc(((100vw - var(--frame-width)) / 2 + 3.5rem) / 1.1),
			calc(
				(100dvh - var(--frame-top) - 0.15 * var(--frame-height) - var(--bottom-reserve) - 5rem) /
					0.75
			)
		);
	}

	/* A short window on its side (a phone): tighter margins. */
	@media (orientation: landscape) and (max-height: 30rem) {
		.wall-layout {
			--gap: 0.5rem;
			--top-reserve: 0.5rem;
			--bottom-reserve: 1rem;
		}
	}

	/* Where the best pieces hang down the right (PersistentNav), the window
	 * keeps clear of them. */
	@media (orientation: landscape) and (min-width: 48rem) and (min-height: 40rem) {
		.wall-layout {
			--side-reserve: 15rem;
		}
	}

	/* Upright: the sign above the window, Come In under it, Gallery below. */
	@media (orientation: portrait) {
		.wall-layout {
			--gap: 0.75rem;
			--bottom-reserve: 6rem;
			--sign-width: min(26rem, 80vw, calc(var(--avail) * 0.34));
			--sign-box: calc(var(--sign-width) * 0.75);
			--frame-width: min(
				34rem,
				88vw,
				calc((var(--avail) - var(--sign-box) - 2 * var(--gap) - var(--cta-height)) * 720 / 640)
			);
			--frame-top: calc(
				var(--top-reserve) +
					(
						var(--avail) - var(--sign-box) - var(--frame-height) - 2 * var(--gap) -
							var(--cta-height)
					) /
					2 + var(--sign-box) + var(--gap)
			);
		}
	}

	.wall-window {
		position: absolute;
		left: var(--frame-left);
		top: var(--frame-top);
		width: var(--frame-width);
		height: var(--frame-height);
	}

	.wall-sign {
		position: absolute;
		top: 15%;
		right: calc(100% - 4.5rem);
		width: var(--sign-width);
		rotate: -10deg;
	}

	.wall-sign-shadow {
		position: absolute;
		top: 42%;
		right: 5.6%;
		width: 70.6%;
		height: 72.6%;
		rotate: 1deg;
	}

	.wall-cta {
		position: absolute;
		top: calc(100% + var(--gap));
		left: 50%;
		translate: -50% 0;
	}

	@media (orientation: portrait) {
		.wall-sign {
			top: auto;
			right: auto;
			bottom: calc(100% + var(--gap) + var(--sign-width) * 0.05);
			left: 50%;
			translate: -50% 0;
			rotate: -6deg;
		}
	}
</style>
