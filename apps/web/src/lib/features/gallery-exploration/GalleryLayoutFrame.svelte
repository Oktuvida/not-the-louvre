<script lang="ts">
	import { type Snippet } from 'svelte';
	import { ArrowLeft, Paintbrush, RefreshCw } from 'lucide-svelte';
	import ArtworkDetailPanel from '$lib/features/artwork-presentation/components/ArtworkDetailPanel.svelte';
	import GalleryRoomNav from '$lib/features/gallery-exploration/components/GalleryRoomNav.svelte';
	import type { GalleryRoomId } from '$lib/features/gallery-exploration/model/rooms';
	import GameButton from '$lib/features/shared-ui/components/GameButton.svelte';
	import GameLink from '$lib/features/shared-ui/components/GameLink.svelte';
	import {
		createGalleryLayoutContext,
		setGalleryLayoutContext,
		type GalleryLayoutContext
	} from '$lib/features/gallery-exploration/gallery-layout-context';
	import { createMuseumWallPatternUrl } from '$lib/features/home-entry-scene/canvas/museum-canvas';
	import AmbientParticleOverlay from '$lib/features/shared-ui/components/AmbientParticleOverlay.svelte';

	let {
		children,
		roomId,
		viewer,
		context
	}: {
		children: Snippet;
		roomId: GalleryRoomId;
		viewer: { id: string; role: 'admin' | 'moderator' | 'user' } | null;
		context?: GalleryLayoutContext;
	} = $props();

	const galleryLayout = (() => context ?? createGalleryLayoutContext())();
	setGalleryLayoutContext(galleryLayout);
	const museumWallPatternUrl = createMuseumWallPatternUrl();
	const panelBindings = galleryLayout.panelBindings;
	const actionBindings = galleryLayout.actionBindings;

	/*
	 * Compositor-driven scrolling wall.
	 *
	 * Anything that positions the wall from JavaScript (scroll listeners,
	 * recycled slabs) lags behind the compositor on fast flings and the wall
	 * pops in late. Instead, a small viewport-fixed layer (rasterized once)
	 * is bound to the scroll position with a CSS scroll-driven animation that
	 * loops every 512px — the pattern's tile size — so it moves 1:1 with the
	 * content entirely on the compositor. The only JavaScript is keeping the
	 * iteration count in sync with the document height (one cheap update when
	 * virtualized content grows, inside ResizeObserver so it lands in the
	 * same frame as the scroll range change).
	 *
	 * Browsers without scroll-timeline support get a static fixed wall.
	 */
	const PATTERN_TILE = 512;

	let wallLayerElement = $state<HTMLDivElement>();

	$effect(() => {
		const layer = wallLayerElement;
		if (!layer) return;

		const updateIterations = () => {
			const scrollRange = Math.max(
				document.documentElement.scrollHeight - window.innerHeight,
				PATTERN_TILE
			);
			layer.style.setProperty('--wall-iterations', `${scrollRange / PATTERN_TILE}`);
		};

		updateIterations();
		const observer = new ResizeObserver(updateIterations);
		observer.observe(document.documentElement);
		window.addEventListener('resize', updateIterations);

		return () => {
			observer.disconnect();
			window.removeEventListener('resize', updateIterations);
		};
	});
</script>

<div
	class="relative min-h-screen"
	data-testid="gallery-room-shell"
	style="background-color: #252018;"
>
	<!-- The wall: a single small fixed layer whose translateY is bound to the
	     scroll position on the compositor (see script comment). -->
	<div
		bind:this={wallLayerElement}
		class="wall-layer"
		data-testid="gallery-wall-bricks"
		style={`background-image: url('${museumWallPatternUrl}'); background-size: ${PATTERN_TILE}px ${PATTERN_TILE}px; background-repeat: repeat;`}
	></div>
	<div
		class="pointer-events-none fixed inset-0 z-[1] bg-[radial-gradient(circle_at_86%_12%,rgba(255,247,214,0.34)_0%,rgba(255,243,201,0.18)_18%,rgba(255,241,196,0.06)_36%,transparent_58%)]"
	></div>
	<div
		class="pointer-events-none fixed inset-0 z-[1] bg-[linear-gradient(180deg,transparent_0%,transparent_58%,rgba(46,28,11,0.14)_78%,rgba(20,12,6,0.28)_100%)]"
	></div>
	<div
		class="pointer-events-none fixed inset-0 z-[1] bg-[radial-gradient(circle_at_12%_92%,rgba(18,10,4,0.34)_0%,rgba(18,10,4,0.22)_26%,rgba(18,10,4,0.08)_46%,transparent_66%)]"
	></div>
	<div
		class="pointer-events-none fixed inset-0 z-[1] bg-[radial-gradient(circle_at_center,transparent_0%,transparent_42%,rgba(12,9,7,0.08)_66%,rgba(12,9,7,0.2)_100%)]"
	></div>

	<AmbientParticleOverlay className="z-[5] opacity-90" />

	<div
		class="pointer-events-none sticky top-0 z-40 px-3 pt-3 md:px-8 md:pt-6"
		data-testid="gallery-room-header"
	>
		<div class="pointer-events-auto absolute top-3 left-3 md:top-6 md:left-8">
			<div onclickcapture={$actionBindings?.onBack}>
				<GameLink href="/" variant="ghost" size="sm" className="w-fit -rotate-1 shadow-xl">
					<ArrowLeft class="mr-1 h-5 w-5" />
					<span class="font-semibold">Back</span>
				</GameLink>
			</div>
		</div>

		<div
			class="pointer-events-auto absolute top-3 right-3 z-20 flex flex-row items-start gap-2 md:top-6 md:right-8 md:max-w-none md:flex-col md:items-end md:gap-3"
		>
			{#if viewer}
				<GameLink
					href="/draw"
					variant="primary"
					size="sm"
					className="h-11 min-w-11 rotate-1 px-0 shadow-xl md:h-auto md:min-w-0 md:px-[var(--sticker-padding-x)]"
					contentClassName="px-0 md:px-[calc(var(--sticker-padding-x)-2px)]"
				>
					<Paintbrush class="h-5 w-5 md:mr-1" />
					<span class="sr-only">Create Art</span>
					<div aria-hidden="true" class="hidden font-semibold md:inline-flex">Create Art</div>
				</GameLink>
				<GameButton
					variant="secondary"
					size="sm"
					className="relative z-20 !h-11 !min-w-11 rotate-1 !px-0 shadow-xl md:!h-auto md:!min-w-0 md:!px-[var(--sticker-padding-x)]"
					disabled={$actionBindings?.isRefreshingGallery ?? false}
					onclick={() => $actionBindings?.onRefresh?.()}
				>
					<RefreshCw
						class={`h-5 w-5 md:mr-1 ${$actionBindings?.isRefreshingGallery ? 'animate-spin' : ''}`}
					/>
					<span class="sr-only"
						>{$actionBindings?.isRefreshingGallery ? 'Refreshing' : 'Refresh'}</span
					>
					<div aria-hidden="true" class="hidden font-semibold md:inline-flex">
						{$actionBindings?.isRefreshingGallery ? 'Refreshing' : 'Refresh'}
					</div>
				</GameButton>
			{/if}
		</div>

		<div class="pointer-events-auto mx-auto max-w-full px-12 pt-15 md:w-fit md:px-0 md:pt-1">
			<GalleryRoomNav {roomId} {viewer} />
		</div>
	</div>

	{@render children()}

	{#if $panelBindings}
		<ArtworkDetailPanel
			adultContentEnabled={$panelBindings.adultContentEnabled}
			artwork={$panelBindings.artwork}
			isHydrating={$panelBindings.isHydratingDetail}
			onAdultContentToggle={$panelBindings.onAdultContentToggle}
			onArtworkChange={$panelBindings.onArtworkChange}
			onArtworkPatch={$panelBindings.onArtworkPatch}
			onClose={$panelBindings.onClose}
			revealedArtworkIds={$panelBindings.revealedArtworkIds}
			viewer={$panelBindings.viewer}
		/>
	{/if}
</div>

<style>
	/* Tiles that miss the rasterizer during fast scroll are filled with the
	 * document canvas color (the body background). The site-wide cream would
	 * flash bright against the dark museum wall, so while a gallery shell is
	 * mounted the canvas matches the wall and late tiles become invisible. */
	:global(body:has([data-testid='gallery-room-shell'])) {
		background: #252018;
	}

	/* All wall geometry and behavior lives in component CSS on purpose:
	 * it must hold even where utility classes are unavailable. */
	.wall-layer {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		/* One pattern tile taller than the viewport so the looping shift never
		 * exposes an edge; lvh ignores mobile browser chrome collapsing. */
		height: calc(100vh + 512px);
		height: calc(100lvh + 512px);
		z-index: 0;
		pointer-events: none;
		background-color: #252018;
	}

	@keyframes museum-wall-scroll {
		from {
			transform: translateY(0);
		}
		to {
			transform: translateY(-512px);
		}
	}

	@supports (animation-timeline: scroll()) {
		.wall-layer {
			animation: museum-wall-scroll 1s linear;
			animation-timeline: scroll(root);
			/* One iteration per 512px of scroll range = exact 1:1 motion with
			 * the content. Kept in sync with the document height from script. */
			animation-iteration-count: var(--wall-iterations, 1);
			will-change: transform;
		}
	}
</style>
