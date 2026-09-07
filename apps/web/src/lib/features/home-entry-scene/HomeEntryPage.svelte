<script lang="ts">
	import { Paintbrush } from 'lucide-svelte';
	import { onMount, type Snippet } from 'svelte';
	import { browser } from '$app/environment';
	import { goto, replaceState } from '$app/navigation';
	import { page } from '$app/stores';
	import { resolve } from '$app/paths';
	import { gsap } from '$lib/client/gsap';
	import type { HomeAuthUser } from '$lib/features/home-entry-scene/auth-contract';
	import type {
		HomePreviewCard,
		HomeSceneArtworkSlot
	} from '$lib/features/home-entry-scene/state/home-entry.svelte';
	import FadeOverlay from '$lib/features/home-entry-scene/components/FadeOverlay.svelte';
	import HomeHeroOverlay from '$lib/features/home-entry-scene/components/HomeHeroOverlay.svelte';
	import PersistentNav from '$lib/features/home-entry-scene/components/PersistentNav.svelte';
	import StudioLoadingFallback from '$lib/features/shared-3d-world/components/StudioLoadingFallback.svelte';
	import {
		homeGalleryTarget,
		homeStudioTarget,
		warmNavigationTargetWhenIdle
	} from '$lib/features/home-entry-scene/navigation-warmup';
	import { prefersReducedMotion } from '$lib/features/home-entry-scene/reduced-motion';
	import type { EntryFlowState } from '$lib/features/home-entry-scene/state/entry-state.svelte';
	import GameButton from '$lib/features/shared-ui/components/GameButton.svelte';

	let {
		children,
		adultContentEnabled = false,
		entryState = 'outside',
		onAvatarSaved,
		previewCards = [],
		sceneArtworks = [],
		user = null
	}: {
		children?: Snippet;
		adultContentEnabled?: boolean;
		entryState?: EntryFlowState;
		onAvatarSaved?: (payload: {
			avatarDrawingDocument?: import('$lib/features/stroke-json/document').DrawingDocumentV2 | null;
			avatarOnboardingCompletedAt: Date;
			avatarUrl: string;
		}) => void;
		previewCards?: HomePreviewCard[];
		sceneArtworks?: HomeSceneArtworkSlot[];
		user?: HomeAuthUser | null;
	} = $props();

	const FADE_DURATION = 0.4;
	const GALLERY_EXIT_HOLD = 2;
	const TOP_CLOSE_DURATION = 2;
	/** Hard ceiling on the returning veil, whatever the state machine does. */
	const RETURN_FADE_SAFETY_MS = 1000;

	const returnOrigin = browser ? $page.url?.searchParams?.get('from') : null;
	const returningFromGallery = returnOrigin === 'gallery';
	const returningFromStudio = returnOrigin === 'studio';
	const isReturning = returningFromGallery || returningFromStudio;

	const resolveInitialPose = (): 'default' | 'left-wall' | 'top-close' => {
		if (returningFromGallery) return 'left-wall';
		if (returningFromStudio) return 'top-close';
		return 'default';
	};

	let scenePose = $state<'default' | 'left-wall' | 'top-close'>(resolveInitialPose());
	let initialPose: 'default' | 'left-wall' | 'top-close' = resolveInitialPose();
	let isExiting = $state(false);
	let isReturningActive = $state(isReturning);
	let fadeOverlayVisible = $state(isReturning);
	let fadeOverlayOpacity = $state(isReturning ? 1 : 0);

	/*
	 * three.js + threlte + GLTF + DRACO are ~344KB gz — three times the rest of
	 * the app — and none of it is needed for the controls the visitor actually
	 * clicks first. The scene is imported after mount so Come In and the nav
	 * hydrate ahead of it; the loading card below is rendered from first paint so
	 * the frame is never an empty hole while the chunk is in flight.
	 */
	let SceneComponent = $state<
		typeof import('$lib/features/home-entry-scene/scene/StudioScene.svelte').default | null
	>(null);
	let sceneMediaState = $state<'error' | 'loaded' | 'pending'>('pending');

	const sceneReady = $derived(sceneMediaState === 'loaded');
	const sceneFailed = $derived(sceneMediaState === 'error');

	let exitDelayedCall: gsap.core.Tween | null = null;
	let exitFadeTween: gsap.core.Tween | null = null;
	let returnFadeTween: gsap.core.Tween | null = null;
	let returnFadeSafetyHandle: ReturnType<typeof setTimeout> | null = null;
	let returnFadeStarted = false;
	let destroyed = false;

	/** Clean the ?from= param from the URL without triggering navigation. */
	if (browser && isReturning) {
		replaceState(resolve('/'), window.history.state);
	}

	onMount(() => {
		let cancelled = false;

		void import('$lib/features/home-entry-scene/scene/StudioScene.svelte')
			.then((module) => {
				if (!cancelled) {
					SceneComponent = module.default;
				}
			})
			.catch(() => {
				if (!cancelled) {
					sceneMediaState = 'error';
				}
			});

		return () => {
			cancelled = true;
		};
	});

	/*
	 * Teardown-only effect. Everything scheduled here outlives the component
	 * otherwise: the 2s delayedCall in particular used to fire after the visitor
	 * had already navigated somewhere else and drag them into the gallery.
	 */
	$effect(() => () => {
		destroyed = true;
		exitDelayedCall?.kill();
		exitFadeTween?.kill();
		returnFadeTween?.kill();

		if (returnFadeSafetyHandle !== null) {
			clearTimeout(returnFadeSafetyHandle);
			returnFadeSafetyHandle = null;
		}
	});

	$effect(() => {
		if (entryState !== 'inside' && scenePose !== 'default' && !isReturningActive) {
			scenePose = 'default';
		}
	});

	const clearReturnOverlay = () => {
		fadeOverlayOpacity = 0;
		fadeOverlayVisible = false;
		isReturningActive = false;
	};

	/**
	 * When returning from gallery or studio: fade out the grey overlay and, when
	 * the 3D scene is what is being revealed, trigger the reverse camera move.
	 *
	 * The fade is deliberately NOT gated on `entryState === 'inside'`: a visitor
	 * who signs up and has not finished their avatar comes back in `auth-signup`,
	 * and gating there left the opaque veil on screen forever with no escape but
	 * a reload. The latch keeps a mid-flight state change from starting a second
	 * tween whose onUpdate would fight the first one over the same opacity.
	 */
	$effect(() => {
		if (!isReturningActive) return;

		if (entryState === 'inside') {
			// Start the reverse camera animation immediately (behind the overlay).
			scenePose = 'default';
		}

		if (returnFadeStarted) return;
		returnFadeStarted = true;

		const fade = { opacity: 1 };
		returnFadeTween = gsap.to(fade, {
			opacity: 0,
			duration: 0.5,
			delay: 0.15,
			ease: 'power2.out',
			onUpdate: () => {
				fadeOverlayOpacity = fade.opacity;
			},
			onComplete: clearReturnOverlay
		});

		// Idempotent safety net, guarded by the same latch: the veil can never
		// outlive ~1s even if the tween never completes.
		returnFadeSafetyHandle = setTimeout(clearReturnOverlay, RETURN_FADE_SAFETY_MS);
	});

	/** Called by PersistentNav when the GALLERY button is clicked. */
	const handleGalleryNavigate = () => {
		if (isExiting) return;
		isExiting = true;
		scenePose = 'left-wall';

		// Touch and keyboard fallback for the pointer/focus warm-up in PersistentNav.
		warmNavigationTargetWhenIdle(homeGalleryTarget);

		// Start the fade overlay partway through the zoom animation so
		// navigation happens earlier — overlapping with the camera zoom
		// instead of waiting for it to finish entirely. With reduced motion the
		// camera snaps, so holding here would only stall on a finished frame.
		const holdSeconds = prefersReducedMotion() ? 0 : GALLERY_EXIT_HOLD;

		exitDelayedCall = gsap.delayedCall(holdSeconds, () => {
			fadeOverlayVisible = true;
			const fade = { opacity: 0 };
			exitFadeTween = gsap.to(fade, {
				opacity: 1,
				duration: FADE_DURATION,
				ease: 'power2.in',
				onUpdate: () => {
					fadeOverlayOpacity = fade.opacity;
				},
				onComplete: () => {
					if (destroyed) return;
					// eslint-disable-next-line svelte/no-navigation-without-resolve -- homeGalleryTarget is a resolved route extended with query params
					void goto(homeGalleryTarget);
				}
			});
		});
	};

	/** Called when the Studio button is clicked — plays top-close animation then navigates to /draw. */
	const handleStudioNavigate = () => {
		if (isExiting) return;
		isExiting = true;
		scenePose = 'top-close';

		warmNavigationTargetWhenIdle(homeStudioTarget);

		// Start the fade overlay near the end of the camera animation so
		// navigation overlaps with the final stretch. The fade itself is 0.4s,
		// so we begin it (duration − 0.55)s into the animation.
		const fadeDelay = prefersReducedMotion()
			? 0
			: Math.max(0, TOP_CLOSE_DURATION - FADE_DURATION - 0.15);

		exitDelayedCall = gsap.delayedCall(fadeDelay, () => {
			fadeOverlayVisible = true;
			const fade = { opacity: 0 };
			exitFadeTween = gsap.to(fade, {
				opacity: 1,
				duration: FADE_DURATION,
				ease: 'power2.in',
				onUpdate: () => {
					fadeOverlayOpacity = fade.opacity;
				},
				onComplete: () => {
					if (destroyed) return;
					// eslint-disable-next-line svelte/no-navigation-without-resolve -- homeStudioTarget is resolved in navigation-warmup
					void goto(homeStudioTarget);
				}
			});
		});
	};
</script>

<svelte:head>
	<!--
		The studio model and its DRACO decoder are discovered late: the GLB is only
		requested once the scene chunk executes, and the decoder only once the GLB
		header has been parsed. Prefetching overlaps both with hydration.
	-->
	<link rel="prefetch" href="/models/studio-transformed.glb" />
	<link rel="prefetch" href="/draco/draco_wasm_wrapper.js" />
	<link rel="prefetch" href="/draco/draco_decoder.wasm" />
</svelte:head>

<div
	class="relative h-screen w-full overflow-hidden bg-gradient-to-br from-[#f5f0e8] via-[#fdfbf7] to-[#e8e0d5]"
>
	<div class="absolute inset-0 flex items-center justify-center">
		<div class="relative h-full w-full opacity-80">
			<div
				class="relative h-full w-full overflow-hidden border-[var(--border-frame)] bg-[radial-gradient(circle_at_50%_18%,_rgba(255,255,255,0.44),_transparent_30%),linear-gradient(180deg,_#ccb194_0%,_#8b6f57_100%)] shadow-[var(--shadow-strong)]"
			>
				<div
					aria-hidden={sceneReady}
					class={`absolute inset-0 z-10 transition-opacity duration-500 ${sceneReady ? 'opacity-0' : 'opacity-100'}`}
				>
					<StudioLoadingFallback failed={sceneFailed} />
				</div>
				{#if SceneComponent}
					<SceneComponent
						{entryState}
						{initialPose}
						{scenePose}
						avatarUrl={user?.avatarUrl ?? null}
						artworkSlots={sceneArtworks}
						onMediaStateChange={(state) => {
							sceneMediaState = state;
						}}
					/>
				{/if}
			</div>
			<div
				class="bg-gradient-radial absolute inset-0 from-transparent via-transparent to-[#f5f0e8]"
			></div>
		</div>
	</div>
	<HomeHeroOverlay {isExiting} />
	<PersistentNav
		{adultContentEnabled}
		{isExiting}
		{onAvatarSaved}
		onGalleryNavigate={handleGalleryNavigate}
		{previewCards}
		{user}
	/>
	{#if entryState === 'inside' && user}
		<div
			class="pointer-events-auto absolute bottom-52 left-1/2 z-[25] flex -translate-x-1/2 flex-col items-center gap-4 transition-all duration-700 ease-[cubic-bezier(0.4,0,1,1)] md:bottom-28"
			class:translate-y-[120%]={isExiting}
			class:opacity-0={isExiting}
			inert={isExiting}
		>
			<GameButton
				variant="primary"
				size="hero"
				className="shadow-[0_16px_40px_rgba(0,0,0,0.35)]"
				onclick={handleStudioNavigate}
			>
				<Paintbrush size={28} />
				<span>Studio</span>
			</GameButton>
		</div>
	{/if}
	{@render children?.()}
</div>

<FadeOverlay opacity={fadeOverlayOpacity} visible={fadeOverlayVisible} />
