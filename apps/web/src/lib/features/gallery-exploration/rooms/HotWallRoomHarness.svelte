<script lang="ts">
	import type { Artwork } from '$lib/features/artwork-presentation/model/artwork';
	import HotWallRoom from './HotWallRoom.svelte';

	interface Props {
		artworks: Artwork[];
		pageInfo: { hasMore: boolean; nextCursor: string | null };
		adultContentEnabled?: boolean;
		loadMoreArtworks?: (request: { cursor: string }) => Promise<{
			artworks: Artwork[];
			pageInfo: { hasMore: boolean; nextCursor: string | null };
		}>;
		onSelect?: (artwork: Artwork) => void;
	}

	let {
		artworks,
		pageInfo,
		adultContentEnabled = false,
		loadMoreArtworks,
		onSelect = () => {}
	}: Props = $props();
</script>

<div style="height: 800px; overflow: auto;">
	<HotWallRoom {artworks} {pageInfo} {adultContentEnabled} {loadMoreArtworks} {onSelect} />
</div>
