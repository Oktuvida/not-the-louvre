<script lang="ts">
	import { navigating } from '$app/stores';
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

	const roomIdForPath = (pathname: string): GalleryRoomId | null => {
		if (pathname === '/gallery') return 'hall-of-fame';
		const match = galleryRooms.find((room) => pathname === `/gallery/${room.id}`);
		return match?.id ?? null;
	};

	// The active sticker follows the click, not the server round-trip: while
	// a room navigation is in flight the destination tab lights up right away.
	const activeRoomId = $derived(
		($navigating?.to ? roomIdForPath($navigating.to.url.pathname) : null) ?? roomId
	);
</script>

<nav class="flex w-full max-w-full gap-2 overflow-x-auto px-1 py-2 md:gap-4 md:p-2">
	{#each visibleRooms as room (room.id)}
		{@const isActive = room.id === activeRoomId}
		{@const href = room.id === 'hall-of-fame' ? '/gallery' : (`/gallery/${room.id}` as const)}
		{@const Icon = roomIcons[room.id]}
		<GameLink
			{href}
			variant={isActive ? roomVariants[room.id] : 'ghost'}
			size="md"
			className={`relative shrink-0 ${isActive ? 'scale-105' : 'opacity-80'}`}
			contentClassName="px-1 text-[0.7rem] sm:text-xs md:px-0 md:text-sm"
			data-sveltekit-preload-data="hover"
		>
			<Icon
				class={`h-6 w-6 shrink-0 ${isActive ? 'animate-[wiggle_0.5s_ease-in-out_0.3s]' : ''}`}
			/>
			<span>{room.name}</span>
		</GameLink>
	{/each}
</nav>
