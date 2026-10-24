<script lang="ts">
	import type { Artwork } from '#lib/features/artwork-presentation/model/artwork.js';
	import ScrollSentinel from '#lib/features/gallery-exploration/components/ScrollSentinel.svelte';
	import VirtualizedGrid from '#lib/features/gallery-exploration/components/VirtualizedGrid.svelte';
	import type { GridLayoutSnapshot } from '#lib/features/gallery-exploration/model/grid.js';
	import type {
		GalleryPageInfo,
		LoadMoreArtworks
	} from '#lib/features/gallery-exploration/model/discovery.js';
	import { GALLERY_GRID_GAP } from '#lib/features/gallery-exploration/model/grid.js';
	import type { GalleryRoomId } from '#lib/features/gallery-exploration/model/rooms.js';
	import { createSeededAccumulator } from '#lib/features/gallery-exploration/use-seeded-accumulator.svelte.js';
	import PolaroidCard from '#lib/features/shared-ui/components/PolaroidCard.svelte';

	interface Props {
		artworks: Artwork[];
		pageInfo: GalleryPageInfo;
		adultContentEnabled?: boolean;
		feedCacheKey?: GalleryRoomId | null;
		loadMoreArtworks?: LoadMoreArtworks;
		onPrefetch?: (artworkId: string) => void;
		onSelect: (artwork: Artwork) => void;
		viewerId?: string | null;
	}

	let {
		artworks,
		pageInfo,
		adultContentEnabled = false,
		feedCacheKey = null,
		loadMoreArtworks,
		onPrefetch,
		onSelect,
		viewerId = null
	}: Props = $props();

	// The grid's measured rows travel with the feed, so coming back lands on
	// the same card rather than on the same pixel of an estimated layout.
	let grid = $state<{ snapshotLayout(): GridLayoutSnapshot | null }>();

	const accumulator = createSeededAccumulator({
		getFeedCacheKey: () => feedCacheKey,
		getArtworks: () => artworks,
		getLayout: () => grid?.snapshotLayout() ?? null,
		getLoadMoreArtworks: () => loadMoreArtworks,
		getPageInfo: () => pageInfo
	});

	// The studio grid breathes a little wider than the other rooms.
	const STUDIO_GRID_GAP = GALLERY_GRID_GAP + 12;
</script>

<div class="w-full">
	<VirtualizedGrid
		bind:this={grid}
		items={accumulator.allArtworks}
		gap={STUDIO_GRID_GAP}
		restoredLayout={accumulator.restoredLayout}
	>
		{#snippet renderCard(artwork)}
			<div data-testid={`virtualized-artwork-card-${artwork.id}`}>
				<PolaroidCard
					{artwork}
					{viewerId}
					{adultContentEnabled}
					imageLoading="eager"
					onclick={() => onSelect(artwork)}
					onPointerIntent={() => onPrefetch?.(artwork.id)}
				/>
			</div>
		{/snippet}
	</VirtualizedGrid>
	<ScrollSentinel
		disabled={false}
		error={accumulator.error}
		hasMore={accumulator.hasMore}
		isLoading={accumulator.isLoading}
		rootMargin="500px"
		onRetry={() => accumulator.retry()}
		skeletonCount={3}
		skeletonGridClassName="grid gap-15 py-6"
		onTrigger={() => accumulator.loadMore()}
	/>
</div>
