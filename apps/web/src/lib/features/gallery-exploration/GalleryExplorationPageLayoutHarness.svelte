<script lang="ts">
	import GalleryLayoutFrame from './GalleryLayoutFrame.svelte';
	import GalleryExplorationPage from './GalleryExplorationPage.svelte';
	import type { Artwork } from '$lib/features/artwork-presentation/model/artwork';
	import type { GalleryRoomConfig, GalleryRoomId } from './model/rooms';

	let {
		adultContentEnabled = false,
		artworks,
		discovery,
		emptyStateMessage = null,
		fetchRandomArtwork,
		loadArtworkDetail,
		loadMoreArtworks,
		realtimeConfig,
		room,
		roomId,
		viewer = null
	}: {
		adultContentEnabled?: boolean;
		artworks: Artwork[];
		discovery?: {
			pageInfo: { hasMore: boolean; nextCursor: string | null };
			request: {
				authorId: string | null;
				limit: number;
				sort: 'hot' | 'recent' | 'top';
				window: 'all' | null;
			} | null;
		};
		emptyStateMessage?: string | null;
		fetchRandomArtwork?: () => Promise<Artwork>;
		loadArtworkDetail?: (artworkId: string) => Promise<Artwork>;
		loadMoreArtworks?: (request: {
			authorId: string | null;
			cursor: string;
			limit: number;
			sort: 'hot' | 'recent' | 'top';
			window: 'all' | null;
		}) => Promise<{
			artworks: Artwork[];
			pageInfo: { hasMore: boolean; nextCursor: string | null };
		}>;
		realtimeConfig?: { anonKey: string | null; url: string | null };
		room: GalleryRoomConfig;
		roomId: GalleryRoomId;
		viewer?: { id: string; role: 'admin' | 'moderator' | 'user' } | null;
	} = $props();
</script>

<GalleryLayoutFrame {roomId} {viewer}>
	<GalleryExplorationPage
		{adultContentEnabled}
		{artworks}
		{discovery}
		{emptyStateMessage}
		{fetchRandomArtwork}
		{loadArtworkDetail}
		{loadMoreArtworks}
		{realtimeConfig}
		{room}
		{roomId}
		{viewer}
	/>
</GalleryLayoutFrame>
