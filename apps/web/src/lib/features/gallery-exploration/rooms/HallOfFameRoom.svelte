<script lang="ts">
	import ArtworkFrame from '#lib/features/artwork-presentation/components/ArtworkFrame.svelte';
	import type { Artwork } from '#lib/features/artwork-presentation/model/artwork.js';
	import { resolveArtworkFrame } from '#lib/features/artwork-presentation/model/frame.js';
	import NsfwImage from '#lib/features/gallery-exploration/components/NsfwImage.svelte';
	import ScrollSentinel from '#lib/features/gallery-exploration/components/ScrollSentinel.svelte';
	import VirtualizedGrid from '#lib/features/gallery-exploration/components/VirtualizedGrid.svelte';
	import type { GridLayoutSnapshot } from '#lib/features/gallery-exploration/model/grid.js';
	import type {
		GalleryPageInfo,
		LoadMoreArtworks
	} from '#lib/features/gallery-exploration/model/discovery.js';
	import type { GalleryRoomId } from '#lib/features/gallery-exploration/model/rooms.js';
	import { isArtworkBlurred } from '#lib/features/gallery-exploration/model/sensitivity.js';
	import { createSeededAccumulator } from '#lib/features/gallery-exploration/use-seeded-accumulator.svelte.js';
	import PolaroidCard from '#lib/features/shared-ui/components/PolaroidCard.svelte';
	import WaxSealAvatar from '#lib/features/shared-ui/components/WaxSealAvatar.svelte';
	import AwardMark from '#lib/features/shared-ui/components/AwardMark.svelte';
	import type { AwardStyle } from '#lib/features/shared-ui/award-style.js';
	import { writable, type Writable } from 'svelte/store';

	interface Props {
		artworks: Artwork[];
		pageInfo: GalleryPageInfo;
		adultContentEnabled: boolean;
		/** The award style this visit to the gallery drew. */
		awardStyle?: AwardStyle;
		feedCacheKey?: GalleryRoomId | null;
		/** The seed is one the room already had, standing in until the server's fresh page lands. */
		seedIsRemembered?: boolean;
		/** The room came drawn by the server, with the page, rather than built in the browser. */
		serverRendered?: boolean;
		loadMoreArtworks?: LoadMoreArtworks;
		onPrefetch?: (artworkId: string) => void;
		onSelect: (artwork: Artwork) => void;
		revealedArtworkIds?: Writable<Set<string>>;
		viewerId?: string | null;
	}

	let {
		artworks,
		pageInfo,
		adultContentEnabled,
		awardStyle = 'stamps',
		feedCacheKey = null,
		seedIsRemembered = false,
		serverRendered = true,
		loadMoreArtworks,
		onPrefetch,
		onSelect,
		revealedArtworkIds,
		viewerId = null
	}: Props = $props();

	const fallbackRevealedIds = writable<Set<string>>(new Set());
	const revealedIds = $derived(revealedArtworkIds ?? fallbackRevealedIds);

	const revealArtwork = (artworkId: string) => {
		revealedIds.update((ids) => new Set([...ids, artworkId]));
	};

	/*
	 * The podium's own copy of PolaroidCard's intent handlers. Touch is left out
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

	const isPodiumBlurred = (artwork: Artwork) =>
		isArtworkBlurred(artwork, {
			adultContentEnabled,
			id: viewerId,
			revealedIds: $revealedIds
		});

	// Each place is engraved on the metal of its frame: brass, nickel, copper.
	const podiumMeta = {
		1: {
			awardTilt: -9,
			height: 'h-76 md:h-[22rem]',
			label: 'Champion',
			width: 'w-76 md:w-[22rem]',
			plateBg: 'linear-gradient(135deg, #f6dd92 0%, #d5a645 38%, #f0cf72 55%, #b48630 100%)',
			plateInk: '#4a3008',
			plateHi: 'rgb(255 240 190 / 0.75)',
			plateRuleLight: 'rgb(255 244 200 / 0.55)',
			plateRuleDark: 'rgb(120 82 24 / 0.35)',
			screwLight: '#fff2c0',
			screwDark: '#9a7224'
		},
		2: {
			awardTilt: 7,
			height: 'h-68 md:h-[19rem]',
			label: 'Runner up',
			width: 'w-68 md:w-[19rem]',
			plateBg: 'linear-gradient(135deg, #f1f3f6 0%, #c3c8d0 38%, #e6e9ee 55%, #9aa1ac 100%)',
			plateInk: '#2b2f36',
			plateHi: 'rgb(255 255 255 / 0.75)',
			plateRuleLight: 'rgb(255 255 255 / 0.6)',
			plateRuleDark: 'rgb(70 76 88 / 0.35)',
			screwLight: '#ffffff',
			screwDark: '#747b88'
		},
		3: {
			awardTilt: -4,
			height: 'h-60 md:h-[16rem]',
			label: 'Bronze star',
			width: 'w-60 md:w-[16rem]',
			plateBg: 'linear-gradient(135deg, #f3c69a 0%, #c9824a 38%, #e8b27f 55%, #9a5a2c 100%)',
			plateInk: '#3e1f08',
			plateHi: 'rgb(255 226 196 / 0.7)',
			plateRuleLight: 'rgb(255 230 205 / 0.5)',
			plateRuleDark: 'rgb(100 50 20 / 0.35)',
			screwLight: '#ffe0c2',
			screwDark: '#8a4f24'
		}
	} as const;

	// UTC, so the server and the browser engrave the same year.
	const yearOf = (artwork: Artwork) => new Date(artwork.timestamp).getUTCFullYear();

	const podiumArtworks = $derived([
		{ artwork: artworks[0], position: 1 as const },
		{ artwork: artworks[1], position: 2 as const },
		{ artwork: artworks[2], position: 3 as const }
	]);

	const frameForArtwork = (artworkId: string, podiumPosition?: 1 | 2 | 3) =>
		resolveArtworkFrame({ artworkId, podiumPosition });

	// The podium owns the top three; the grid below it starts at the fourth. The
	// seed identity is still computed on the whole list, so a reorder confined to
	// the podium keeps reseeding the grid underneath it.
	// The grid's measured rows travel with the feed, so coming back lands on
	// the same card rather than on the same pixel of an estimated layout.
	let grid = $state<{ snapshotLayout(): GridLayoutSnapshot | null }>();

	const accumulator = createSeededAccumulator({
		getFeedCacheKey: () => feedCacheKey,
		getSeedIsRemembered: () => seedIsRemembered,
		getArtworks: () => artworks,
		getLayout: () => grid?.snapshotLayout() ?? null,
		getLoadMoreArtworks: () => loadMoreArtworks,
		getPageInfo: () => pageInfo,
		transformSeed: (items) => items.slice(3)
	});
</script>

<!-- The podium stands in a row from xl: its three frames need 62rem, more
     than a 1024px screen holds beside its margins, so narrower ones stack it. -->
<div class="space-y-12">
	<div
		class="mb-16 flex flex-col items-center justify-center gap-8 xl:flex-row xl:items-end xl:gap-10"
	>
		{#each podiumArtworks as entry (`podium-${entry.position}-${entry.artwork?.id ?? 'empty'}`)}
			{@const artwork = entry.artwork}
			{#if artwork}
				{@const position = entry.position}
				{@const meta = podiumMeta[position]}
				{@const frame = frameForArtwork(artwork.id, position)}
				<div class="relative flex flex-col items-center gap-5">
					<div class="podium-award" style={`rotate: ${meta.awardTilt}deg;`}>
						<AwardMark {awardStyle} place={position} />
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
						onkeydown={(event) => signalKeyboardIntent(event, artwork.id)}
						onpointerdown={(event) => signalPointerIntent(event, artwork.id)}
					>
						<div class="h-full transition duration-200 hover:-translate-y-2 hover:scale-105">
							<ArtworkFrame
								{frame}
								className="h-full w-full"
								openingClass="h-full"
								testId={`podium-frame-${position}`}
							>
								<div class="relative h-full w-full">
									<NsfwImage
										src={artwork.imageUrl}
										alt={artwork.title}
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

					<!-- An engraved plate screwed to a walnut block, as a museum labels its prizes. -->
					<div
						class="podium-plaque"
						data-testid={`podium-plaque-${position}`}
						style={`--plate-bg:${meta.plateBg};--plate-ink:${meta.plateInk};--plate-hi:${meta.plateHi};--plate-rule-light:${meta.plateRuleLight};--plate-rule-dark:${meta.plateRuleDark};--screw-light:${meta.screwLight};--screw-dark:${meta.screwDark};--plaque-tilt:${position === 2 ? 0.5 : position === 3 ? -0.4 : -0.7}deg;`}
					>
						<div class="plaque-plate">
							<span class="plaque-screw screw-tl" aria-hidden="true"></span>
							<span class="plaque-screw screw-tr" aria-hidden="true"></span>
							<span class="plaque-screw screw-bl" aria-hidden="true"></span>
							<span class="plaque-screw screw-br" aria-hidden="true"></span>
							<p class="plaque-title">{artwork.title}</p>
							<p class="plaque-artist">{artwork.artist} · {yearOf(artwork)}</p>
							<p class="plaque-place">{meta.label} · ★ {artwork.score}</p>
						</div>
					</div>
				</div>
			{/if}
		{/each}
	</div>

	<div class="w-full">
		<VirtualizedGrid
			bind:this={grid}
			items={accumulator.allArtworks}
			restoredLayout={accumulator.restoredLayout}
			{serverRendered}
		>
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
					onPointerIntent={() => onPrefetch?.(artwork.id)}
				/>
			{/snippet}
		</VirtualizedGrid>
		<ScrollSentinel
			disabled={false}
			error={accumulator.error}
			hasMore={accumulator.hasMore}
			isLoading={accumulator.isLoading}
			onRetry={() => accumulator.retry()}
			skeletonCount={3}
			onTrigger={() => accumulator.loadMore()}
		/>
	</div>
</div>

<style>
	.podium-award {
		margin-bottom: 0.75rem;
	}

	/* The walnut block, its grain running nearly level. */
	.podium-plaque {
		rotate: var(--plaque-tilt, -0.7deg);
		padding: 0.875rem;
		border-radius: 6px;
		background-image:
			repeating-linear-gradient(8deg, rgb(255 255 255 / 0.04) 0 2px, transparent 2px 9px),
			linear-gradient(160deg, #6b4128, #4a2a18 60%, #3a2012);
		box-shadow: 0 8px 16px rgb(30 15 5 / 0.45);
	}

	/* The engraved plate: a bevelled edge and an inner rule, the lettering cut in. */
	.plaque-plate {
		position: relative;
		/* As wide as its title needs, between a label and a plaque's worth. */
		width: max-content;
		min-width: 13.375rem;
		max-width: min(17rem, calc(100vw - 4rem));
		padding: 1rem 1.125rem 0.875rem;
		border-radius: 3px;
		background: var(--plate-bg);
		box-shadow:
			inset 0 0 0 2px var(--plate-rule-light),
			inset 0 0 0 5px var(--plate-rule-dark),
			0 2px 3px rgb(0 0 0 / 0.4);
		text-align: center;
		color: var(--plate-ink);
		text-shadow: 0 1px 0 var(--plate-hi);
	}

	.plaque-screw {
		position: absolute;
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: radial-gradient(circle at 35% 35%, var(--screw-light), var(--screw-dark));
	}

	.screw-tl {
		top: 7px;
		left: 7px;
	}
	.screw-tr {
		top: 7px;
		right: 7px;
	}
	.screw-bl {
		bottom: 7px;
		left: 7px;
	}
	.screw-br {
		right: 7px;
		bottom: 7px;
	}

	.plaque-title {
		margin: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-family: var(--font-display);
		font-size: 0.9375rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.plaque-artist {
		margin: 0.25rem 0 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-family: var(--font-hand);
		font-size: 1.25rem;
		font-weight: 700;
		line-height: 1.1;
	}

	.plaque-place {
		margin: 0.375rem 0 0;
		font-family: var(--font-display);
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.2em;
		text-transform: uppercase;
	}
</style>
