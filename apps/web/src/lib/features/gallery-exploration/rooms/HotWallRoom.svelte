<script lang="ts">
	import ArtworkCard from '$lib/features/artwork-presentation/components/ArtworkCard.svelte';
	import ArtworkFrame from '$lib/features/artwork-presentation/components/ArtworkFrame.svelte';
	import type { Artwork } from '$lib/features/artwork-presentation/model/artwork';
	import { resolveArtworkFrame } from '$lib/features/artwork-presentation/model/frame';

	let {
		adultContentEnabled = false,
		gridArtworks = [],
		leadArtwork = null,
		onSelect,
		viewer = null,
		onArtworkPatch,
		risers = []
	}: {
		adultContentEnabled?: boolean;
		gridArtworks?: Artwork[];
		leadArtwork?: Artwork | null;
		viewer?: { id: string; role: 'admin' | 'moderator' | 'user' } | null;
		onArtworkPatch?: (
			artworkId: string,
			patch: Partial<Pick<Artwork, 'isHidden' | 'isNsfw'>>
		) => void;
		onSelect?: (artwork: Artwork) => void;
		risers?: Artwork[];
	} = $props();
</script>

<div class="space-y-8">
	{#if leadArtwork}
		{@const frame = resolveArtworkFrame({ artworkId: leadArtwork.id })}
		<div class="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
			<button
				type="button"
				class="rounded-[1.75rem] border-4 border-[#2d2420] bg-[linear-gradient(135deg,rgba(200,79,79,0.16),rgba(255,250,244,0.96))] p-5 text-left shadow-[0_20px_40px_rgba(45,36,32,0.14)] transition duration-200 hover:-translate-y-1"
				onclick={() => onSelect?.(leadArtwork)}
			>
				<div class="mb-4 flex items-center justify-between gap-4">
					<div>
						<p class="text-[0.75rem] font-black tracking-[0.22em] text-[#b84a43] uppercase">
							Hot right now
						</p>
						<h2 class="font-display mt-2 text-3xl font-black text-[#2d2420] uppercase">
							{leadArtwork.title}
						</h2>
						<p class="mt-2 text-sm font-semibold text-[#6b5647]">by {leadArtwork.artist}</p>
					</div>
					<div
						class="rounded-full border-4 border-[#2d2420] bg-[#c84f4f] px-4 py-2 text-xs font-black tracking-[0.16em] text-[#fffaf4] uppercase"
					>
						Rising now
					</div>
				</div>

				<div
					class="overflow-hidden rounded-[1.5rem] border-4 border-[#2d2420] bg-[#9f7b55] p-4 shadow-inner"
				>
					<ArtworkFrame
						{frame}
						className="aspect-square w-full"
						testId={`hot-wall-frame-${leadArtwork.id}`}
					>
						<div class="relative h-full w-full">
							<img
								src={leadArtwork.imageUrl}
								alt={leadArtwork.title}
								class={`h-full w-full object-cover ${leadArtwork.isNsfw && !adultContentEnabled ? 'scale-[1.04] blur-xl saturate-0' : ''}`}
							/>
							{#if leadArtwork.isNsfw && !adultContentEnabled}
								<div
									class="absolute inset-0 flex flex-col items-center justify-center border-2 border-dashed border-[#2d2420] bg-[rgba(45,36,32,0.72)] px-4 text-center text-[#fdfbf7]"
								>
									<span class="rounded-full border-2 border-[#fdfbf7] px-3 py-1 text-xs font-black"
										>18+</span
									>
									<p class="mt-3 text-sm font-bold uppercase">Sensitive artwork</p>
								</div>
							{/if}
						</div>
					</ArtworkFrame>
				</div>

				<div class="mt-4 flex flex-wrap gap-2 text-sm font-bold text-[#2d2420]">
					<span class="rounded-full border-3 border-[#2d2420] bg-[#fffaf4] px-3 py-1"
						>Score {leadArtwork.score}</span
					>
					<span class="rounded-full border-3 border-[#2d2420] bg-[#fffaf4] px-3 py-1"
						>Comments {leadArtwork.commentCount}</span
					>
					<span class="rounded-full border-3 border-[#2d2420] bg-[#fffaf4] px-3 py-1"
						>Forks {leadArtwork.forkCount}</span
					>
				</div>
			</button>

			<div
				class="rounded-[1.75rem] border-4 border-[#2d2420] bg-[#fffaf4]/95 p-5 shadow-[0_20px_40px_rgba(45,36,32,0.12)]"
			>
				<p class="text-[0.72rem] font-black tracking-[0.18em] text-[#b84a43] uppercase">
					Why it is hot
				</p>
				<h3 class="font-display mt-2 text-2xl font-black text-[#2d2420]">
					Fresh pieces rising fast through the current gallery heat.
				</h3>
				<p class="mt-3 text-sm text-[#6b5647]">
					The Hot Wall favors momentum right now, not all-time prestige. Hall of Fame keeps the
					trophies. This wall keeps the sparks.
				</p>
				{#if risers.length > 0}
					<div class="mt-5 space-y-3">
						<p class="text-xs font-black tracking-[0.18em] text-[#8a6a42] uppercase">
							Still climbing
						</p>
						{#each risers.slice(0, 3) as artwork (artwork.id)}
							<button
								type="button"
								class="flex w-full items-center justify-between gap-3 rounded-[1rem] border-3 border-[#2d2420] bg-[#f8efe4] px-4 py-3 text-left transition hover:-translate-y-0.5"
								onclick={() => onSelect?.(artwork)}
							>
								<div>
									<p class="font-black text-[#2d2420]">{artwork.title}</p>
									<p class="mt-1 text-xs font-semibold text-[#6b5647]">by {artwork.artist}</p>
								</div>
								<span class="rounded-full bg-[#c84f4f] px-3 py-1 text-xs font-black text-[#fffaf4]"
									>{artwork.score}</span
								>
							</button>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	{/if}

	{#if gridArtworks.length > 0}
		<div class="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-3">
			{#each gridArtworks as artwork, index (artwork.id)}
				<ArtworkCard
					{adultContentEnabled}
					{artwork}
					{index}
					frameTestId={`hot-wall-riser-${artwork.id}`}
					{viewer}
					onArtworkPatch={(patch) => onArtworkPatch?.(artwork.id, patch)}
					onclick={() => onSelect?.(artwork)}
				/>
			{/each}
		</div>
	{/if}
</div>
