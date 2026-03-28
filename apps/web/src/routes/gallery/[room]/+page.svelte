<script lang="ts">
	import GalleryExplorationPage from '$lib/features/gallery-exploration/GalleryExplorationPage.svelte';
	import type { GalleryRoomId } from '$lib/features/gallery-exploration/model/rooms';

	let { data } = $props<{ data: { roomId: GalleryRoomId } }>();
</script>

<GalleryExplorationPage roomId={data.roomId} />
