<script lang="ts">
	import GalleryExplorationPage from '$lib/features/gallery-exploration/GalleryExplorationPage.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

{#await data.lazy.roomContent}
	<GalleryExplorationPage
		artworks={[]}
		emptyStateMessage={null}
		isRoomLoading
		realtimeConfig={data.realtimeConfig}
		viewer={data.viewer}
		room={data.room}
		roomId={data.roomId}
	/>
{:then roomContent}
	<GalleryExplorationPage
		adultContentEnabled={roomContent.adultContentEnabled}
		artworks={roomContent.artworks}
		discovery={roomContent.discovery}
		emptyStateMessage={roomContent.emptyStateMessage}
		realtimeConfig={data.realtimeConfig}
		viewer={data.viewer}
		room={data.room}
		roomId={data.roomId}
	/>
{/await}
