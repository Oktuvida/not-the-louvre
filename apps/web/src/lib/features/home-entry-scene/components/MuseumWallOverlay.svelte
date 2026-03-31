<script lang="ts">
	import { Paintbrush } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import gsap from 'gsap';
	import GameButton from '$lib/features/shared-ui/components/GameButton.svelte';
	import graffitiLogoUrl from '$lib/assets/logo-graffiti.svg';
	import MuseumWindowFrame from '$lib/features/home-entry-scene/components/MuseumWindowFrame.svelte';
	import {
		createMuseumWallPatternUrl,
		museumWindowAspectRatio,
		museumWindowOpening
	} from '$lib/features/home-entry-scene/canvas/museum-canvas';
	import type {
		EntryFlowEvent,
		EntryFlowState
	} from '$lib/features/home-entry-scene/state/entry-state.svelte';

	const WINDOW_MARGIN = 80;
	const FINAL_ZOOM_MULTIPLIER = 1.1;
	const ENTER_DURATION = 2.08;
	const RESET_DURATION = 1.13;
	const GLASS_FOCUS_BOUNDS = {
		left: 0.376,
		top: 1.06,
		width: 0.246,
		height: 2.395
	};

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
	let targetScale = $state(1);
	let finalScale = $state(1);
	let translateX = $state(0);
	let translateY = $state(0);
	let wallMaskUrl = $state('');
	let wallPatternUrl = $state('');

	let forwardTimeline: gsap.core.Timeline | null = null;
	let reverseTimeline: gsap.core.Timeline | null = null;
	let enterFallbackHandle: ReturnType<typeof setTimeout> | null = null;
	let resetFallbackHandle: ReturnType<typeof setTimeout> | null = null;

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

	const buildWallMask = (width: number, height: number, rect: DOMRect) => {
		const svg = `
			<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
				<path fill="black" fill-rule="evenodd" d="M0 0H${width}V${height}H0Z M${rect.left} ${rect.top}H${rect.right}V${rect.bottom}H${rect.left}Z"/>
			</svg>
		`;

		return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
	};

	const updateWillChange = (active: boolean) => {
		if (!overlayElement || !wallSceneElement || !wallTextureElement || !frameVisualElement) {
			return;
		}

		overlayElement.style.willChange = active ? 'opacity' : '';
		wallSceneElement.style.willChange = active ? 'transform' : '';
		wallTextureElement.style.willChange = active ? 'opacity' : '';
		frameVisualElement.style.willChange = active ? 'opacity, filter' : '';
	};

	const resetWallStyles = () => {
		if (!overlayElement || !wallSceneElement || !wallTextureElement || !frameVisualElement) {
			return;
		}

		gsap.set(overlayElement, { clearProps: 'opacity' });
		gsap.set(wallSceneElement, { clearProps: 'transform' });
		gsap.set(wallTextureElement, { clearProps: 'opacity' });
		gsap.set(frameVisualElement, { clearProps: 'opacity,filter' });
		updateWillChange(false);
	};

	const updateMeasurements = () => {
		if (!frameElement || !openingElement || typeof window === 'undefined') {
			return;
		}

		const measuredOpening = openingElement.getBoundingClientRect();
		const focusRect = new DOMRect(
			measuredOpening.left + measuredOpening.width * GLASS_FOCUS_BOUNDS.left,
			measuredOpening.top + measuredOpening.height * GLASS_FOCUS_BOUNDS.top,
			measuredOpening.width * GLASS_FOCUS_BOUNDS.width,
			measuredOpening.height * GLASS_FOCUS_BOUNDS.height
		);

		wallMaskUrl = buildWallMask(window.innerWidth, window.innerHeight, measuredOpening);

		targetScale = Math.max(
			(window.innerWidth + WINDOW_MARGIN * 2) / focusRect.width,
			(window.innerHeight + WINDOW_MARGIN * 2) / focusRect.height
		);
		finalScale = targetScale * FINAL_ZOOM_MULTIPLIER;
		translateX = window.innerWidth / 2 - (focusRect.left + focusRect.width / 2);
		translateY = window.innerHeight / 2 - (focusRect.top + focusRect.height / 2);
	};

	const createForwardTimeline = () => {
		if (
			!overlayElement ||
			!wallSceneElement ||
			!wallTextureElement ||
			!frameVisualElement ||
			!authOverlayElement
		) {
			return null;
		}

		return gsap
			.timeline({
				paused: true,
				onStart: () => {
					updateWillChange(true);
					gsap.set(overlayElement, { opacity: 1 });
					gsap.set(wallTextureElement, { opacity: 1 });
					gsap.set(frameVisualElement, { opacity: 1, filter: 'blur(0px)' });
					gsap.set(authOverlayElement, { opacity: 0, scale: 0.95 });
					gsap.set(wallSceneElement, { x: 0, y: 0, scale: 1, yPercent: 0 });
				},
				onComplete: () => {
					updateWillChange(false);
				}
			})
			.to(
				wallSceneElement,
				{
					scale: finalScale,
					x: translateX,
					y: translateY,
					duration: ENTER_DURATION,
					ease: 'power4.in'
				},
				0
			)
			.to(
				wallTextureElement,
				{
					opacity: 0,
					duration: 0.26,
					ease: 'power3.in'
				},
				1.52
			)
			.to(
				frameVisualElement,
				{
					opacity: 0,
					filter: 'blur(18px) brightness(1.18)',
					duration: 0.1,
					ease: 'power4.in'
				},
				1.99
			)
			.call(
				() => {
					dispatch('TRANSITION_DONE');
				},
				undefined,
				ENTER_DURATION
			);
	};

	const createReverseTimeline = () => {
		if (
			!overlayElement ||
			!wallSceneElement ||
			!wallTextureElement ||
			!frameVisualElement ||
			!authOverlayElement
		) {
			return null;
		}

		return gsap
			.timeline({
				paused: true,
				onStart: () => {
					updateWillChange(true);
					gsap.set(overlayElement, { opacity: 0 });
					gsap.set(wallTextureElement, { opacity: 0 });
					gsap.set(frameVisualElement, { opacity: 0, filter: 'blur(18px) brightness(1.18)' });
					gsap.set(authOverlayElement, { opacity: 1, scale: 1 });
					gsap.set(wallSceneElement, {
						scale: finalScale,
						x: translateX,
						y: translateY,
						yPercent: 0
					});
				},
				onComplete: () => {
					resetWallStyles();
					dispatch('TRANSITION_RESET_DONE');
				}
			})
			.to(
				overlayElement,
				{
					opacity: 1,
					duration: 0.38,
					ease: 'power2.out'
				},
				0
			)
			.to(
				authOverlayElement,
				{
					opacity: 0,
					scale: 0.95,
					duration: 0.3,
					ease: 'power1.in'
				},
				0
			)
			.to(
				frameVisualElement,
				{
					opacity: 1,
					filter: 'blur(0px) brightness(1)',
					duration: 0.26,
					ease: 'power1.out'
				},
				0.3
			)
			.to(
				wallTextureElement,
				{
					opacity: 1,
					duration: 0.38,
					ease: 'power2.in'
				},
				0.3
			)
			.to(
				wallSceneElement,
				{
					scale: 1,
					x: 0,
					y: 0,
					duration: RESET_DURATION,
					ease: 'power3.out'
				},
				0
			);
	};

	const rebuildTimelines = () => {
		forwardTimeline?.kill();
		reverseTimeline?.kill();

		updateMeasurements();
		forwardTimeline = createForwardTimeline();
		reverseTimeline = createReverseTimeline();
	};

	onMount(() => {
		const handleResize = () => {
			rebuildTimelines();
		};

		wallPatternUrl = createMuseumWallPatternUrl();
		rebuildTimelines();

		window.addEventListener('resize', handleResize);

		return () => {
			window.removeEventListener('resize', handleResize);
			forwardTimeline?.kill();
			reverseTimeline?.kill();
			clearFallbacks();
		};
	});

	$effect(() => {
		if (authOverlayElement && !forwardTimeline && !reverseTimeline) {
			rebuildTimelines();
		}
	});

	$effect(() => {
		if (entryState === 'transitioning-in') {
			clearFallbacks();
			if (!forwardTimeline) {
				rebuildTimelines();
			}
			reverseTimeline?.pause(0);
			forwardTimeline?.restart();
			enterFallbackHandle = setTimeout(
				() => {
					if (entryState === 'transitioning-in') {
						dispatch('TRANSITION_DONE');
					}
				},
				ENTER_DURATION * 1000 + 150
			);
		}

		if (entryState === 'transitioning-out') {
			clearFallbacks();
			if (!reverseTimeline) {
				rebuildTimelines();
			}
			forwardTimeline?.pause(0);
			reverseTimeline?.restart();
			resetFallbackHandle = setTimeout(
				() => {
					if (entryState === 'transitioning-out') {
						dispatch('TRANSITION_RESET_DONE');
					}
				},
				RESET_DURATION * 1000 + 150
			);
		}

		if (entryState === 'outside') {
			clearFallbacks();
			forwardTimeline?.pause(0);
			reverseTimeline?.pause(0);
			resetWallStyles();
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
		class="pointer-events-none absolute inset-0 z-[20] overflow-hidden"
	>
		<div bind:this={wallSceneElement} class="absolute inset-0 origin-center">
			<!-- Base wall texture masked around the window opening. -->
			<div
				bind:this={wallTextureElement}
				class="absolute inset-0 bg-[#252018]"
				style={`background-image:url('${wallPatternUrl}');background-size:512px 512px;background-repeat:repeat;mask-image:${wallMaskUrl};mask-size:100% 100%;mask-repeat:no-repeat;-webkit-mask-image:${wallMaskUrl};-webkit-mask-size:100% 100%;-webkit-mask-repeat:no-repeat;`}
			></div>
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

			<!-- Framed window composition centered on the wall. -->
			<div class="absolute inset-0 flex items-center justify-center px-6">
				<div bind:this={frameVisualElement} class="relative flex items-center justify-center">
					<!-- Graffiti logo floating beside the frame. -->
					<img
						src={graffitiLogoUrl}
						alt=""
						draggable="false"
						class="pointer-events-none absolute top-[15%] right-[calc(100%-4.5rem)] z-[1] w-[clamp(24rem,36vw,34rem)] -rotate-[10deg] opacity-95"
						style="filter: sepia(0.42) saturate(1.08) contrast(0.96) brightness(0.88) drop-shadow(0 8px 16px rgba(44, 24, 8, 0.18));"
					/>
					<!-- Soft shadow that anchors the logo to the wall. -->
					<div
						class="pointer-events-none absolute top-[36%] right-[calc(100%-2.6rem)] z-[0] h-[16rem] w-[24rem] -rotate-[9deg] bg-[radial-gradient(ellipse_at_62%_24%,rgba(26,14,6,0.2)_0%,rgba(26,14,6,0.28)_28%,rgba(26,14,6,0.16)_52%,transparent_72%)] blur-[10px]"
					></div>
					<div
						bind:this={frameElement}
						class="relative w-[min(80vw,49rem)] max-w-[49rem] min-w-[19rem]"
						style={`aspect-ratio:${museumWindowAspectRatio};`}
					>
						<!-- Outer glow catching light on the frame edges. -->
						<div
							class="pointer-events-none absolute -inset-[2%] rounded-[2rem] bg-[radial-gradient(circle_at_88%_12%,rgba(255,249,226,0.34)_0%,rgba(255,243,210,0.16)_24%,transparent_56%)]"
						></div>
						<!-- Broad frame shadow that gives the piece weight. -->
						<div
							class="pointer-events-none absolute inset-0 rounded-[1.6rem] shadow-[-26px_28px_36px_rgba(52,32,14,0.18),18px_-18px_28px_rgba(255,247,223,0.1)]"
						></div>
						<!-- Side shadow to separate the frame from the wall. -->
						<div
							class="pointer-events-none absolute top-[12%] -left-[8%] h-[88%] w-[92%] bg-[radial-gradient(ellipse_at_88%_12%,rgba(46,28,11,0.18)_0%,rgba(46,28,11,0.28)_36%,rgba(46,28,11,0.14)_58%,transparent_74%)] blur-[14px]"
						></div>
						<div
							bind:this={openingElement}
							class="absolute overflow-hidden rounded-[0.25rem] border border-[#24180e]/25 bg-[linear-gradient(180deg,rgba(255,255,255,0.16),rgba(255,255,255,0.03))] shadow-[inset_0_0_40px_rgba(26,18,12,0.28)]"
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
								class="absolute inset-y-[12%] right-[8%] w-[22%] rounded-full bg-white/6 blur-xl"
							></div>
						</div>

						<!-- Ornamental frame artwork rendered as a separate component. -->
						<MuseumWindowFrame />
					</div>

					<!-- Entry button shown only when the visitor is outside. -->
					<div class="pointer-events-none absolute top-full left-1/2 z-[25] -translate-x-1/2">
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
