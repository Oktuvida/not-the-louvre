<script lang="ts">
	import GalleryExplorationPage from '$lib/features/gallery-exploration/GalleryExplorationPage.svelte';
	import type { GalleryRoomId } from '$lib/features/gallery-exploration/model/rooms';

	const roomId: GalleryRoomId = 'hall-of-fame';
</script>

<GalleryExplorationPage {roomId} />
