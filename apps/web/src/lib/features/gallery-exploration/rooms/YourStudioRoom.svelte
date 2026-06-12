<script lang="ts">
	import type { Artwork } from '$lib/features/artwork-presentation/model/artwork';
	import { createArtworkAccumulator } from '$lib/features/gallery-exploration/artwork-accumulator.svelte';
	import ScrollSentinel from '$lib/features/gallery-exploration/components/ScrollSentinel.svelte';
	import VirtualizedGrid from '$lib/features/gallery-exploration/components/VirtualizedGrid.svelte';
	import PolaroidCard from '$lib/features/shared-ui/components/PolaroidCard.svelte';
	import { untrack } from 'svelte';

	interface Props {
		artworks: Artwork[];
		pageInfo: { hasMore: boolean; nextCursor: string | null };
		adultContentEnabled?: boolean;
		loadMoreArtworks?: (request: { cursor: string }) => Promise<{
			artworks: Artwork[];
			pageInfo: { hasMore: boolean; nextCursor: string | null };
		}>;
		onSelect: (artwork: Artwork) => void;
		viewerId?: string | null;
	}

	let {
		artworks,
		pageInfo,
		adultContentEnabled = false,
		loadMoreArtworks,
		onSelect,
		viewerId = null
	}: Props = $props();

	const { initialArtworks, initialPageInfo } = (() => ({
		initialArtworks: $state.snapshot(artworks),
		initialPageInfo: $state.snapshot(pageInfo)
	}))();

	const accumulator = createArtworkAccumulator({
		fetchPage: async (cursor: string) => {
			if (!loadMoreArtworks) {
				throw new Error('loadMoreArtworks is not configured');
			}
			return loadMoreArtworks({ cursor });
		},
		initialArtworks,
		initialPageInfo
	});

	const seedIdentity = (items: Artwork[]) => items.map((a) => a.id).join(',');
	const pageInfoIdentity = (info: { hasMore: boolean; nextCursor: string | null }) =>
		`${info.hasMore}:${info.nextCursor ?? ''}`;
	let lastSeedIdentity = seedIdentity(initialArtworks);
	let lastPageInfoIdentity = pageInfoIdentity(initialPageInfo);

	$effect(() => {
		const identity = seedIdentity(artworks);
		const nextPageInfoIdentity = pageInfoIdentity(pageInfo);
		if (identity !== lastSeedIdentity || nextPageInfoIdentity !== lastPageInfoIdentity) {
			lastSeedIdentity = identity;
			lastPageInfoIdentity = nextPageInfoIdentity;
			untrack(() => {
				accumulator.reseed(artworks, pageInfo);
			});
			return;
		}

		untrack(() => {
			accumulator.syncSeedArtworks(artworks);
		});
	});
</script>

<div class="w-full">
	<VirtualizedGrid items={accumulator.allArtworks} gap={60}>
		{#snippet renderCard(artwork)}
			<div data-testid={`virtualized-artwork-card-${artwork.id}`}>
				<PolaroidCard
					{artwork}
					{viewerId}
					{adultContentEnabled}
					imageLoading="eager"
					onclick={() => onSelect(artwork)}
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
