<script lang="ts">
	import ArtworkFrame from '$lib/features/artwork-presentation/components/ArtworkFrame.svelte';
	import type { Artwork } from '$lib/features/artwork-presentation/model/artwork';
	import {
		ARTWORK_VIEW_TRANSITION_NAME,
		artworkTransitionSourceId
	} from '$lib/features/gallery-exploration/artwork-view-transition';
	import { resolveArtworkFrame } from '$lib/features/artwork-presentation/model/frame';
	import { createArtworkAccumulator } from '$lib/features/gallery-exploration/artwork-accumulator.svelte';
	import NsfwImage from '$lib/features/gallery-exploration/components/NsfwImage.svelte';
	import ScrollSentinel from '$lib/features/gallery-exploration/components/ScrollSentinel.svelte';
	import VirtualizedGrid from '$lib/features/gallery-exploration/components/VirtualizedGrid.svelte';
	import PolaroidCard from '$lib/features/shared-ui/components/PolaroidCard.svelte';
	import WaxSealAvatar from '$lib/features/shared-ui/components/WaxSealAvatar.svelte';
	import WaxSealMedal from '$lib/features/shared-ui/components/WaxSealMedal.svelte';
	import { untrack } from 'svelte';
	import { writable, type Writable } from 'svelte/store';

	interface Props {
		artworks: Artwork[];
		pageInfo: { hasMore: boolean; nextCursor: string | null };
		adultContentEnabled: boolean;
		loadMoreArtworks?: (request: { cursor: string }) => Promise<{
			artworks: Artwork[];
			pageInfo: { hasMore: boolean; nextCursor: string | null };
		}>;
		onSelect: (artwork: Artwork) => void;
		revealedArtworkIds?: Writable<Set<string>>;
		viewerId?: string | null;
	}

	let {
		artworks,
		pageInfo,
		adultContentEnabled,
		loadMoreArtworks,
		onSelect,
		revealedArtworkIds,
		viewerId = null
	}: Props = $props();

	const fallbackRevealedIds = writable<Set<string>>(new Set());
	const revealedIds = $derived(revealedArtworkIds ?? fallbackRevealedIds);

	const revealArtwork = (artworkId: string) => {
		revealedIds.update((ids) => new Set([...ids, artworkId]));
	};

	const isPodiumBlurred = (artwork: Artwork) =>
		artwork.isNsfw &&
		!adultContentEnabled &&
		viewerId !== artwork.authorId &&
		!$revealedIds.has(artwork.id);

	const podiumMeta = {
		1: {
			height: 'h-76 md:h-[22rem]',
			label: 'CHAMPION',
			width: 'w-76 md:w-[22rem]',
			bannerBg: 'linear-gradient(180deg, #e2bb55, #c89a35)',
			bannerInk: '#4a3408',
			plateBg: 'linear-gradient(170deg, #dcbd72 0%, #c2a04a 45%, #a8862e 100%)',
			plateBorder: '#7a5c1d',
			plateInk: '#3a2a08',
			plateSoft: '#5c451a',
			plateHi: 'rgba(255, 244, 208, 0.55)'
		},
		2: {
			height: 'h-68 md:h-[19rem]',
			label: 'RUNNER UP',
			width: 'w-68 md:w-[19rem]',
			bannerBg: 'linear-gradient(180deg, #cdd1d9, #aab0bc)',
			bannerInk: '#32363f',
			plateBg: 'linear-gradient(170deg, #dfe1e6 0%, #bfc3cb 45%, #9fa5b1 100%)',
			plateBorder: '#767c88',
			plateInk: '#23262d',
			plateSoft: '#43474f',
			plateHi: 'rgba(255, 255, 255, 0.5)'
		},
		3: {
			height: 'h-60 md:h-[16rem]',
			label: 'BRONZE STAR',
			width: 'w-60 md:w-[16rem]',
			bannerBg: 'linear-gradient(180deg, #cf9357, #ad6e33)',
			bannerInk: '#42250c',
			plateBg: 'linear-gradient(170deg, #d49a64 0%, #b07238 45%, #8d5524 100%)',
			plateBorder: '#6b3f17',
			plateInk: '#2f1a06',
			plateSoft: '#53300f',
			plateHi: 'rgba(255, 225, 196, 0.45)'
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
		fetchPage: async (cursor: string) => {
			if (!loadMoreArtworks) {
				throw new Error('loadMoreArtworks is not configured');
			}
			return loadMoreArtworks({ cursor });
		},
		initialArtworks: initialArtworks.slice(3),
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
				accumulator.reseed(artworks.slice(3), pageInfo);
			});
			return;
		}

		untrack(() => {
			accumulator.syncSeedArtworks(artworks.slice(3));
		});
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
							className={position === 2 ? 'rotate-2' : '-rotate-3'}
							{position}
							size={position === 1 ? 'large' : position === 2 ? 'medium' : 'small'}
						/>
						<div
							class="podium-banner"
							style={`--banner-bg:${meta.bannerBg};--banner-ink:${meta.bannerInk};--banner-tilt:${position === 2 ? 1 : -1.4}deg;`}
						>
							{meta.label}
						</div>
					</div>

					<button
						type="button"
						class={`relative ${meta.width} ${meta.height} cursor-pointer`}
						data-testid={`podium-artwork-${position}`}
						onclick={() => {
							if (isPodiumBlurred(artwork) && viewerId) {
								revealArtwork(artwork.id);
								return;
							}
							onSelect(artwork);
						}}
					>
						<div class="h-full transition duration-200 hover:-translate-y-2 hover:scale-105">
							<ArtworkFrame
								{frame}
								className="h-full w-full"
								openingClass="h-full"
								testId={`podium-frame-${position}`}
							>
								<div
									class="relative h-full w-full"
									style:view-transition-name={$artworkTransitionSourceId === artwork.id
										? ARTWORK_VIEW_TRANSITION_NAME
										: undefined}
								>
									<NsfwImage
										src={artwork.imageUrl}
										alt={artwork.title}
										placeholder={artwork.imagePlaceholder}
										blurred={isPodiumBlurred(artwork)}
										ariaLabel={viewerId
											? 'Sensitive artwork, click to reveal'
											: 'Sensitive artwork'}
										loading="eager"
										decoding="async"
										fetchpriority="high"
										className="h-full w-full object-cover"
									/>
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

					<!-- Engraved plate on a walnut backing, like a proper museum award -->
					<div
						class="podium-plaque"
						data-testid={`podium-plaque-${position}`}
						style={`--plate-bg:${meta.plateBg};--plate-border:${meta.plateBorder};--plate-ink:${meta.plateInk};--plate-soft:${meta.plateSoft};--plate-hi:${meta.plateHi};--plaque-tilt:${position === 2 ? 0.5 : position === 3 ? -0.4 : -0.7}deg;`}
					>
						<div class="plaque-plate">
							<span class="plaque-screw screw-tl" aria-hidden="true"></span>
							<span class="plaque-screw screw-tr" aria-hidden="true"></span>
							<span class="plaque-screw screw-bl" aria-hidden="true"></span>
							<span class="plaque-screw screw-br" aria-hidden="true"></span>
							<div class="plaque-title">{artwork.title}</div>
							<div class="plaque-divider" aria-hidden="true"></div>
							<div class="plaque-artist">{artwork.artist}</div>
							<div class="plaque-score">⭐ {artwork.score}</div>
						</div>
					</div>
				</div>
			{/if}
		{/each}
	</div>

	<div class="w-full">
		<VirtualizedGrid items={accumulator.allArtworks}>
			{#snippet renderCard(artwork)}
				<PolaroidCard
					{artwork}
					{viewerId}
					{adultContentEnabled}
					revealed={$revealedIds.has(artwork.id)}
					onReveal={() => revealArtwork(artwork.id)}
					imageLoading="eager"
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
			skeletonGridClassName="grid gap-12 py-6"
			onTrigger={() => accumulator.loadMore()}
		/>
	</div>
</div>

<style>
	/* award ribbon under the rosette — notched ends, engraved lettering */
	.podium-banner {
		padding: 0.42rem 1.35rem;
		rotate: var(--banner-tilt, -1.4deg);
		background:
			linear-gradient(
				104deg,
				transparent 0 44%,
				rgba(0, 0, 0, 0.08) 48%,
				rgba(255, 255, 255, 0.05) 50%,
				transparent 55%
			),
			var(--banner-bg);
		color: var(--banner-ink);
		font-family: 'Fredoka', sans-serif;
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		text-shadow: 0 1px 0 rgba(255, 255, 255, 0.35);
		clip-path: polygon(0 0, 100% 0, calc(100% - 9px) 50%, 100% 100%, 0 100%, 9px 50%);
		box-shadow: 0 3px 8px rgba(0, 0, 0, 0.25);
	}

	/* walnut backing */
	.podium-plaque {
		rotate: var(--plaque-tilt, -0.7deg);
		padding: 5px;
		border-radius: 4px;
		border: 1px solid #2c1d0e;
		background: linear-gradient(135deg, #4a3522 0%, #3a2817 55%, #2e1f10 100%);
		box-shadow:
			0 6px 16px rgba(0, 0, 0, 0.4),
			inset 0 1px 0 rgba(255, 235, 200, 0.12);
	}

	/* brushed, engraved metal plate */
	.plaque-plate {
		position: relative;
		min-width: 11rem;
		max-width: 16rem;
		padding: 0.7rem 1.4rem 0.65rem;
		text-align: center;
		border-radius: 2px;
		border: 1px solid var(--plate-border);
		background:
			repeating-linear-gradient(
				90deg,
				rgba(255, 255, 255, 0.045) 0 1px,
				rgba(0, 0, 0, 0.025) 1px 3px
			),
			var(--plate-bg);
		box-shadow:
			inset 0 1px 0 var(--plate-hi),
			inset 0 -1px 0 rgba(0, 0, 0, 0.22),
			inset 1px 0 0 var(--plate-hi),
			inset -1px 0 0 rgba(0, 0, 0, 0.12);
	}

	/* tarnish creeping in from the corners and the bottom edge */
	.plaque-plate::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		pointer-events: none;
		background:
			radial-gradient(circle at 6% 8%, rgba(56, 38, 12, 0.16), transparent 26%),
			radial-gradient(circle at 95% 90%, rgba(40, 26, 8, 0.2), transparent 32%),
			radial-gradient(ellipse at 50% 108%, rgba(46, 30, 10, 0.14), transparent 42%);
	}

	.plaque-screw {
		position: absolute;
		width: 4px;
		height: 4px;
		border-radius: 50%;
		background: radial-gradient(circle at 35% 30%, var(--plate-hi), var(--plate-border) 75%);
		box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.35);
	}

	.screw-tl {
		top: 5px;
		left: 5px;
	}
	.screw-tr {
		top: 5px;
		right: 5px;
	}
	.screw-bl {
		bottom: 5px;
		left: 5px;
	}
	.screw-br {
		bottom: 5px;
		right: 5px;
	}

	/* engraved (letterpress) text */
	.plaque-title {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-family: 'Fredoka', sans-serif;
		font-size: 0.84rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--plate-ink);
		text-shadow: 0 1px 0 var(--plate-hi);
	}

	.plaque-divider {
		margin: 0.35rem auto;
		height: 1px;
		width: 72%;
		background: linear-gradient(
			90deg,
			transparent,
			var(--plate-border) 25%,
			var(--plate-border) 75%,
			transparent
		);
		box-shadow: 0 1px 0 var(--plate-hi);
	}

	.plaque-artist {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 0.74rem;
		font-weight: 600;
		font-style: italic;
		letter-spacing: 0.06em;
		color: var(--plate-soft);
		text-shadow: 0 1px 0 var(--plate-hi);
	}

	.plaque-score {
		margin-top: 0.3rem;
		font-family: 'Fredoka', sans-serif;
		font-size: 0.62rem;
		font-weight: 700;
		letter-spacing: 0.16em;
		color: var(--plate-soft);
		text-shadow: 0 1px 0 var(--plate-hi);
	}
</style>
