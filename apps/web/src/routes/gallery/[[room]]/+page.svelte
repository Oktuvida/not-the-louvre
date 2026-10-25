<script lang="ts">
	import GalleryExplorationPage from '#lib/features/gallery-exploration/GalleryExplorationPage.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<!--
	A first visit hands the page its rendered room; a navigation hands it the
	streamed payload. Either way it goes to the one page rather than being
	branched around it: three separate `<GalleryExplorationPage>` instantiations meant every
	navigation constructed the component twice and the entry fade dissolved over
	a skeleton belonging to the instance that was about to be discarded.
-->
<GalleryExplorationPage
	adultContentEnabled={data.initialRoomContent?.adultContentEnabled}
	artworks={data.initialRoomContent?.artworks}
	discovery={data.initialRoomContent?.discovery}
	emptyStateMessage={data.initialRoomContent?.emptyStateMessage ?? null}
	room={data.room}
	roomContent={data.lazy.roomContent}
	roomId={data.roomId}
	viewer={data.viewer}
/>
