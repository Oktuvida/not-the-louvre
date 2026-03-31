<script lang="ts">
	import { Paintbrush } from 'lucide-svelte';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { resolve } from '$app/paths';
	import gsap from 'gsap';
	import type { Snippet } from 'svelte';
	import type { HomeAuthUser } from '$lib/features/home-entry-scene/auth-contract';
	import type {
		HomePreviewCard,
		HomeSceneArtworkSlot
	} from '$lib/features/home-entry-scene/state/home-entry.svelte';
	import FadeOverlay from '$lib/features/home-entry-scene/components/FadeOverlay.svelte';
	import HomeHeroOverlay from '$lib/features/home-entry-scene/components/HomeHeroOverlay.svelte';
	import PersistentNav from '$lib/features/home-entry-scene/components/PersistentNav.svelte';
	import StudioScene from '$lib/features/home-entry-scene/scene/StudioScene.svelte';
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
			avatarDrawingDocument?: import('$lib/features/stroke-json/document').DrawingDocumentV1 | null;
			avatarOnboardingCompletedAt: Date;
			avatarUrl: string;
		}) => void;
		previewCards?: HomePreviewCard[];
		sceneArtworks?: HomeSceneArtworkSlot[];
		user?: HomeAuthUser | null;
	} = $props();

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

	/** Clean the ?from= param from the URL without triggering navigation. */
	if (browser && isReturning) {
		const cleanUrl = new URL($page.url!);
		cleanUrl.searchParams.delete('from');
		window.history.replaceState({}, '', cleanUrl.pathname + cleanUrl.search);
	}

	$effect(() => {
		if (entryState !== 'inside' && scenePose !== 'default' && !isReturningActive) {
			scenePose = 'default';
		}
	});

	/**
	 * When returning from gallery or studio: wait a tick for the scene to mount
	 * at the correct pose, then fade out the gray overlay and trigger the
	 * reverse camera animation.
	 */
	$effect(() => {
		if (!isReturningActive || entryState !== 'inside') return;

		// Start the reverse camera animation immediately (behind the overlay)
		scenePose = 'default';

		// Then fade out the overlay so the scene is already animating when revealed
		const fade = { opacity: 1 };
		gsap.to(fade, {
			opacity: 0,
			duration: 0.5,
			delay: 0.15,
			ease: 'power2.out',
			onUpdate: () => {
				fadeOverlayOpacity = fade.opacity;
			},
			onComplete: () => {
				fadeOverlayVisible = false;
				isReturningActive = false;
			}
		});
	});

	/** Called by PersistentNav when the GALLERY button is clicked. */
	const handleGalleryNavigate = () => {
		if (isExiting) return;
		isExiting = true;
		scenePose = 'left-wall';

		// Start the fade overlay partway through the zoom animation so
		// navigation happens earlier — overlapping with the camera zoom
		// instead of waiting for it to finish entirely.
		gsap.delayedCall(2.0, () => {
			fadeOverlayVisible = true;
			const fade = { opacity: 0 };
			gsap.to(fade, {
				opacity: 1,
				duration: 0.4,
				ease: 'power2.in',
				onUpdate: () => {
					fadeOverlayOpacity = fade.opacity;
				},
				onComplete: () => {
					const url = `${resolve('/gallery/[room]', { room: 'your-studio' })}?from=home`;
					// eslint-disable-next-line svelte/no-navigation-without-resolve -- URL is already resolved and extended with query params
					void goto(url);
				}
			});
		});
	};

	/** Called when the Studio button is clicked — plays top-close animation then navigates to /draw. */
	const handleStudioNavigate = () => {
		if (isExiting) return;
		isExiting = true;
		scenePose = 'top-close';

		// Start the fade overlay near the end of the camera animation so
		// navigation overlaps with the final stretch. The fade itself is 0.4s,
		// so we begin it (duration − 0.55)s into the animation.
		const TOP_CLOSE_DURATION = 2;
		const FADE_DURATION = 0.4;
		const fadeDelay = Math.max(0, TOP_CLOSE_DURATION - FADE_DURATION - 0.15);

		gsap.delayedCall(fadeDelay, () => {
			fadeOverlayVisible = true;
			const fade = { opacity: 0 };
			gsap.to(fade, {
				opacity: 1,
				duration: FADE_DURATION,
				ease: 'power2.in',
				onUpdate: () => {
					fadeOverlayOpacity = fade.opacity;
				},
				onComplete: () => {
					void goto(resolve('/draw'));
				}
			});
		});
	};
</script>

<div
	class="relative h-screen w-full overflow-hidden bg-gradient-to-br from-[#f5f0e8] via-[#fdfbf7] to-[#e8e0d5]"
>
	<div class="absolute inset-0 flex items-center justify-center">
		<div class="relative h-full w-full opacity-80">
			<StudioScene
				{entryState}
				{initialPose}
				{scenePose}
				avatarUrl={user?.avatarUrl ?? null}
				artworkSlots={sceneArtworks}
			/>
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
	{#if entryState === 'inside' && user && !isExiting}
		<div
			class="pointer-events-auto absolute bottom-28 left-1/2 z-[25] flex -translate-x-1/2 flex-col items-center gap-4 transition-all duration-500"
			class:translate-y-[120%]={isExiting}
			class:opacity-0={isExiting}
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
