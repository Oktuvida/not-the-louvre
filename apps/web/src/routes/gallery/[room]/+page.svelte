<script lang="ts">
	import GalleryExplorationPage from '$lib/features/gallery-exploration/GalleryExplorationPage.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<GalleryExplorationPage
	adultContentEnabled={data.adultContentEnabled}
	artworks={data.artworks}
	discovery={data.discovery}
	emptyStateMessage={data.emptyStateMessage}
	realtimeConfig={data.realtimeConfig}
	viewer={data.viewer}
	room={data.room}
	roomId={data.roomId}
/>
