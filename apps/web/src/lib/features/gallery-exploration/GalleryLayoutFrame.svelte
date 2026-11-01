<script lang="ts">
	import { type Snippet } from 'svelte';
	import { ArrowLeft, Brush, Paintbrush, RefreshCw } from 'lucide-svelte';
	import ArtworkDetailPanel from '#lib/features/artwork-presentation/components/ArtworkDetailPanel.svelte';
	import GalleryRoomNav from '#lib/features/gallery-exploration/components/GalleryRoomNav.svelte';
	import type { GalleryRoomId } from '#lib/features/gallery-exploration/model/rooms.js';
	import GameButton from '#lib/features/shared-ui/components/GameButton.svelte';
	import GameLink from '#lib/features/shared-ui/components/GameLink.svelte';
	import {
		createGalleryLayoutContext,
		setGalleryLayoutContext,
		type GalleryLayoutContext
	} from '#lib/features/gallery-exploration/gallery-layout-context.js';
	import { museumWallPatternAssetUrl } from '#lib/features/shared-ui/generated-art.js';
	import { warmStudioBackground } from '#lib/features/shared-ui/studio-background-warmup.js';
	import AmbientParticleOverlay from '#lib/features/shared-ui/components/AmbientParticleOverlay.svelte';
	import type { Viewer } from '#lib/shared/viewer.js';

	let {
		children,
		roomId,
		viewer,
		context
	}: {
		children?: Snippet;
		/** `null` on a page that is not a room, such as an artwork's permalink. */
		roomId: GalleryRoomId | null;
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
	 * The wall is the shell's own background, so it scrolls with the artworks
	 * the way any content does: on the compositor, in step with every frame, in
	 * every browser. It used to be a viewport-fixed layer moved by a
	 * scroll-driven animation, which Chrome rasterizes at a lower resolution
	 * than the screen (the bricks came out about a sixth as sharp on a Retina
	 * display) and which only moved where scroll timelines exist.
	 */
	const PATTERN_TILE = 512;
</script>

<div
	class="relative min-h-screen"
	data-testid="gallery-room-shell"
	style={`background-color: var(--color-wall); background-image: url('${museumWallPatternUrl}'); background-size: ${PATTERN_TILE}px ${PATTERN_TILE}px; background-repeat: repeat;`}
>
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
			class="pointer-events-auto absolute top-3 right-3 z-20 flex flex-row items-start gap-2 md:top-6 md:right-8 md:max-w-none xl:flex-col xl:items-end xl:gap-3"
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
					<Brush class="h-5 w-5 md:mr-1" />
					<span class="font-semibold">Join &amp; draw</span>
				</GameLink>
			{/if}
		</div>

		<!-- The tabs share the top line with Back and the actions only from xl:
		     narrower, the four of them plus a signed-in artist's two actions
		     ran into each other, so they sit on a line of their own. -->
		<div class="pointer-events-auto mx-auto max-w-full px-12 pt-15 xl:w-fit xl:px-0 xl:pt-1">
			<GalleryRoomNav {roomId} {viewer} />
		</div>
	</div>

	{@render children?.()}

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

	/* A big screen gets a bigger gallery, not only a wider one. Past 1440px the
	 * gallery's rem grows with the window, up to half as big again at 2160px,
	 * so the room's furniture (the podium, the lead artwork, the notes, the
	 * header), the grid's cards and gaps and the postcard all scale together,
	 * while the grid also gains columns as it widens. Media queries keep the
	 * browser's own rem, so no breakpoint moves. */
	:global(html:has([data-testid='gallery-room-shell'])) {
		font-size: clamp(100%, 100vw / 90, 150%);
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
</style>
