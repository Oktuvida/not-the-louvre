<script lang="ts">
	import { page } from '$app/stores';
	import { fly } from 'svelte/transition';
	import { createGalleryLayoutContext } from '$lib/features/gallery-exploration/gallery-layout-context';
	import {
		galleryRoomIds,
		type GalleryRoomId
	} from '$lib/features/gallery-exploration/model/rooms';
	import GalleryLayoutFrame from '$lib/features/gallery-exploration/GalleryLayoutFrame.svelte';

	let { children } = $props();
	const roomId = $derived($page.data.roomId as GalleryRoomId);
	const viewer = $derived($page.data.viewer);

	const galleryLayout = createGalleryLayoutContext();
	const previousRoomId = galleryLayout.previousRoomId;

	let previousRoomIndex = $state(-1);

	$effect.pre(() => {
		const prevId = $previousRoomId;
		const prevIndex = prevId ? galleryRoomIds.indexOf(prevId as GalleryRoomId) : -1;
		previousRoomIndex = prevIndex;
		$previousRoomId = roomId;
	});

	const slideDirection = $derived.by(() => {
		if (previousRoomIndex === -1) return 0;
		const currentIndex = galleryRoomIds.indexOf(roomId);
		return currentIndex > previousRoomIndex ? 1 : currentIndex < previousRoomIndex ? -1 : 0;
	});
</script>

<GalleryLayoutFrame {roomId} {viewer} context={galleryLayout}>
	{#key roomId}
		<div
			class="relative overflow-visible"
			in:fly={{ x: slideDirection * 300, duration: slideDirection === 0 ? 0 : 300 }}
		>
			{@render children()}
		</div>
	{/key}
</GalleryLayoutFrame>
