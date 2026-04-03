<script lang="ts">
	import type { Artwork } from '$lib/features/artwork-presentation/model/artwork';
	import GameButton from '$lib/features/shared-ui/components/GameButton.svelte';
	import FilmReel from './FilmReel.svelte';

	let {
		adultContentEnabled = false,
		artworks,
		hasMore = false,
		onApplyEviction,
		onRequestMore,
		onSelect
	}: {
		adultContentEnabled?: boolean;
		artworks: Artwork[];
		hasMore?: boolean;
		onApplyEviction?: () => void;
		onRequestMore?: () => void;
		onSelect?: (artwork: Artwork) => void;
	} = $props();

	let filmReel: ReturnType<typeof FilmReel> | undefined = $state();
	let isSpinning = $state(false);

	const handleSpin = () => {
		if (isSpinning) return;
		isSpinning = true;
		filmReel?.spin();
	};

	const handleLand = (artwork: Artwork) => {
		isSpinning = false;

		onSelect?.(artwork);
		setTimeout(() => {
			filmReel?.resetToIdle();
		}, 500);
	};

	const handleIdleCycleComplete = () => {
		// Apply any pending eviction from previous loads first,
		// then request the next page so the pool stays bounded.
		onApplyEviction?.();
		if (hasMore) {
			onRequestMore?.();
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
		{artworks}
		onLand={handleLand}
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
