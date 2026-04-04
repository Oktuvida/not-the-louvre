<script lang="ts">
	import type { Artwork } from '$lib/features/artwork-presentation/model/artwork';
	import { createArtworkAccumulator } from '$lib/features/gallery-exploration/artwork-accumulator.svelte';
	import ScrollSentinel from '$lib/features/gallery-exploration/components/ScrollSentinel.svelte';
	import VirtualizedGrid from '$lib/features/gallery-exploration/components/VirtualizedGrid.svelte';
	import PolaroidCard from '$lib/features/shared-ui/components/PolaroidCard.svelte';

	interface Props {
		artworks: Artwork[];
		pageInfo: { hasMore: boolean; nextCursor: string | null };
		loadMoreArtworks?: (request: { cursor: string }) => Promise<{
			artworks: Artwork[];
			pageInfo: { hasMore: boolean; nextCursor: string | null };
		}>;
		onSelect: (artwork: Artwork) => void;
	}

	let { artworks, pageInfo, loadMoreArtworks, onSelect }: Props = $props();

	const { initialArtworks, initialPageInfo } = (() => ({
		initialArtworks: $state.snapshot(artworks),
		initialPageInfo: $state.snapshot(pageInfo)
	}))();

	const accumulator = createArtworkAccumulator({
		columnCount: 6,
		fetchPage: async (cursor: string) => {
			if (!loadMoreArtworks) {
				throw new Error('loadMoreArtworks is not configured');
			}
			return loadMoreArtworks({ cursor });
		},
		initialArtworks,
		initialPageInfo
	});
</script>

<div class="w-full">
	<VirtualizedGrid rows={accumulator.rows} gap="3.75rem">
		{#snippet renderCard(artwork)}
			<div data-testid={`virtualized-artwork-card-${artwork.id}`}>
				<PolaroidCard {artwork} onclick={() => onSelect(artwork)} />
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
