<script lang="ts">
	import { resolve } from '$app/paths';
	import { galleryRooms, type GalleryRoomId } from '$lib/features/gallery-exploration/model/rooms';

	let { roomId }: { roomId: GalleryRoomId } = $props();

	/** Lucide icon SVG paths keyed by room id */
	const iconPaths: Record<GalleryRoomId, string> = {
		'hall-of-fame':
			'M6 9H4.5a2.5 2.5 0 0 1 0-5H6 M18 9h1.5a2.5 2.5 0 0 0 0-5H18 M4 22h16 M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22 M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22 M18 2H6v7a6 6 0 0 0 12 0V2Z',
		'hot-wall': 'm22 12-4-4v3H3v2h15v3l4-4Z M22 12H3 M16 6l2-4 M12 2v4 M8 6l-2-4',
		mystery:
			'M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22 M18 2l4 4-4 4 M2 6h1.9c1.5 0 2.9.9 3.6 2.2 M22 18l-4 4-4-4 M16.8 18h-.4c-1.3 0-2.5-.6-3.3-1.7l-.6-.9',
		'your-studio': 'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2 M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z'
	};
</script>

<nav class="flex gap-4 overflow-x-auto pb-4">
	{#each galleryRooms as room (room.id)}
		{@const isActive = room.id === roomId}
		{#if room.id === 'hall-of-fame'}
			<a
				href={resolve('/gallery')}
				class="font-display relative inline-flex shrink-0 items-center gap-3 rounded-xl border-4 border-[#2d2420] px-8 py-4 text-lg font-bold whitespace-nowrap shadow-lg transition duration-200 hover:-translate-y-1 hover:scale-105"
				class:scale-105={isActive}
				class:-rotate-1={isActive}
				class:rotate-1={!isActive}
				class:opacity-70={!isActive}
				class:hover:opacity-100={!isActive}
				style={`background-color: ${isActive ? room.color : '#e5dfd5'}; color: ${isActive ? '#2d2420' : '#6b625a'};`}
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
					class:animate-[wiggle_0.5s_ease-in-out_0.3s]={isActive}
					><path d={iconPaths[room.id]} /></svg
				>
				<span>{room.name}</span>
				{#if isActive}
					<div
						class="absolute -bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-r-4 border-b-4 border-[#2d2420]"
						style={`background-color: ${room.color};`}
					></div>
				{/if}
			</a>
		{:else}
			<a
				href={resolve('/gallery/[room]', { room: room.id })}
				class="font-display relative inline-flex shrink-0 items-center gap-3 rounded-xl border-4 border-[#2d2420] px-8 py-4 text-lg font-bold whitespace-nowrap shadow-lg transition duration-200 hover:-translate-y-1 hover:scale-105"
				class:scale-105={isActive}
				class:-rotate-1={isActive}
				class:rotate-1={!isActive}
				class:opacity-70={!isActive}
				class:hover:opacity-100={!isActive}
				style={`background-color: ${isActive ? room.color : '#e5dfd5'}; color: ${isActive ? '#2d2420' : '#6b625a'};`}
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
					class:animate-[wiggle_0.5s_ease-in-out_0.3s]={isActive}
					><path d={iconPaths[room.id]} /></svg
				>
				<span>{room.name}</span>
				{#if isActive}
					<div
						class="absolute -bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-r-4 border-b-4 border-[#2d2420]"
						style={`background-color: ${room.color};`}
					></div>
				{/if}
			</a>
		{/if}
	{/each}
</nav>
