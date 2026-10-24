<script lang="ts">
	import GalleryExplorationPage from '#lib/features/gallery-exploration/GalleryExplorationPage.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<!--
	The streamed room payload is handed to the page rather than branched around
	it: three separate `<GalleryExplorationPage>` instantiations meant every
	navigation constructed the component twice and the entry fade dissolved over
	a skeleton belonging to the instance that was about to be discarded.
-->
<GalleryExplorationPage
	room={data.room}
	roomContent={data.lazy.roomContent}
	roomId={data.roomId}
	viewer={data.viewer}
/>
