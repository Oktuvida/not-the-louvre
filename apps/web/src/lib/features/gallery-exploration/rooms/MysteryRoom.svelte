<script lang="ts">
	import type { Artwork } from '$lib/features/artwork-presentation/model/artwork';
	import GameButton from '$lib/features/shared-ui/components/GameButton.svelte';
	import { untrack } from 'svelte';
	import { createStreamingAccumulator } from '../streaming-accumulator.svelte';
	import FilmReel from './FilmReel.svelte';

	let {
		adultContentEnabled = false,
		artworks,
		pageInfo,
		loadMoreArtworks,
		fetchRandomArtwork,
		onSelect
	}: {
		adultContentEnabled?: boolean;
		artworks: Artwork[];
		pageInfo: { hasMore: boolean; nextCursor: string | null };
		loadMoreArtworks?: (request: { cursor: string }) => Promise<{
			artworks: Artwork[];
			pageInfo: { hasMore: boolean; nextCursor: string | null };
		}>;
		fetchRandomArtwork?: () => Promise<Artwork>;
		onSelect?: (artwork: Artwork) => void;
	} = $props();

	// Snapshot initial values to avoid reactive re-seeding
	const { initialArtworks, initialPageInfo } = (() => ({
		initialArtworks: $state.snapshot(artworks),
		initialPageInfo: $state.snapshot(pageInfo)
	}))();

	const accumulator = createStreamingAccumulator({
		initialArtworks,
		initialPageInfo,
		fetchPage: async (cursor: string) => {
			if (!loadMoreArtworks) {
				return { artworks: [], pageInfo: { hasMore: false, nextCursor: null } };
			}
			return loadMoreArtworks({ cursor });
		}
	});

	const seedIdentity = (items: Artwork[]) => items.map((artwork) => artwork.id).join(',');
	let lastSeedIdentity = seedIdentity(initialArtworks);

	$effect(() => {
		const identity = seedIdentity(artworks);
		if (identity !== lastSeedIdentity) {
			lastSeedIdentity = identity;
			untrack(() => {
				accumulator.reseed(artworks, pageInfo);
			});
			return;
		}

		untrack(() => {
			accumulator.syncSeedArtworks(artworks);
		});
	});

	let filmReel: ReturnType<typeof FilmReel> | undefined = $state();
	let isSpinning = $state(false);

	const LOAD_MORE_THRESHOLD = 0.8;

	const handleSpin = async () => {
		if (isSpinning || !fetchRandomArtwork) return;
		isSpinning = true;

		try {
			const artwork = await fetchRandomArtwork();
			filmReel?.spinToArtwork(artwork);
		} catch {
			// Spin failed — re-enable the button and keep idle
			isSpinning = false;
		}
	};

	const handleLand = (artwork: Artwork) => {
		isSpinning = false;

		onSelect?.(artwork);
		setTimeout(() => {
			filmReel?.resetToIdle();
		}, 500);
	};

	const handleIdleProgress = (fraction: number) => {
		accumulator.setProgress(fraction);

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
	/>

	<GameButton
		type="button"
		variant="danger"
		size="hero"
		className="w-full max-w-[16rem] justify-center shadow-2xl md:max-w-none"
		disabled={isSpinning}
		onclick={handleSpin}
	>
		<span>{isSpinning ? 'SPINNING...' : 'Spin!'}</span>
	</GameButton>

	<div
		class="pointer-events-none absolute -bottom-4 left-1/2 z-20 w-full max-w-[16rem] -translate-x-1/2 text-center text-xs text-[#f7eadf] italic transition-all duration-700 ease-[cubic-bezier(0.4,0,1,1)] md:-bottom-7 md:max-w-none md:text-sm"
		style="font-family: 'Baloo 2', sans-serif; letter-spacing: 0.01em; text-shadow: 0 1px 1px rgba(45,36,32,.7), 0 2px 8px rgba(45,36,32,.35);"
	>
		Discover a random masterpiece... hopefully
	</div>
</div>
