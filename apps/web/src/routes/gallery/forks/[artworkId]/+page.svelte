<script lang="ts">
	import GalleryExplorationPage from '#lib/features/gallery-exploration/GalleryExplorationPage.svelte';
	import { getGalleryRoom } from '#lib/features/gallery-exploration/model/rooms.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<!-- One piece's forks to another's is a new wall, built from nothing. The room
     is only what the page's notes are read from, and this wall shows none. -->
{#key data.forksOf.id}
	<GalleryExplorationPage
		adultContentEnabled={data.adultContentEnabled}
		artworks={data.artworks}
		awardStyle={data.awardStyle}
		discovery={data.discovery}
		emptyStateMessage={data.emptyStateMessage}
		forksOf={data.forksOf}
		room={getGalleryRoom('your-studio')}
		roomId="artwork-forks"
		viewer={data.viewer}
	/>
{/key}
