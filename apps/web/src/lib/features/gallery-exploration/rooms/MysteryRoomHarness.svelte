<script lang="ts">
	import type { Artwork } from '$lib/features/artwork-presentation/model/artwork';
	import MysteryRoom from './MysteryRoom.svelte';

	interface Props {
		artworks: Artwork[];
		pageInfo: { hasMore: boolean; nextCursor: string | null };
		adultContentEnabled?: boolean;
		loadMoreArtworks?: (request: { cursor: string }) => Promise<{
			artworks: Artwork[];
			pageInfo: { hasMore: boolean; nextCursor: string | null };
		}>;
		fetchRandomArtwork?: () => Promise<Artwork>;
		onSelect?: (artwork: Artwork) => void;
	}

	let {
		artworks,
		pageInfo,
		adultContentEnabled = false,
		loadMoreArtworks,
		fetchRandomArtwork,
		onSelect = () => {}
	}: Props = $props();
</script>

<div style="width: 800px; height: 600px;">
	<MysteryRoom
		{adultContentEnabled}
		{artworks}
		{pageInfo}
		{loadMoreArtworks}
		{fetchRandomArtwork}
		{onSelect}
	/>
</div>
