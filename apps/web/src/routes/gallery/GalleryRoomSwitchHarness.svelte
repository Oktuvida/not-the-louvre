<script lang="ts">
	import { page } from '$app/state';
	import GalleryExplorationPage from '#lib/features/gallery-exploration/GalleryExplorationPage.svelte';
	import {
		getGalleryRoom,
		type GalleryRoomId
	} from '#lib/features/gallery-exploration/model/rooms.js';
	import type { Artwork } from '#lib/features/artwork-presentation/model/artwork.js';
	import type { GalleryRoomContent } from '#lib/features/gallery-exploration/model/discovery.js';
	import Layout from './+layout.svelte';

	/*
	 * The real route shape: the room page lives inside the layout's
	 * keyed slide, so switching rooms destroys one instance while the
	 * next one is already mounted. That overlap is what the layout-binding
	 * ownership guard exists for.
	 */
	let {
		checkForNewArtworks
	}: {
		checkForNewArtworks?: () => Promise<{ count: number; preview: null }>;
	} = $props();

	const roomId = $derived(page.data.roomId as GalleryRoomId);
	const viewer = $derived(page.data.viewer as { id: string; role: 'user' } | null);
	// What the route hands the page: a first visit's rendered room, or a
	// navigation's streamed one.
	const artworks = $derived((page.data.artworks as Artwork[] | undefined) ?? []);
	const roomContent = $derived(
		(page.data.roomContent as Promise<GalleryRoomContent> | undefined) ?? null
	);
</script>

<Layout>
	<GalleryExplorationPage
		{artworks}
		{roomContent}
		{checkForNewArtworks}
		emptyStateMessage={null}
		newArtworkCheckMs={10}
		room={getGalleryRoom(roomId)}
		{roomId}
		{viewer}
	/>
</Layout>
