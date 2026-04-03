<script lang="ts">
	import type { Artwork } from '$lib/features/artwork-presentation/model/artwork';
	import { createArtworkAccumulator } from '$lib/features/gallery-exploration/artwork-accumulator.svelte';
	import GalleryImage from '$lib/features/gallery-exploration/components/GalleryImage.svelte';
	import ScrollSentinel from '$lib/features/gallery-exploration/components/ScrollSentinel.svelte';
	import PolaroidCard from '$lib/features/shared-ui/components/PolaroidCard.svelte';

	interface Props {
		artworks: Artwork[];
		pageInfo: { hasMore: boolean; nextCursor: string | null };
		adultContentEnabled?: boolean;
		loadMoreArtworks?: (request: { cursor: string }) => Promise<{
			artworks: Artwork[];
			pageInfo: { hasMore: boolean; nextCursor: string | null };
		}>;
		onSelect?: (artwork: Artwork) => void;
	}

	let {
		artworks,
		pageInfo,
		adultContentEnabled = false,
		loadMoreArtworks,
		onSelect = () => {}
	}: Props = $props();

	// Snapshot initial values to avoid reactive re-seeding
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
		initialArtworks,
		initialPageInfo
	});

	const leadArtwork = $derived(accumulator.allArtworks[0] ?? null);
	const supportingArtworks = $derived(accumulator.allArtworks.slice(1));
</script>

{#if accumulator.allArtworks.length === 0}
	<div
		class="flex min-h-[28rem] flex-col items-center justify-center gap-4 px-6 py-12 text-center"
		data-testid="hot-wall-empty"
	>
		<p
			class="font-display text-lg font-bold text-[#f7eadf]"
			style="text-shadow: 0 1px 2px rgba(45,36,32,0.5);"
		>
			Nothing heating up right now
		</p>
		<p class="max-w-sm text-sm text-[#c4b5a6]">
			When artworks start climbing fast, they'll appear here on the Hot Wall.
		</p>
	</div>
{:else}
	<div class="space-y-10" data-testid="hot-wall-room">
		<!-- Lead artwork: strongest prominence -->
		{#if leadArtwork}
			<div data-testid="hot-wall-lead" class="flex flex-col items-center gap-4">
				<button
					type="button"
					class="group hover:shadow-3xl relative mt-12 w-full max-w-md cursor-pointer overflow-hidden rounded-xl shadow-2xl transition duration-300 hover:-translate-y-1"
					onclick={() => onSelect(leadArtwork)}
				>
					<div class="relative aspect-square w-full">
						<GalleryImage
							src={leadArtwork.imageUrl}
							alt={leadArtwork.title}
							className={`h-full w-full object-cover ${leadArtwork.isNsfw && !adultContentEnabled ? 'scale-[1.04] blur-xl saturate-0' : ''}`}
						/>
						{#if leadArtwork.isNsfw && !adultContentEnabled}
							<div
								class="absolute inset-0 flex flex-col items-center justify-center bg-[rgba(45,36,32,0.72)] text-[#fdfbf7]"
							>
								<span class="rounded-full border-2 border-[#fdfbf7] px-3 py-1 text-xs font-black"
									>18+</span
								>
								<p class="mt-3 text-sm font-bold uppercase">Sensitive artwork</p>
							</div>
						{/if}
					</div>
					<div
						class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[rgba(45,36,32,0.85)] to-transparent p-6 pt-16"
					>
						<div
							class="mb-1 inline-block rounded-full bg-[#e74c3c] px-3 py-1 text-xs font-black tracking-wider text-white uppercase"
						>
							Hottest right now
						</div>
						<h3 class="text-xl font-bold text-[#fdfbf7]">{leadArtwork.title}</h3>
						<p class="mt-1 text-sm text-[#c4b5a6]">
							{leadArtwork.artist} · ⭐ {leadArtwork.score}
						</p>
					</div>
				</button>
			</div>
		{/if}

		<!-- Supporting wall: remaining artworks in a grid -->
		{#if supportingArtworks.length > 0}
			<div class="w-full">
				<div class="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-3">
					{#each supportingArtworks as artwork (artwork.id)}
						<div data-testid={`hot-wall-card-${artwork.id}`}>
							<PolaroidCard
								{artwork}
								testId={`hot-wall-polaroid-${artwork.id}`}
								onclick={() => onSelect(artwork)}
							/>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- ScrollSentinel for infinite scroll -->
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
{/if}
