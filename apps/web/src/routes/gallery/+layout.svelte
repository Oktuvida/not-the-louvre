<script lang="ts">
	import { onNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { prefersReducedMotion } from 'svelte/motion';
	import { createGalleryLayoutContext } from '#lib/features/gallery-exploration/gallery-layout-context.js';
	import {
		galleryRoomIds,
		roomIdForPath,
		type GalleryRoomId
	} from '#lib/features/gallery-exploration/model/rooms.js';
	import GalleryLayoutFrame from '#lib/features/gallery-exploration/GalleryLayoutFrame.svelte';
	import './room-slide.css';

	let { children } = $props();
	const roomId = $derived(page.data.roomId as GalleryRoomId);
	const viewer = $derived(page.data.viewer);
	const awardStyle = $derived(page.data.awardStyle);

	const galleryLayout = createGalleryLayoutContext();

	/*
	 * Moving between rooms slides the next one in, as a view transition
	 * (room-slide.css). The browser holds a picture of the room being left
	 * until the next one has been drawn, then slides the two.
	 */
	onNavigate((navigation) => {
		const from = navigation.from ? roomIdForPath(navigation.from.url.pathname) : null;
		const to = navigation.to ? roomIdForPath(navigation.to.url.pathname) : null;
		if (!from || !to || from === to) return;
		if (!document.startViewTransition || prefersReducedMotion.current) return;

		const root = document.documentElement;
		root.dataset.roomSlide =
			galleryRoomIds.indexOf(to) > galleryRoomIds.indexOf(from) ? 'next' : 'previous';

		return new Promise<void>((resolve) => {
			const slide = document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
			const settle = () => {
				delete root.dataset.roomSlide;
			};
			// A navigation that fails or is cancelled skips the slide.
			void slide.ready.catch(() => {});
			void slide.finished.then(settle, settle);
		});
	});

	/*
	 * Every arrival puts a new room on the stage, a return to the room just
	 * left included, built from the route and the gallery's memory of the
	 * room. Keyed on the room id alone, Svelte would bring the copy it had
	 * just let go back instead.
	 */
	const arrival = $derived({ roomId });
</script>

<GalleryLayoutFrame {awardStyle} {roomId} {viewer} context={galleryLayout}>
	<div class="room-stage">
		{#key arrival}
			<div class="room-stage-item relative">
				{@render children()}
			</div>
		{/key}
	</div>
</GalleryLayoutFrame>
