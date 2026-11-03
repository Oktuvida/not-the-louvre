<script lang="ts">
	import { MessageCircle, Star } from 'lucide-svelte';
	import type { Artwork } from '#lib/features/artwork-presentation/model/artwork.js';
	import NsfwImage from '#lib/features/gallery-exploration/components/NsfwImage.svelte';
	import ScrollSentinel from '#lib/features/gallery-exploration/components/ScrollSentinel.svelte';
	import VirtualizedGrid from '#lib/features/gallery-exploration/components/VirtualizedGrid.svelte';
	import type { GridLayoutSnapshot } from '#lib/features/gallery-exploration/model/grid.js';
	import type {
		GalleryPageInfo,
		LoadMoreArtworks
	} from '#lib/features/gallery-exploration/model/discovery.js';
	import type { GalleryRoomId } from '#lib/features/gallery-exploration/model/rooms.js';
	import { isArtworkBlurred } from '#lib/features/gallery-exploration/model/sensitivity.js';
	import { createSeededAccumulator } from '#lib/features/gallery-exploration/use-seeded-accumulator.svelte.js';
	import PolaroidCard from '#lib/features/shared-ui/components/PolaroidCard.svelte';
	import { writable, type Writable } from 'svelte/store';

	interface Props {
		artworks: Artwork[];
		pageInfo: GalleryPageInfo;
		adultContentEnabled?: boolean;
		feedCacheKey?: GalleryRoomId | null;
		/** The seed is the one this room was left with, until the server's fresh page lands. */
		seedIsRemembered?: boolean;
		/** The room came drawn by the server, with the page, rather than built in the browser. */
		serverRendered?: boolean;
		loadMoreArtworks?: LoadMoreArtworks;
		onPrefetch?: (artworkId: string) => void;
		onSelect?: (artwork: Artwork) => void;
		revealedArtworkIds?: Writable<Set<string>>;
		viewerId?: string | null;
	}

	let {
		artworks,
		pageInfo,
		adultContentEnabled = false,
		feedCacheKey = null,
		seedIsRemembered = false,
		serverRendered = true,
		loadMoreArtworks,
		onPrefetch,
		onSelect = () => {},
		revealedArtworkIds,
		viewerId = null
	}: Props = $props();

	// The grid's measured rows travel with the feed, so coming back lands on
	// the same card rather than on the same pixel of an estimated layout.
	let grid = $state<{ snapshotLayout(): GridLayoutSnapshot | null }>();

	const accumulator = createSeededAccumulator({
		getFeedCacheKey: () => feedCacheKey,
		getSeedIsRemembered: () => seedIsRemembered,
		getArtworks: () => artworks,
		getLayout: () => grid?.snapshotLayout() ?? null,
		getLoadMoreArtworks: () => loadMoreArtworks,
		getPageInfo: () => pageInfo
	});

	const fallbackRevealedIds = writable<Set<string>>(new Set());
	const revealedIds = $derived(revealedArtworkIds ?? fallbackRevealedIds);

	const revealArtwork = (artworkId: string) => {
		revealedIds.update((ids) => new Set([...ids, artworkId]));
	};

	/*
	 * The lead's own copy of PolaroidCard's intent handlers. Touch is left out
	 * on purpose: `pointerdown` fires the moment a finger lands, before the
	 * browser can tell a tap from the start of a scroll, and the `pointercancel`
	 * a flick ends with cannot recall a request that already went out.
	 */
	const signalPointerIntent = (event: PointerEvent, artworkId: string) => {
		if (event.pointerType === 'touch') return;
		onPrefetch?.(artworkId);
	};

	const signalKeyboardIntent = (event: KeyboardEvent, artworkId: string) => {
		if (event.key !== 'Enter' && event.key !== ' ') return;
		onPrefetch?.(artworkId);
	};

	const isLeadBlurred = (artwork: Artwork | null) =>
		!!artwork &&
		isArtworkBlurred(artwork, {
			adultContentEnabled,
			id: viewerId,
			revealedIds: $revealedIds
		});

	const leadArtwork = $derived(accumulator.allArtworks[0] ?? null);
	const leadComments = $derived(
		leadArtwork ? (leadArtwork.commentCount ?? leadArtwork.comments.length) : 0
	);
	const supportingArtworks = $derived(accumulator.allArtworks.slice(1));
</script>

{#if accumulator.allArtworks.length === 0}
	<div
		class="flex min-h-[28rem] flex-col items-center justify-center gap-4 px-6 py-12 text-center"
		data-testid="hot-wall-empty"
	>
		<p
			class="font-display text-lg font-bold text-wall-text"
			style="text-shadow: 0 1px 2px rgba(45,36,32,0.5);"
		>
			Nothing heating up right now
		</p>
		<p class="max-w-sm text-sm text-clay">
			When artworks start climbing fast, they'll appear here on the Hot Wall.
		</p>
	</div>
{:else}
	<div class="space-y-10" data-testid="hot-wall-room">
		<!-- Lead artwork: strongest prominence -->
		{#if leadArtwork}
			<div data-testid="hot-wall-lead" class="flex flex-col items-center gap-4">
				<!-- Hung like the rest of the wall, as a polaroid: the drawing whole and
				     uncovered, the ribbon across its corner, the caption on the paper. -->
				<button
					type="button"
					class="lead-polaroid polaroid-paper group relative mt-12 w-full max-w-md cursor-pointer"
					onclick={() => {
						if (isLeadBlurred(leadArtwork) && viewerId) {
							revealArtwork(leadArtwork.id);
							return;
						}
						onSelect(leadArtwork);
					}}
					onkeydown={(event) => signalKeyboardIntent(event, leadArtwork.id)}
					onpointerdown={(event) => signalPointerIntent(event, leadArtwork.id)}
				>
					<span class="lead-pin push-pin" aria-hidden="true"></span>
					<div class="lead-photo relative aspect-square w-full overflow-hidden">
						<NsfwImage
							src={leadArtwork.imageUrl}
							alt={leadArtwork.title}
							blurred={isLeadBlurred(leadArtwork)}
							ariaLabel={viewerId ? 'Sensitive artwork, click to reveal' : 'Sensitive artwork'}
							className="h-full w-full object-cover"
							loading="eager"
							fetchpriority="high"
						/>
						<span class="lead-ribbon">Hottest right now</span>
					</div>
					<div class="lead-caption">
						{#if leadArtwork.artistAvatar}
							<img
								class="lead-avatar"
								src={leadArtwork.artistAvatar}
								alt=""
								loading="lazy"
								decoding="async"
							/>
						{/if}
						<div class="min-w-0 flex-1">
							<h3 class="lead-title">{leadArtwork.title}</h3>
							<p class="lead-artist">{leadArtwork.artist}</p>
						</div>
						<p class="lead-stats">
							<span class="lead-stat"
								><Star
									class="lead-stat-icon lead-stat-star"
									aria-hidden="true"
								/>{leadArtwork.score}<span class="sr-only"
									>{leadArtwork.score === 1 ? ' vote' : ' votes'}</span
								></span
							>
							<span class="lead-stat"
								><MessageCircle class="lead-stat-icon" aria-hidden="true" />{leadComments}<span
									class="sr-only">{leadComments === 1 ? ' comment' : ' comments'}</span
								></span
							>
						</p>
					</div>
				</button>
			</div>
		{/if}

		<!-- Supporting wall: remaining artworks in a virtualized grid -->
		{#if supportingArtworks.length > 0}
			<div class="w-full">
				<VirtualizedGrid
					bind:this={grid}
					items={supportingArtworks}
					restoredLayout={accumulator.restoredLayout}
					{serverRendered}
				>
					{#snippet renderCard(artwork)}
						<div data-testid={`hot-wall-card-${artwork.id}`}>
							<PolaroidCard
								{artwork}
								{viewerId}
								{adultContentEnabled}
								revealed={$revealedIds.has(artwork.id)}
								onReveal={() => revealArtwork(artwork.id)}
								imageLoading="eager"
								testId={`hot-wall-polaroid-${artwork.id}`}
								onclick={() => onSelect(artwork)}
								onPointerIntent={() => onPrefetch?.(artwork.id)}
							/>
						</div>
					{/snippet}
				</VirtualizedGrid>
			</div>
		{/if}

		<!-- ScrollSentinel for infinite scroll -->
		<ScrollSentinel
			disabled={false}
			error={accumulator.error}
			hasMore={accumulator.hasMore}
			isLoading={accumulator.isLoading}
			onRetry={() => accumulator.retry()}
			skeletonCount={3}
			onTrigger={() => accumulator.loadMore()}
		/>
	</div>
{/if}

<style>
	.lead-polaroid {
		display: block;
		padding: 0.75rem 0.75rem 0;
		text-align: left;
		rotate: -1.5deg;
		transition: translate 300ms ease;
		/* Painted once onto its own layer, like the polaroids below it
		 * (PolaroidCard explains why). */
		will-change: transform;
	}

	.lead-polaroid:hover {
		translate: 0 -0.25rem;
	}

	.lead-pin {
		--pin-size: 1.375rem;
		position: absolute;
		top: -0.75rem;
		left: 50%;
		z-index: 2;
		translate: -50% 0;
	}

	.lead-photo {
		background: #fffdf9;
		box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.07);
	}

	/* A ribbon across the top right corner, the photo's edge trimming it. */
	.lead-ribbon {
		position: absolute;
		top: 1.75rem;
		right: -2.5rem;
		padding: 0.3rem 2.5rem;
		rotate: 35deg;
		background: #b5473c;
		box-shadow: 0 2px 6px rgb(0 0 0 / 0.3);
		font-family: var(--font-display);
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: #fdfbf7;
	}

	.lead-caption {
		display: flex;
		align-items: flex-start;
		gap: 0.5625rem;
		padding: 0.5625rem 0.1875rem 0.75rem;
	}

	.lead-avatar {
		width: 1.875rem;
		height: 1.875rem;
		flex-shrink: 0;
		border: 2.5px solid #2d2420;
		border-radius: 50%;
		object-fit: cover;
		background: #e8ddd0;
	}

	.lead-title {
		margin: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-family: var(--font-hand);
		font-size: 1.5rem;
		font-weight: 700;
		line-height: 1.05;
		color: #2d2420;
	}

	.lead-artist {
		margin: 1px 0 0;
		font-family: var(--font-hand);
		font-size: 1.0625rem;
		color: #7c5f46;
	}

	.lead-stats {
		display: flex;
		flex-direction: column;
		flex-shrink: 0;
		margin: 0;
		text-align: right;
		font-family: var(--font-display);
		font-size: 0.75rem;
		font-weight: 600;
		line-height: 1.45;
		color: #6b5a45;
	}

	.lead-stat {
		display: inline-flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.3em;
	}

	.lead-stat :global(.lead-stat-icon) {
		width: 1.05em;
		height: 1.05em;
		stroke-width: 2.2;
	}

	.lead-stat :global(.lead-stat-star) {
		fill: #d9a43a;
		stroke: #a8772a;
	}
</style>
