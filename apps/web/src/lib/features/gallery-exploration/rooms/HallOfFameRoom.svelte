<script lang="ts">
	import ArtworkFrame from '$lib/features/artwork-presentation/components/ArtworkFrame.svelte';
	import type { Artwork } from '$lib/features/artwork-presentation/model/artwork';
	import { resolveArtworkFrame } from '$lib/features/artwork-presentation/model/frame';
	import { createArtworkAccumulator } from '$lib/features/gallery-exploration/artwork-accumulator.svelte';
	import ScrollSentinel from '$lib/features/gallery-exploration/components/ScrollSentinel.svelte';
	import VirtualizedGrid from '$lib/features/gallery-exploration/components/VirtualizedGrid.svelte';
	import PolaroidCard from '$lib/features/shared-ui/components/PolaroidCard.svelte';
	import WaxSealAvatar from '$lib/features/shared-ui/components/WaxSealAvatar.svelte';
	import WaxSealMedal from '$lib/features/shared-ui/components/WaxSealMedal.svelte';

	interface Props {
		artworks: Artwork[];
		pageInfo: { hasMore: boolean; nextCursor: string | null };
		adultContentEnabled: boolean;
		loadMoreArtworks?: (request: { cursor: string }) => Promise<{
			artworks: Artwork[];
			pageInfo: { hasMore: boolean; nextCursor: string | null };
		}>;
		onSelect: (artwork: Artwork) => void;
	}

	let { artworks, pageInfo, adultContentEnabled, loadMoreArtworks, onSelect }: Props = $props();

	const podiumMeta = {
		1: {
			color: '#f4c430',
			height: 'h-76 md:h-[22rem]',
			label: 'CHAMPION',
			width: 'w-76 md:w-[22rem]'
		},
		2: {
			color: '#c0c0c0',
			height: 'h-68 md:h-[19rem]',
			label: 'RUNNER UP',
			width: 'w-68 md:w-[19rem]'
		},
		3: {
			color: '#cd7f32',
			height: 'h-60 md:h-[16rem]',
			label: 'BRONZE STAR',
			width: 'w-60 md:w-[16rem]'
		}
	} as const;

	const podiumArtworks = $derived([
		{ artwork: artworks[0], position: 1 as const },
		{ artwork: artworks[1], position: 2 as const },
		{ artwork: artworks[2], position: 3 as const }
	]);

	const frameForArtwork = (artworkId: string, podiumPosition?: 1 | 2 | 3) =>
		resolveArtworkFrame({ artworkId, podiumPosition });

	const { initialArtworks, initialPageInfo } = (() => ({
		initialArtworks: $state.snapshot(artworks),
		initialPageInfo: $state.snapshot(pageInfo)
	}))();

	const accumulator = createArtworkAccumulator({
		columnCount: 4,
		fetchPage: async (cursor: string) => {
			if (!loadMoreArtworks) {
				throw new Error('loadMoreArtworks is not configured');
			}
			return loadMoreArtworks({ cursor });
		},
		initialArtworks: initialArtworks.slice(3),
		initialPageInfo
	});
</script>

<div class="space-y-12">
	<div
		class="mb-16 flex flex-col items-center justify-center gap-8 lg:flex-row lg:items-end lg:gap-10"
	>
		{#each podiumArtworks as entry (`podium-${entry.position}-${entry.artwork?.id ?? 'empty'}`)}
			{@const artwork = entry.artwork}
			{#if artwork}
				{@const position = entry.position}
				{@const meta = podiumMeta[position]}
				{@const frame = frameForArtwork(artwork.id, position)}
				<div class="relative flex flex-col items-center gap-5">
					<div class="relative mb-5 flex flex-col items-center gap-3">
						<WaxSealMedal
							{position}
							size={position === 1 ? 'large' : position === 2 ? 'medium' : 'small'}
						/>
						<div
							class="font-display rounded-full border-[3px] border-[#2d2420] bg-[#f8f2e8]/92 px-5 py-1.5 text-xs font-black tracking-[0.16em] text-[#2d2420] shadow-lg"
							style={`background:${meta.color}`}
						>
							{meta.label}
						</div>
					</div>

					<button
						type="button"
						class={`relative ${meta.width} ${meta.height} cursor-pointer`}
						data-testid={`podium-artwork-${position}`}
						onclick={() => onSelect(artwork)}
					>
						<div class="h-full transition duration-200 hover:-translate-y-2 hover:scale-105">
							<ArtworkFrame
								{frame}
								className="h-full w-full"
								openingClass="h-full"
								testId={`podium-frame-${position}`}
							>
								<div class="relative h-full w-full">
									<img
										src={artwork.imageUrl}
										alt={artwork.title}
										loading={position === 1 ? 'eager' : 'lazy'}
										decoding={position === 1 ? 'sync' : 'async'}
										class={`h-full w-full object-cover transition duration-200 ${artwork.isNsfw && !adultContentEnabled ? 'scale-[1.04] blur-xl saturate-0' : ''}`}
									/>
									{#if artwork.isNsfw && !adultContentEnabled}
										<div
											class="absolute inset-0 flex flex-col items-center justify-center border-2 border-dashed border-[#2d2420] bg-[rgba(45,36,32,0.72)] text-[#fdfbf7]"
										>
											<span
												class="rounded-full border-2 border-[#fdfbf7] px-3 py-1 text-xs font-black"
												>18+</span
											>
											<p class="mt-3 text-sm font-bold uppercase">Sensitive artwork</p>
										</div>
									{/if}
								</div>
							</ArtworkFrame>
							{#if artwork.artistAvatar}
								<div class="absolute -right-4 -bottom-4">
									<WaxSealAvatar
										alt={artwork.artist}
										seed={artwork.id}
										size="lg"
										src={artwork.artistAvatar}
									/>
								</div>
							{/if}
						</div>
					</button>

					<div
						class="rounded-[1.1rem] border-[3px] border-[#4d351c] bg-[linear-gradient(180deg,rgba(255,249,238,0.96),rgba(239,228,208,0.96))] px-4 py-3 text-center text-[#2d2420] shadow-[0_10px_18px_rgba(0,0,0,0.14),inset_0_1px_0_rgba(255,255,255,0.45)]"
						data-testid={`podium-plaque-${position}`}
					>
						<div class="text-[0.68rem] font-black tracking-[0.18em] text-[#8a6a42] uppercase">
							#{position}
							{meta.label}
						</div>
						<div class="mt-1 text-sm font-bold text-[#2d2420]">{artwork.artist}</div>
						<div class="mt-1 text-xs font-semibold text-[#5f554b]">
							⭐ {artwork.score}
						</div>
					</div>
				</div>
			{/if}
		{/each}
	</div>

	<div class="w-full">
		<VirtualizedGrid rows={accumulator.rows}>
			{#snippet renderCard(artwork)}
				<PolaroidCard
					{artwork}
					testId={`ranked-polaroid-${artwork.id}`}
					onclick={() => onSelect(artwork)}
				/>
			{/snippet}
		</VirtualizedGrid>
		<ScrollSentinel
			disabled={false}
			error={accumulator.error}
			hasMore={accumulator.hasMore}
			isLoading={accumulator.isLoading}
			rootMargin="500px"
			onRetry={() => accumulator.retry()}
			skeletonCount={4}
			skeletonGridClassName="grid grid-cols-1 gap-12 py-6 md:grid-cols-2 lg:grid-cols-4"
			onTrigger={() => accumulator.loadMore()}
		/>
	</div>
</div>
