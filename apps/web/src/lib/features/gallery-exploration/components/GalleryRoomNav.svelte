<script lang="ts">
	import { Flame, Route, Trophy, UserRound } from 'lucide-svelte';
	import { galleryRooms, type GalleryRoomId } from '$lib/features/gallery-exploration/model/rooms';
	import GameLink from '$lib/features/shared-ui/components/GameLink.svelte';

	const roomIcons = {
		'hall-of-fame': Trophy,
		'hot-wall': Flame,
		mystery: Route,
		'your-studio': UserRound
	} as const;

	let {
		roomId,
		viewer = null
	}: {
		roomId: GalleryRoomId;
		viewer?: { id: string; role: 'admin' | 'moderator' | 'user' } | null;
	} = $props();

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
		{@const Icon = roomIcons[room.id]}
		<GameLink
			{href}
			variant={isActive ? roomVariants[room.id] : 'ghost'}
			size="md"
			className={`relative shrink-0 ${isActive ? 'scale-105' : 'opacity-80'}`}
		>
			<Icon
				class={`h-6 w-6 shrink-0 ${isActive ? 'animate-[wiggle_0.5s_ease-in-out_0.3s]' : ''}`}
			/>
			<span>{room.name}</span>
		</GameLink>
	{/each}
</nav>
