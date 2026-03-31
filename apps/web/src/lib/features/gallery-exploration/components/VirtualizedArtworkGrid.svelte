<script lang="ts">
	import { Loader2 } from 'lucide-svelte';
	import type { Artwork } from '$lib/features/artwork-presentation/model/artwork';
	import PolaroidCard from '$lib/features/shared-ui/components/PolaroidCard.svelte';

	type GalleryDiscoveryRequest = {
		authorId: string | null;
		limit: number;
		sort: 'hot' | 'recent' | 'top';
		window: 'all' | null;
	};

	type GalleryDiscoveryState = {
		pageInfo: {
			hasMore: boolean;
			nextCursor: string | null;
		};
		request: GalleryDiscoveryRequest | null;
	};

	let {
		artworks,
		discovery,
		loadMoreArtworks,
		onSelect
	}: {
		artworks: Artwork[];
		discovery: GalleryDiscoveryState;
		loadMoreArtworks?: (request: GalleryDiscoveryRequest & { cursor: string }) => Promise<{
			artworks: Artwork[];
			pageInfo: { hasMore: boolean; nextCursor: string | null };
		}>;
		onSelect?: (artwork: Artwork) => void;
	} = $props();

	const ROW_HEIGHT = 360;
	const OVERSCAN_ROWS = 2;
	const CARDS_PER_ROW = 3;

	let appendedArtworks = $state<Artwork[]>([]);
	let pageInfo = $state({ hasMore: false, nextCursor: null as string | null });
	let viewportHeight = $state(900);
	let scrollTop = $state(0);
	let isLoadingMore = $state(false);

	const allArtworks = $derived([...artworks, ...appendedArtworks]);
	const totalRows = $derived(Math.max(1, Math.ceil(allArtworks.length / CARDS_PER_ROW)));
	const startRow = $derived(Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN_ROWS));
	const visibleRowCount = $derived(Math.ceil(viewportHeight / ROW_HEIGHT) + OVERSCAN_ROWS * 2);
	const endRow = $derived(Math.min(totalRows, startRow + visibleRowCount));
	const visibleArtworks = $derived(
		allArtworks.slice(startRow * CARDS_PER_ROW, endRow * CARDS_PER_ROW)
	);
	const topSpacerHeight = $derived(startRow * ROW_HEIGHT);
	const bottomSpacerHeight = $derived(Math.max(0, (totalRows - endRow) * ROW_HEIGHT));

	const syncViewport = () => {
		scrollTop = window.scrollY;
		viewportHeight = window.innerHeight || 900;
	};

	const maybeLoadMore = async () => {
		if (
			!loadMoreArtworks ||
			isLoadingMore ||
			!pageInfo.hasMore ||
			!pageInfo.nextCursor ||
			!discovery.request
		) {
			return;
		}

		const remainingRows = totalRows - endRow;
		if (remainingRows > OVERSCAN_ROWS + 1) {
			return;
		}

		isLoadingMore = true;

		try {
			const nextPage = await loadMoreArtworks({
				...discovery.request,
				cursor: pageInfo.nextCursor
			});
			const seenIds = new Set(allArtworks.map((artwork) => artwork.id));
			appendedArtworks = [
				...appendedArtworks,
				...nextPage.artworks.filter((artwork) => !seenIds.has(artwork.id))
			];
			pageInfo = nextPage.pageInfo;
		} finally {
			isLoadingMore = false;
		}
	};

	$effect(() => {
		pageInfo = { ...discovery.pageInfo };
		appendedArtworks = [];
	});

	$effect(() => {
		syncViewport();
		const onScroll = () => {
			syncViewport();
			void maybeLoadMore();
		};
		const onResize = () => {
			syncViewport();
			void maybeLoadMore();
		};

		window.addEventListener('scroll', onScroll);
		window.addEventListener('resize', onResize);

		return () => {
			window.removeEventListener('scroll', onScroll);
			window.removeEventListener('resize', onResize);
		};
	});

	$effect(() => {
		void maybeLoadMore();
	});
</script>

<div class="space-y-0">
	<div aria-hidden="true" style={`height: ${topSpacerHeight}px;`}></div>

	<div class="grid grid-cols-1 gap-15 md:grid-cols-2 lg:grid-cols-3">
		{#each visibleArtworks as artwork (artwork.id)}
			<div data-testid={`virtualized-artwork-card-${artwork.id}`}>
				<PolaroidCard {artwork} onclick={() => onSelect?.(artwork)} />
			</div>
		{/each}
	</div>

	<div aria-hidden="true" style={`height: ${bottomSpacerHeight}px;`}></div>

	{#if isLoadingMore}
		<div class="flex justify-center py-6" data-testid="virtualized-gallery-loading-more">
			<div
				class="flex items-center gap-2 rounded-full border-3 border-[#2d2420] bg-[#fff7d4] px-4 py-2 text-sm font-black text-[#2d2420] shadow-md"
			>
				<Loader2 class="h-4 w-4 animate-spin" />
				<span>Loading more</span>
			</div>
		</div>
	{/if}
</div>
