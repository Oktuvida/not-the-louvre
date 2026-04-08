<script lang="ts">
	import type { Artwork } from '$lib/features/artwork-presentation/model/artwork';
	import YourStudioRoom from './YourStudioRoom.svelte';

	interface Props {
		artworks: Artwork[];
		pageInfo: { hasMore: boolean; nextCursor: string | null };
		loadMoreArtworks?: (request: { cursor: string }) => Promise<{
			artworks: Artwork[];
			pageInfo: { hasMore: boolean; nextCursor: string | null };
		}>;
	}

	let { artworks, pageInfo, loadMoreArtworks }: Props = $props();
</script>

<div style="height: 800px; overflow: auto;">
	<YourStudioRoom {artworks} {pageInfo} {loadMoreArtworks} onSelect={() => {}} />
</div>
