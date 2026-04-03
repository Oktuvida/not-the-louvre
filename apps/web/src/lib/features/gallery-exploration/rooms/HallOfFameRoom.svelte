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
			width: 'w-76 md:w-[22rem]',
			plaque: {
				bg: 'linear-gradient(170deg, #e8d06e 0%, #d4b43a 30%, #c9a52e 60%, #b8942a 100%)',
				border: '#a07a1a',
				title: '#3a2200',
				artist: '#5c3d10',
				divider: 'rgba(160,122,26,0.45)',
				score: '#6b4c14',
				highlight: 'rgba(255,255,255,0.35)'
			}
		},
		2: {
			color: '#c0c0c0',
			height: 'h-68 md:h-[19rem]',
			label: 'RUNNER UP',
			width: 'w-68 md:w-[19rem]',
			plaque: {
				bg: 'linear-gradient(170deg, #d8d8d8 0%, #c0c0c0 30%, #a8a8a8 60%, #989898 100%)',
				border: '#8a8a8a',
				title: '#1a1a1a',
				artist: '#3a3a3a',
				divider: 'rgba(138,138,138,0.45)',
				score: '#444444',
				highlight: 'rgba(255,255,255,0.4)'
			}
		},
		3: {
			color: '#cd7f32',
			height: 'h-60 md:h-[16rem]',
			label: 'BRONZE STAR',
			width: 'w-60 md:w-[16rem]',
			plaque: {
				bg: 'linear-gradient(170deg, #d4944a 0%, #cd7f32 30%, #b8702a 60%, #a56224 100%)',
				border: '#8a5518',
				title: '#2d1400',
				artist: '#4a2a0c',
				divider: 'rgba(138,85,24,0.45)',
				score: '#5c3610',
				highlight: 'rgba(255,255,255,0.3)'
			}
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
		columnCount: 3,
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

					<!-- Plaque: wood backing + metal plate with corner screws -->
					<div
						class="rounded-md border border-[#3a2a18] bg-[linear-gradient(135deg,#5c3d1e_0%,#4a3018_50%,#3d2712_100%)] p-1.5 shadow-[0_6px_18px_rgba(0,0,0,0.35)]"
						data-testid={`podium-plaque-${position}`}
					>
						<div
							class="relative max-w-[16rem] min-w-[10rem] rounded-[2px] border px-5 py-3 text-center"
							style={`background: ${meta.plaque.bg}; border-color: ${meta.plaque.border}; box-shadow: inset 0 1px 0 ${meta.plaque.highlight}, inset 0 -1px 0 rgba(0,0,0,0.2), inset 1px 0 0 ${meta.plaque.highlight}, inset -1px 0 0 rgba(0,0,0,0.1);`}
						>
							<!-- Corner screws -->
							<div
								class="absolute top-1.5 left-1.5 h-[5px] w-[5px] rounded-full"
								style={`background: radial-gradient(circle at 35% 35%, ${meta.plaque.highlight}, ${meta.plaque.border}); box-shadow: inset 0 1px 1px rgba(0,0,0,0.3);`}
							></div>
							<div
								class="absolute top-1.5 right-1.5 h-[5px] w-[5px] rounded-full"
								style={`background: radial-gradient(circle at 35% 35%, ${meta.plaque.highlight}, ${meta.plaque.border}); box-shadow: inset 0 1px 1px rgba(0,0,0,0.3);`}
							></div>
							<div
								class="absolute bottom-1.5 left-1.5 h-[5px] w-[5px] rounded-full"
								style={`background: radial-gradient(circle at 35% 35%, ${meta.plaque.highlight}, ${meta.plaque.border}); box-shadow: inset 0 1px 1px rgba(0,0,0,0.3);`}
							></div>
							<div
								class="absolute right-1.5 bottom-1.5 h-[5px] w-[5px] rounded-full"
								style={`background: radial-gradient(circle at 35% 35%, ${meta.plaque.highlight}, ${meta.plaque.border}); box-shadow: inset 0 1px 1px rgba(0,0,0,0.3);`}
							></div>

							<div
								class="font-display truncate text-sm font-bold tracking-[0.08em] uppercase"
								style={`color: ${meta.plaque.title}; text-shadow: 0 1px 0 ${meta.plaque.highlight};`}
							>
								{artwork.title}
							</div>
							<div
								class="mx-auto my-1.5 h-px w-3/4"
								style={`background: ${meta.plaque.divider};`}
							></div>
							<div
								class="truncate text-xs font-semibold tracking-wide italic"
								style={`color: ${meta.plaque.artist}; text-shadow: 0 1px 0 ${meta.plaque.highlight};`}
							>
								{artwork.artist}
							</div>
							<div
								class="mt-1.5 text-[0.65rem] font-black tracking-[0.14em] uppercase"
								style={`color: ${meta.plaque.score}; text-shadow: 0 1px 0 ${meta.plaque.highlight};`}
							>
								⭐ {artwork.score}
							</div>
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
			skeletonCount={3}
			skeletonGridClassName="grid grid-cols-1 gap-12 py-6 md:grid-cols-2 lg:grid-cols-3"
			onTrigger={() => accumulator.loadMore()}
		/>
	</div>
</div>
