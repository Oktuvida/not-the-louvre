<script lang="ts">
	import type { Artwork } from '$lib/features/artwork-presentation/model/artwork';
	import { createArtworkAccumulator } from '$lib/features/gallery-exploration/artwork-accumulator.svelte';
	import {
		ARTWORK_VIEW_TRANSITION_NAME,
		artworkTransitionSourceId
	} from '$lib/features/gallery-exploration/artwork-view-transition';
	import NsfwImage from '$lib/features/gallery-exploration/components/NsfwImage.svelte';
	import ScrollSentinel from '$lib/features/gallery-exploration/components/ScrollSentinel.svelte';
	import VirtualizedGrid from '$lib/features/gallery-exploration/components/VirtualizedGrid.svelte';
	import PolaroidCard from '$lib/features/shared-ui/components/PolaroidCard.svelte';
	import { untrack } from 'svelte';
	import { writable, type Writable } from 'svelte/store';

	interface Props {
		artworks: Artwork[];
		pageInfo: { hasMore: boolean; nextCursor: string | null };
		adultContentEnabled?: boolean;
		loadMoreArtworks?: (request: { cursor: string }) => Promise<{
			artworks: Artwork[];
			pageInfo: { hasMore: boolean; nextCursor: string | null };
		}>;
		onSelect?: (artwork: Artwork) => void;
		revealedArtworkIds?: Writable<Set<string>>;
		viewerId?: string | null;
	}

	let {
		artworks,
		pageInfo,
		adultContentEnabled = false,
		loadMoreArtworks,
		onSelect = () => {},
		revealedArtworkIds,
		viewerId = null
	}: Props = $props();

	// Snapshot initial values to avoid reactive re-seeding
	const { initialArtworks, initialPageInfo } = (() => ({
		initialArtworks: $state.snapshot(artworks),
		initialPageInfo: $state.snapshot(pageInfo)
	}))();

	const accumulator = createArtworkAccumulator({
		fetchPage: async (cursor: string) => {
			if (!loadMoreArtworks) {
				throw new Error('loadMoreArtworks is not configured');
			}
			return loadMoreArtworks({ cursor });
		},
		initialArtworks,
		initialPageInfo
	});

	const seedIdentity = (items: Artwork[]) => items.map((a) => a.id).join(',');
	const pageInfoIdentity = (info: { hasMore: boolean; nextCursor: string | null }) =>
		`${info.hasMore}:${info.nextCursor ?? ''}`;
	let lastSeedIdentity = seedIdentity(initialArtworks);
	let lastPageInfoIdentity = pageInfoIdentity(initialPageInfo);

	$effect(() => {
		const identity = seedIdentity(artworks);
		const nextPageInfoIdentity = pageInfoIdentity(pageInfo);
		if (identity !== lastSeedIdentity || nextPageInfoIdentity !== lastPageInfoIdentity) {
			lastSeedIdentity = identity;
			lastPageInfoIdentity = nextPageInfoIdentity;
			untrack(() => {
				accumulator.reseed(artworks, pageInfo);
			});
			return;
		}

		untrack(() => {
			accumulator.syncSeedArtworks(artworks);
		});
	});

	const fallbackRevealedIds = writable<Set<string>>(new Set());
	const revealedIds = $derived(revealedArtworkIds ?? fallbackRevealedIds);

	const revealArtwork = (artworkId: string) => {
		revealedIds.update((ids) => new Set([...ids, artworkId]));
	};

	const isLeadBlurred = (artwork: Artwork | null) =>
		!!artwork &&
		artwork.isNsfw &&
		!adultContentEnabled &&
		viewerId !== artwork.authorId &&
		!$revealedIds.has(artwork.id);

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
					onclick={() => {
						if (isLeadBlurred(leadArtwork) && viewerId) {
							revealArtwork(leadArtwork.id);
							return;
						}
						onSelect(leadArtwork);
					}}
				>
					<div
						class="relative aspect-square w-full"
						style:view-transition-name={$artworkTransitionSourceId === leadArtwork.id
							? ARTWORK_VIEW_TRANSITION_NAME
							: undefined}
					>
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
