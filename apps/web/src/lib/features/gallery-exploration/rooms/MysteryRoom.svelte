<script lang="ts">
	import type { Artwork } from '$lib/features/artwork-presentation/model/artwork';
	import GameButton from '$lib/features/shared-ui/components/GameButton.svelte';
	import type {
		GalleryPageInfo,
		LoadMoreArtworks
	} from '$lib/features/gallery-exploration/model/discovery';
	import type { GalleryRoomId } from '$lib/features/gallery-exploration/model/rooms';
	import { createSeededAccumulator } from '$lib/features/gallery-exploration/use-seeded-accumulator.svelte';
	import type { Writable } from 'svelte/store';
	import FilmReel from './FilmReel.svelte';

	let {
		adultContentEnabled = false,
		artworks,
		feedCacheKey = null,
		pageInfo,
		loadMoreArtworks,
		fetchRandomArtwork,
		onSelect,
		revealedArtworkIds,
		viewerId = null
	}: {
		adultContentEnabled?: boolean;
		artworks: Artwork[];
		feedCacheKey?: GalleryRoomId | null;
		pageInfo: GalleryPageInfo;
		loadMoreArtworks?: LoadMoreArtworks;
		fetchRandomArtwork?: () => Promise<Artwork>;
		onSelect?: (artwork: Artwork) => void;
		revealedArtworkIds?: Writable<Set<string>>;
		viewerId?: string | null;
	} = $props();

	const accumulator = createSeededAccumulator({
		// A cursor-only change must not reseed the pool: the reel would restart
		// mid-cycle.
		emptyPageWhenUnavailable: true,
		getFeedCacheKey: () => feedCacheKey,
		getArtworks: () => artworks,
		getLoadMoreArtworks: () => loadMoreArtworks,
		getPageInfo: () => pageInfo,
		// The reel is centred in its own shell; there is nothing to scroll back to.
		restoreScroll: false,
		watchPageInfo: false
	});

	let filmReel: ReturnType<typeof FilmReel> | undefined = $state();
	let isSpinning = $state(false);
	let spinErrorMessage = $state<string | null>(null);
	let resetToIdleTimer: ReturnType<typeof setTimeout> | null = null;

	const LOAD_MORE_THRESHOLD = 0.8;
	// The room's own voice: the visitor does not care that a fetch rejected.
	const SPIN_FAILURE_MESSAGE = 'That spin came up empty — give it another go.';

	const handleSpin = async () => {
		if (isSpinning || !fetchRandomArtwork) return;
		isSpinning = true;
		spinErrorMessage = null;

		/*
		 * The reel leaves on the click and the fetch retargets it when it
		 * lands. Waiting for the round trip first left the button disabled over
		 * a completely still reel, which reads as a broken control on any
		 * connection slower than localhost.
		 */
		void filmReel?.startFreeSpin();

		try {
			const artwork = await fetchRandomArtwork();
			// The reel refuses an artwork it cannot place; without this the room
			// would sit disabled over a run-up that never lands.
			if (filmReel?.spinToArtwork(artwork) === false) {
				throw new Error(SPIN_FAILURE_MESSAGE);
			}
		} catch {
			filmReel?.cancelFreeSpin();
			spinErrorMessage = SPIN_FAILURE_MESSAGE;
			isSpinning = false;
		}
	};

	const handleLand = (artwork: Artwork) => {
		isSpinning = false;

		onSelect?.(artwork);
		if (resetToIdleTimer !== null) clearTimeout(resetToIdleTimer);
		resetToIdleTimer = setTimeout(() => {
			resetToIdleTimer = null;
			filmReel?.resetToIdle();
		}, 500);
	};

	const handleIdleProgress = (fraction: number) => {
		if (fraction >= LOAD_MORE_THRESHOLD && accumulator.hasMore && !accumulator.isLoading) {
			accumulator.loadMore();
		}
	};

	const handleIdleCycleComplete = () => {
		// Cycle completed — load more if available
		if (accumulator.hasMore && !accumulator.isLoading) {
			accumulator.loadMore();
		}
	};

	// Destroy-only: nothing should still be waiting to touch the reel after the
	// room is gone.
	$effect(() => () => {
		if (resetToIdleTimer !== null) {
			clearTimeout(resetToIdleTimer);
			resetToIdleTimer = null;
		}
	});
</script>

<div
	class="relative flex min-h-[320px] flex-col items-center justify-center gap-8 px-2 py-6 pt-28 md:min-h-[400px] md:gap-16 md:px-0 md:py-8 md:pt-55"
	data-testid="mystery-room"
>
	<FilmReel
		bind:this={filmReel}
		{adultContentEnabled}
		artworks={accumulator.allArtworks}
		onLand={handleLand}
		onIdleProgress={handleIdleProgress}
		onIdleCycleComplete={handleIdleCycleComplete}
		{revealedArtworkIds}
		{viewerId}
	/>

	<GameButton
		type="button"
		variant="danger"
		size="hero"
		className="w-full max-w-[16rem] justify-center shadow-2xl md:max-w-none"
		disabled={isSpinning}
		onclick={handleSpin}
	>
		<span>{isSpinning ? 'SPINNING…' : 'Spin!'}</span>
	</GameButton>

	{#if spinErrorMessage}
		<p class="spin-error" data-testid="mystery-spin-error" role="alert">
			{spinErrorMessage}
		</p>
	{/if}

	<div
		class="pointer-events-none absolute -bottom-4 left-1/2 z-20 w-full max-w-[16rem] -translate-x-1/2 text-center text-xs text-[#f7eadf] italic transition-all duration-700 ease-[cubic-bezier(0.4,0,1,1)] md:-bottom-7 md:max-w-none md:text-sm"
		style="font-family: 'Baloo 2', sans-serif; letter-spacing: 0.01em; text-shadow: 0 1px 1px rgba(45,36,32,.7), 0 2px 8px rgba(45,36,32,.35);"
	>
		Discover a random masterpiece… hopefully
	</div>
</div>

<style>
	/* Paper-on-wall, like the room's other copy — a failure on the dark museum
	 * wall still has to be readable. */
	.spin-error {
		max-width: 22rem;
		text-align: center;
		font-size: 0.8125rem;
		font-weight: 600;
		color: #f7c8b8;
		text-shadow: 0 1px 2px rgba(45, 36, 32, 0.6);
	}
</style>
