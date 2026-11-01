<script lang="ts">
	import { navigating } from '$app/state';
	import { Flame, Route, Trophy, UserRound } from 'lucide-svelte';
	import {
		galleryRooms,
		roomHref,
		roomIdForPath,
		type GalleryRoomId
	} from '#lib/features/gallery-exploration/model/rooms.js';
	import GameLink from '#lib/features/shared-ui/components/GameLink.svelte';
	import type { Viewer } from '#lib/shared/viewer.js';

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
		roomId: GalleryRoomId | null;
		viewer?: Viewer | null;
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

	// The active sticker follows the click, not the server round-trip: while
	// a room navigation is in flight the destination tab lights up right away.
	const activeRoomId = $derived(
		(navigating?.to ? roomIdForPath(navigating.to.url.pathname) : null) ?? roomId
	);

	/*
	 * On a narrow screen the tabs scroll sideways, and the room the visitor is
	 * in may be past the edge (the Hot Wall on a phone was cut in half). The
	 * strip is scrolled to centre it whenever the room changes. Only the strip
	 * moves, never the page. Its padding leaves room for the active tab's 105%
	 * scale, which the scrolling strip would otherwise clip.
	 */
	let navElement = $state<HTMLElement>();
	$effect(() => {
		const nav = navElement;
		const id = activeRoomId;
		const active = nav?.querySelector<HTMLElement>(`[data-room="${id}"]`);
		if (!nav || !active || nav.scrollWidth <= nav.clientWidth) return;

		const strip = nav.getBoundingClientRect();
		const tab = active.getBoundingClientRect();
		nav.scrollBy({
			behavior: 'instant',
			left: tab.left + tab.width / 2 - (strip.left + strip.width / 2)
		});
	});
</script>

<nav
	bind:this={navElement}
	class="flex w-full max-w-full gap-2 overflow-x-auto px-3 py-2 md:gap-4 md:p-2"
>
	{#each visibleRooms as room (room.id)}
		{@const isActive = room.id === activeRoomId}
		{@const href = roomHref(room.id)}
		{@const Icon = roomIcons[room.id]}
		<GameLink
			{href}
			variant={isActive ? roomVariants[room.id] : 'ghost'}
			size="md"
			className={`relative shrink-0 ${isActive ? 'scale-105' : 'opacity-80'}`}
			contentClassName="px-1 text-[0.7rem] sm:text-xs md:px-0 md:text-sm"
			data-sveltekit-preload-data="hover"
			data-room={room.id}
			aria-current={isActive ? 'page' : undefined}
		>
			<!-- The wiggle is decoration: reduced-motion visitors get the sticker, not the shake. -->
			<Icon
				class={`h-6 w-6 shrink-0 ${isActive ? 'animate-[wiggle_0.5s_ease-in-out_0.3s] motion-reduce:animate-none' : ''}`}
			/>
			<span>{room.name}</span>
		</GameLink>
	{/each}
</nav>
