<script lang="ts">
	import { galleryRooms, type GalleryRoomId } from '$lib/features/gallery-exploration/model/rooms';
	import GameLink from '$lib/features/shared-ui/components/GameLink.svelte';

	let {
		roomId,
		viewer = null
	}: {
		roomId: GalleryRoomId;
		viewer?: { id: string; role: 'admin' | 'moderator' | 'user' } | null;
	} = $props();

	/** Lucide icon SVG paths keyed by room id */
	const iconPaths: Record<GalleryRoomId, string> = {
		'hall-of-fame':
			'M6 9H4.5a2.5 2.5 0 0 1 0-5H6 M18 9h1.5a2.5 2.5 0 0 0 0-5H18 M4 22h16 M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22 M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22 M18 2H6v7a6 6 0 0 0 12 0V2Z',
		'hot-wall': 'm22 12-4-4v3H3v2h15v3l4-4Z M22 12H3 M16 6l2-4 M12 2v4 M8 6l-2-4',
		mystery:
			'M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22 M18 2l4 4-4 4 M2 6h1.9c1.5 0 2.9.9 3.6 2.2 M22 18l-4 4-4-4 M16.8 18h-.4c-1.3 0-2.5-.6-3.3-1.7l-.6-.9',
		'your-studio': 'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2 M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z'
	};

	const roomVariants: Record<GalleryRoomId, 'accent' | 'danger' | 'primary' | 'secondary'> = {
		'hall-of-fame': 'accent',
		'hot-wall': 'danger',
		mystery: 'secondary',
		'your-studio': 'primary'
	};

	const visibleRooms = $derived(
		viewer ? galleryRooms : galleryRooms.filter((room) => room.id !== 'your-studio')
	);
</script>

<nav class="flex gap-4 overflow-x-auto pb-4">
	{#each visibleRooms as room (room.id)}
		{@const isActive = room.id === roomId}
		{@const href = room.id === 'hall-of-fame' ? '/gallery' : (`/gallery/${room.id}` as const)}
		<GameLink
			{href}
			variant={isActive ? roomVariants[room.id] : 'ghost'}
			size="md"
			className={`relative shrink-0 ${isActive ? 'scale-105' : 'opacity-80'}`}
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="24"
				height="24"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				class="h-6 w-6 shrink-0"
				class:animate-[wiggle_0.5s_ease-in-out_0.3s]={isActive}><path d={iconPaths[room.id]} /></svg
			>
			<span>{room.name}</span>
		</GameLink>
	{/each}
</nav>
