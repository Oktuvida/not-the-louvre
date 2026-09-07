<script lang="ts">
	import type { Artwork } from '$lib/features/artwork-presentation/model/artwork';
	import NsfwImage from '$lib/features/gallery-exploration/components/NsfwImage.svelte';
	import ScrollSentinel from '$lib/features/gallery-exploration/components/ScrollSentinel.svelte';
	import VirtualizedGrid from '$lib/features/gallery-exploration/components/VirtualizedGrid.svelte';
	import type {
		GalleryPageInfo,
		LoadMoreArtworks
	} from '$lib/features/gallery-exploration/model/discovery';
	import type { GalleryRoomId } from '$lib/features/gallery-exploration/model/rooms';
	import { isArtworkBlurred } from '$lib/features/gallery-exploration/model/sensitivity';
	import { createSeededAccumulator } from '$lib/features/gallery-exploration/use-seeded-accumulator.svelte';
	import PolaroidCard from '$lib/features/shared-ui/components/PolaroidCard.svelte';
	import { writable, type Writable } from 'svelte/store';

	interface Props {
		artworks: Artwork[];
		pageInfo: GalleryPageInfo;
		adultContentEnabled?: boolean;
		feedCacheKey?: GalleryRoomId | null;
		loadMoreArtworks?: LoadMoreArtworks;
		onPrefetch?: (artworkId: string) => void;
		onSelect?: (artwork: Artwork) => void;
		revealedArtworkIds?: Writable<Set<string>>;
		viewerId?: string | null;
	}

	let {
		artworks,
		pageInfo,
		adultContentEnabled = false,
		feedCacheKey = null,
		loadMoreArtworks,
		onPrefetch,
		onSelect = () => {},
		revealedArtworkIds,
		viewerId = null
	}: Props = $props();

	const accumulator = createSeededAccumulator({
		getFeedCacheKey: () => feedCacheKey,
		getArtworks: () => artworks,
		getLoadMoreArtworks: () => loadMoreArtworks,
		getPageInfo: () => pageInfo
	});

	const fallbackRevealedIds = writable<Set<string>>(new Set());
	const revealedIds = $derived(revealedArtworkIds ?? fallbackRevealedIds);

	const revealArtwork = (artworkId: string) => {
		revealedIds.update((ids) => new Set([...ids, artworkId]));
	};

	/*
	 * The lead's own copy of PolaroidCard's intent handlers. Touch is left out
	 * on purpose: `pointerdown` fires the moment a finger lands, before the
	 * browser can tell a tap from the start of a scroll, and the `pointercancel`
	 * a flick ends with cannot recall a request that already went out.
	 */
	const signalPointerIntent = (event: PointerEvent, artworkId: string) => {
		if (event.pointerType === 'touch') return;
		onPrefetch?.(artworkId);
	};

	const signalKeyboardIntent = (event: KeyboardEvent, artworkId: string) => {
		if (event.key !== 'Enter' && event.key !== ' ') return;
		onPrefetch?.(artworkId);
	};

	const isLeadBlurred = (artwork: Artwork | null) =>
		!!artwork &&
		isArtworkBlurred(artwork, {
			adultContentEnabled,
			id: viewerId,
			revealedIds: $revealedIds
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
			class="font-display text-lg font-bold text-wall-text"
			style="text-shadow: 0 1px 2px rgba(45,36,32,0.5);"
		>
			Nothing heating up right now
		</p>
		<p class="max-w-sm text-sm text-clay">
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
					class="group relative mt-12 w-full max-w-md cursor-pointer overflow-hidden rounded-xl shadow-2xl transition duration-300 hover:-translate-y-1 hover:shadow-[0_28px_60px_rgba(45,36,32,0.45)]"
					onclick={() => {
						if (isLeadBlurred(leadArtwork) && viewerId) {
							revealArtwork(leadArtwork.id);
							return;
						}
						onSelect(leadArtwork);
					}}
					onkeydown={(event) => signalKeyboardIntent(event, leadArtwork.id)}
					onpointerdown={(event) => signalPointerIntent(event, leadArtwork.id)}
				>
					<div class="relative aspect-square w-full">
						<NsfwImage
							src={leadArtwork.imageUrl}
							alt={leadArtwork.title}
							placeholder={leadArtwork.imagePlaceholder}
							blurred={isLeadBlurred(leadArtwork)}
							ariaLabel={viewerId ? 'Sensitive artwork, click to reveal' : 'Sensitive artwork'}
							className="h-full w-full object-cover"
							loading="eager"
							fetchpriority="high"
						/>
					</div>
					<div
						class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[rgba(45,36,32,0.85)] to-transparent p-6 pt-16"
					>
						<div
							class="mb-1 inline-block rounded-full bg-alert px-3 py-1 text-xs font-black tracking-wider text-white uppercase"
						>
							Hottest right now
						</div>
						<h3 class="text-xl font-bold text-paper-bright">{leadArtwork.title}</h3>
						<p class="mt-1 text-sm text-clay">
							{leadArtwork.artist} · ⭐ {leadArtwork.score}
						</p>
					</div>
				</button>
			</div>
		{/if}

		<!-- Supporting wall: remaining artworks in a virtualized grid -->
		{#if supportingArtworks.length > 0}
			<div class="w-full">
				<VirtualizedGrid items={supportingArtworks}>
					{#snippet renderCard(artwork)}
						<div data-testid={`hot-wall-card-${artwork.id}`}>
							<PolaroidCard
								{artwork}
								{viewerId}
								{adultContentEnabled}
								revealed={$revealedIds.has(artwork.id)}
								onReveal={() => revealArtwork(artwork.id)}
								imageLoading="eager"
								testId={`hot-wall-polaroid-${artwork.id}`}
								onclick={() => onSelect(artwork)}
								onPointerIntent={() => onPrefetch?.(artwork.id)}
							/>
						</div>
					{/snippet}
				</VirtualizedGrid>
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
			skeletonGridClassName="grid gap-12 py-6"
			onTrigger={() => accumulator.loadMore()}
		/>
	</div>
{/if}
