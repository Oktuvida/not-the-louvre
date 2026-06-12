<script lang="ts">
	import { page } from '$app/stores';
	import { fly } from 'svelte/transition';
	import { prefersReducedMotion } from 'svelte/motion';
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

	const slideDuration = $derived.by(() => {
		if (slideDirection === 0 || prefersReducedMotion.current) return 0;
		return 300;
	});
</script>

<GalleryLayoutFrame {roomId} {viewer} context={galleryLayout}>
	<div class="room-stage">
		{#key roomId}
			<div
				class="room-stage-item relative overflow-visible"
				in:fly={{ x: slideDirection * 300, duration: slideDuration }}
				out:fly={{ x: slideDirection * -300, duration: Math.round(slideDuration * 0.75) }}
			>
				{@render children()}
			</div>
		{/key}
	</div>
</GalleryLayoutFrame>

<style>
	/* Stack outgoing and incoming rooms in the same cell so the crossfade
	 * slides overlap instead of pushing the page height around. */
	.room-stage {
		display: grid;
	}

	.room-stage > :global(.room-stage-item) {
		grid-area: 1 / 1;
		min-width: 0;
	}
</style>
