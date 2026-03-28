<script lang="ts">
	import ArtworkCard from '$lib/features/artwork-presentation/components/ArtworkCard.svelte';
	import ArtworkDetailPanel from '$lib/features/artwork-presentation/components/ArtworkDetailPanel.svelte';
	import type { Artwork } from '$lib/features/artwork-presentation/model/artwork';
	import {
		artworksByRoom,
		galleryRooms,
		topRanked
	} from '$lib/features/gallery-exploration/fixtures/artworks';
	import GalleryRoomNav from '$lib/features/gallery-exploration/components/GalleryRoomNav.svelte';
	import { type GalleryRoomId } from '$lib/features/gallery-exploration/model/rooms';
	import MysteryRoom from '$lib/features/gallery-exploration/rooms/MysteryRoom.svelte';
	import GameLink from '$lib/features/shared-ui/components/GameLink.svelte';

	let { roomId }: { roomId: GalleryRoomId } = $props();

	const room = $derived(galleryRooms.find((entry) => entry.id === roomId) ?? galleryRooms[0]);
	const artworks = $derived(artworksByRoom[roomId]);

	let selectedArtwork = $state<Artwork | null>(null);
	let mysteryIndex = $state(0);

	const mysteryArtwork = $derived(artworks[mysteryIndex % artworks.length] ?? artworks[0]);

	const openArtwork = (artwork: Artwork) => {
		selectedArtwork = artwork;
	};

	const spinMystery = () => {
		mysteryIndex += 1;
		selectedArtwork = mysteryArtwork;
	};

	const podiumMeta = {
		1: {
			label: 'CHAMPION',
			color: '#f4c430',
			medal: '🥇',
			width: 'w-72',
			height: 'h-96',
			base: 'h-32'
		},
		2: {
			label: 'RUNNER UP',
			color: '#c0c0c0',
			medal: '🥈',
			width: 'w-64',
			height: 'h-80',
			base: 'h-24'
		},
		3: {
			label: 'BRONZE STAR',
			color: '#cd7f32',
			medal: '🥉',
			width: 'w-64',
			height: 'h-72',
			base: 'h-20'
		}
	} as const;
</script>

<div class="pointer-events-none absolute inset-0 overflow-hidden">
	{#each Array.from({ length: 20 }).map((_, index) => index) as index (`gallery-particle-${index}`)}
		<div
			class="absolute h-2 w-2 animate-[drift_4s_ease-in-out_infinite] rounded-full opacity-20"
			style={`
				background: ${['#f4c430', '#d4956c', '#8b9d91', '#c84f4f'][index % 4]};
				left: ${(index * 19) % 100}%;
				top: ${(index * 23) % 100}%;
				animation-delay: ${index * 0.12}s;
			`}
		></div>
	{/each}
</div>

<div class="relative min-h-screen overflow-x-hidden bg-[#f5f0e8]">
	<div class="sticky top-0 z-40 border-b-4 border-[#2d2420] bg-[#fdfbf7] shadow-lg">
		<div class="mx-auto max-w-7xl px-8 py-6">
			<div class="flex items-center justify-between">
				<GameLink
					href="/"
					variant="secondary"
					className="w-fit -rotate-1 border-[3px] px-6 py-3 [font-family:'Baloo_2',_'Trebuchet_MS',_sans-serif]"
				>
					<!-- ArrowLeft SVG -->
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						class="mr-2 h-5 w-5"><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></svg
					>
					<span class="font-semibold">Exit Gallery</span>
				</GameLink>

				<h1
					class="font-display text-4xl font-black text-[#2d2420] [text-shadow:3px_3px_0px_#e8b896]"
				>
					THE GALLERY
				</h1>

				<GameLink
					href="/draw"
					variant="primary"
					className="w-fit rotate-1 border-[3px] px-6 py-3 [font-family:'Baloo_2',_'Trebuchet_MS',_sans-serif]"
				>
					<!-- Sparkles SVG -->
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						class="mr-2 h-5 w-5"
						><path
							d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"
						/><path d="M20 3v4" /><path d="M22 5h-4" /><path d="M4 17v2" /><path d="M5 18H3" /></svg
					>
					<span class="font-semibold">Create Art</span>
				</GameLink>
			</div>
		</div>
	</div>

	<div class="mx-auto flex max-w-7xl flex-col gap-8 px-8 py-8">
		<GalleryRoomNav {roomId} />

		<!-- Room Description -->
		<div
			class="group -rotate-1 rounded-lg border-2 border-[#2d2420] bg-[#fdfbf7] p-6 shadow-md transition duration-200 hover:scale-[1.02] hover:rotate-0"
		>
			<p class="[font-family:'Baloo_2',_'Trebuchet_MS',_sans-serif] text-lg text-[#6b625a] italic">
				{room.description}
			</p>
		</div>

		{#if roomId === 'mystery'}
			<MysteryRoom artwork={mysteryArtwork} onReveal={spinMystery} onSelect={openArtwork} />
		{:else if roomId === 'hall-of-fame'}
			<div class="space-y-12">
				<div class="mb-16 flex flex-col items-center justify-center gap-8 lg:flex-row lg:items-end">
					{#each [topRanked[1], topRanked[0], topRanked[2]] as artwork, index (artwork?.id)}
						{#if artwork}
							{@const position = [2, 1, 3][index] as 1 | 2 | 3}
							{@const meta = podiumMeta[position]}
							<div class="relative flex flex-col items-center">
								<div class="relative mb-4">
									<div
										class="font-display rounded-full border-[3px] border-[#2d2420] px-6 py-2 font-black text-[#2d2420] shadow-lg"
										style={`background:${meta.color}`}
									>
										{meta.label}
									</div>
									<div class="absolute -top-2 -right-2 animate-[spin_20s_linear_infinite] text-4xl">
										{meta.medal}
									</div>
								</div>

								<button
									type="button"
									class={`relative ${meta.width} ${meta.height} cursor-pointer`}
									onclick={() => openArtwork(artwork)}
								>
									<div
										class="h-full border-[6px] border-[#5d4e37] bg-[#fdfbf7] p-4 shadow-2xl transition duration-200 hover:-translate-y-2 hover:scale-105"
									>
										<img
											src={artwork.imageUrl}
											alt={artwork.title}
											class="h-full w-full border-2 border-[#2d2420] object-cover"
										/>
										{#if artwork.artistAvatar}
											<div
												class="absolute -bottom-6 left-1/2 h-20 w-20 -translate-x-1/2 overflow-hidden rounded-full border-4 border-[#2d2420] bg-white shadow-xl"
											>
												<img
													src={artwork.artistAvatar}
													alt={artwork.artist}
													class="h-full w-full"
												/>
											</div>
										{/if}
									</div>
								</button>

								<div
									class={`mt-8 w-full rounded-t-lg border-4 border-[#2d2420] ${meta.base}`}
									style={`background:${meta.color}`}
								>
									<div class="flex h-full flex-col items-center justify-center">
										<div class="font-display text-5xl font-black text-[#2d2420]">{position}</div>
										<div class="mt-1 text-sm font-bold text-[#2d2420]">{artwork.artist}</div>
										<div class="text-xs font-bold text-[#2d2420]">{artwork.score} pts</div>
									</div>
								</div>
							</div>
						{/if}
					{/each}
				</div>

				<div class="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
					{#each topRanked.slice(3) as artwork (artwork.id)}
						<button
							type="button"
							class="rotate-1 cursor-pointer rounded-lg border-[3px] border-[#2d2420] bg-[#fdfbf7] p-3 text-left shadow-md transition duration-200 hover:scale-105 hover:rotate-0"
							onclick={() => openArtwork(artwork)}
						>
							<div class="relative">
								<img
									src={artwork.imageUrl}
									alt={artwork.title}
									class="aspect-square w-full rounded border-2 border-[#2d2420] object-cover"
								/>
								<div
									class="absolute -top-2 -left-2 flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#2d2420] bg-[#d4956c] font-black text-[#2d2420]"
								>
									{artwork.rank}
								</div>
								{#if artwork.artistAvatar}
									<div
										class="absolute -right-2 -bottom-2 h-10 w-10 overflow-hidden rounded-full border-2 border-[#2d2420] bg-white shadow-md"
									>
										<img src={artwork.artistAvatar} alt={artwork.artist} class="h-full w-full" />
									</div>
								{/if}
							</div>
							<div class="mt-3">
								<h4 class="truncate font-bold text-[#2d2420]">{artwork.title}</h4>
								<p class="truncate text-xs text-[#6b625a]">{artwork.artist}</p>
								<div class="mt-1 flex items-center gap-2 text-xs text-[#2d2420]">
									<span>⭐ {artwork.score}</span>
									<span>👍 {artwork.upvotes}</span>
								</div>
							</div>
						</button>
					{/each}
				</div>
			</div>
		{:else}
			<div class="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-3">
				{#each artworks as artwork, index (artwork.id)}
					<ArtworkCard {artwork} {index} onclick={() => openArtwork(artwork)} />
				{/each}
			</div>
		{/if}
	</div>

	<ArtworkDetailPanel
		artwork={selectedArtwork}
		onClose={() => {
			selectedArtwork = null;
		}}
	/>
</div>
