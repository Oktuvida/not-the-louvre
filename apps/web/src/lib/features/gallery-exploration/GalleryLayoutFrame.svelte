<script lang="ts">
	import { type Snippet } from 'svelte';
	import { ArrowLeft, Paintbrush, RefreshCw, Sparkles } from 'lucide-svelte';
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
	import { museumWallPatternAssetUrl } from '$lib/features/shared-ui/generated-art';
	import { warmStudioBackground } from '$lib/features/shared-ui/studio-background-warmup';
	import AmbientParticleOverlay from '$lib/features/shared-ui/components/AmbientParticleOverlay.svelte';
	import type { Viewer } from '$lib/shared/viewer';

	let {
		children,
		roomId,
		viewer,
		context
	}: {
		children: Snippet;
		roomId: GalleryRoomId;
		viewer: Viewer | null;
		context?: GalleryLayoutContext;
	} = $props();

	const galleryLayout = (() => context ?? createGalleryLayoutContext())();
	setGalleryLayoutContext(galleryLayout);
	// A build-time file, not a 42.7KB `data:` URL inlined into every gallery
	// document: the browser caches one copy across rooms, routes and visitors.
	const museumWallPatternUrl = museumWallPatternAssetUrl;
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
	 * content entirely on the compositor. A fixed animation-range paired with
	 * a matching iteration count makes that mapping independent of the
	 * document height: virtualized rows mounting or re-measuring while
	 * artworks load no longer nudge the wall (the previous JS-synced
	 * iteration count raced those height changes by a frame and the wall
	 * visibly bobbed a few pixels).
	 *
	 * Browsers without scroll-timeline support get a static fixed wall.
	 */
	const PATTERN_TILE = 512;
</script>

<div
	class="relative min-h-screen"
	data-testid="gallery-room-shell"
	style="background-color: var(--color-wall);"
>
	<!-- The wall: a single small fixed layer whose translateY is bound to the
	     scroll position on the compositor (see script comment). -->
	<div
		class="wall-layer"
		data-testid="gallery-wall-bricks"
		style={`background-image: url('${museumWallPatternUrl}'); background-size: ${PATTERN_TILE}px ${PATTERN_TILE}px; background-repeat: repeat;`}
	></div>
	<!-- The room's light: one layer carrying all four gradients (see .gallery-atmosphere). -->
	<div class="gallery-atmosphere" aria-hidden="true"></div>

	<AmbientParticleOverlay className="z-5 opacity-90" />

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
					onfocusin={warmStudioBackground}
					onpointerenter={warmStudioBackground}
				>
					<Paintbrush class="h-5 w-5 md:mr-1" />
					<span class="sr-only">Create Art</span>
					<div aria-hidden="true" class="hidden font-semibold md:inline-flex">Create Art</div>
				</GameLink>
				<GameButton
					variant="secondary"
					size="sm"
					className="relative z-20 h-11 min-w-11 rotate-1 px-0 shadow-xl md:h-auto md:min-w-0 md:px-[var(--sticker-padding-x)]"
					disabled={$actionBindings?.isRefreshingGallery ?? false}
					onclick={() => $actionBindings?.onRefresh?.()}
				>
					<RefreshCw
						class={`h-5 w-5 md:mr-1 ${$actionBindings?.isRefreshingGallery ? 'animate-spin' : ''}`}
					/>
					<span class="sr-only"
						>{$actionBindings?.isRefreshingGallery ? 'Refreshing…' : 'Refresh'}</span
					>
					<div aria-hidden="true" class="hidden font-semibold md:inline-flex">
						{$actionBindings?.isRefreshingGallery ? 'Refreshing…' : 'Refresh'}
					</div>
				</GameButton>
			{:else}
				<!--
					The gallery is the shareable surface: a link used to land a
					stranger in a room whose only chrome was Back and the room tabs,
					with no way to join and nothing saying what this is.
				-->
				<GameLink
					href="/"
					variant="primary"
					size="sm"
					className="rotate-1 shadow-xl"
					data-testid="gallery-join-cta"
				>
					<Sparkles class="h-5 w-5 md:mr-1" />
					<span class="font-semibold">Join &amp; draw</span>
				</GameLink>
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
			onNotify={$panelBindings.onNotify}
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
		background: var(--color-wall);
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
		background-color: var(--color-wall);
	}

	/* The room's light, in one element.
	 *
	 * These four gradients used to be four sibling `fixed inset-0` divs, identical
	 * in position, size, stacking level and pointer behaviour and differing only
	 * in their `background` — four viewport-sized paint records over a window
	 * scrolled grid, forced apart only because Tailwind arbitrary values cannot
	 * comma-compose.
	 *
	 * The order is REVERSED against the old DOM order on purpose: stacked
	 * siblings paint last-on-top, a background list paints FIRST-on-top. So the
	 * centre falloff (formerly the last div) leads the list and the warm
	 * top-right radial (formerly the first) closes it. No background-color: the
	 * wall pattern below has to stay visible.
	 *
	 * Deliberately no `will-change`/`transform`: promoting this layer would cost
	 * more than the four unpromoted divs it replaces. */
	.gallery-atmosphere {
		position: fixed;
		inset: 0;
		z-index: 1;
		pointer-events: none;
		background:
			radial-gradient(
				circle at center,
				transparent 0%,
				transparent 42%,
				rgba(12, 9, 7, 0.08) 66%,
				rgba(12, 9, 7, 0.2) 100%
			),
			radial-gradient(
				circle at 12% 92%,
				rgba(18, 10, 4, 0.34) 0%,
				rgba(18, 10, 4, 0.22) 26%,
				rgba(18, 10, 4, 0.08) 46%,
				transparent 66%
			),
			linear-gradient(
				180deg,
				transparent 0%,
				transparent 58%,
				rgba(46, 28, 11, 0.14) 78%,
				rgba(20, 12, 6, 0.28) 100%
			),
			radial-gradient(
				circle at 86% 12%,
				rgba(255, 247, 214, 0.34) 0%,
				rgba(255, 243, 201, 0.18) 18%,
				rgba(255, 241, 196, 0.06) 36%,
				transparent 58%
			);
	}

	@keyframes museum-wall-scroll {
		from {
			transform: translateY(0);
		}
		to {
			transform: translateY(-512px);
		}
	}

	@supports (animation-timeline: scroll()) and (animation-range: 0px 512px) {
		.wall-layer {
			animation: museum-wall-scroll 1s linear;
			animation-timeline: scroll(root);
			/* A fixed 1024-tile range with one iteration per tile resolves to
			 * translateY(-(scrollY mod 512)) at every scroll position, for any
			 * document height — no resync needed when content grows. 524288px
			 * outlasts any realistic page. */
			animation-range: 0px 524288px;
			animation-iteration-count: 1024;
			will-change: transform;
		}

		/* Scroll-driven animations are not covered by the global reduced-motion
		 * reset in routes/layout.css in any useful way: their progress comes from
		 * the scroll range, not from `animation-duration`, and forcing
		 * `animation-iteration-count: 1` would stretch one 512px tile shift across
		 * the whole 524288px range instead of stopping it. Cancel it outright
		 * here, which lands exactly on the documented no-scroll-timeline fallback:
		 * a static fixed wall. The compositor hint goes with it — there is nothing
		 * left to composite. */
		@media (prefers-reduced-motion: reduce) {
			.wall-layer {
				animation: none;
				will-change: auto;
			}
		}
	}
</style>
