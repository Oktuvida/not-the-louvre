<script lang="ts">
	import GalleryExplorationPage from '#lib/features/gallery-exploration/GalleryExplorationPage.svelte';
	import { getGalleryRoom } from '#lib/features/gallery-exploration/model/rooms.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<!-- One artist's studio to another's is a new wall, built from nothing. The
     room is only what the page's notes are read from, and a visit shows none. -->
{#key data.artist.id}
	<GalleryExplorationPage
		adultContentEnabled={data.adultContentEnabled}
		artist={data.artist}
		artworks={data.artworks}
		awardStyle={data.awardStyle}
		discovery={data.discovery}
		emptyStateMessage={data.emptyStateMessage}
		room={getGalleryRoom('your-studio')}
		roomId="artist-studio"
		viewer={data.viewer}
	/>
{/key}
