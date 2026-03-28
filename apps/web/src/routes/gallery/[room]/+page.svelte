<script lang="ts">
	import GalleryExplorationPage from '$lib/features/gallery-exploration/GalleryExplorationPage.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<GalleryExplorationPage
	artworks={data.artworks}
	emptyStateMessage={data.emptyStateMessage}
	viewer={data.viewer}
	room={data.room}
	roomId={data.roomId}
/>
