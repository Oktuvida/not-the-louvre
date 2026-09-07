<script lang="ts">
	import { page } from '$app/stores';
	import GalleryExplorationPage from '$lib/features/gallery-exploration/GalleryExplorationPage.svelte';
	import {
		getGalleryRoom,
		type GalleryRoomId
	} from '$lib/features/gallery-exploration/model/rooms';
	import Layout from './+layout.svelte';

	/*
	 * The real route shape: the room page lives inside the layout's
	 * `{#key roomId}` slide, so switching rooms destroys one instance while the
	 * next one is already mounted. That overlap is what the layout-binding
	 * ownership guard exists for.
	 */
	const roomId = $derived($page.data.roomId as GalleryRoomId);
	const viewer = $derived($page.data.viewer as { id: string; role: 'user' } | null);
</script>

<Layout>
	<GalleryExplorationPage
		artworks={[]}
		emptyStateMessage={null}
		room={getGalleryRoom(roomId)}
		{roomId}
		{viewer}
	/>
</Layout>
