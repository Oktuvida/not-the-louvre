<script lang="ts">
	import type { Artwork } from '$lib/features/artwork-presentation/model/artwork';
	import GameButton from '$lib/features/shared-ui/components/GameButton.svelte';
	import FilmReel from './FilmReel.svelte';

	let {
		adultContentEnabled = false,
		artworks,
		onSelect
	}: {
		adultContentEnabled?: boolean;
		artworks: Artwork[];
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
</script>

<div class="flex min-h-[400px] flex-col items-center justify-center gap-16 py-8 pt-55">
	<FilmReel bind:this={filmReel} {adultContentEnabled} {artworks} onLand={handleLand} />

	<GameButton
		type="button"
		variant="danger"
		size="hero"
		className="shadow-2xl"
		disabled={isSpinning}
		onclick={handleSpin}
	>
		<span>{isSpinning ? 'SPINNING...' : 'Spin!'}</span>
	</GameButton>

	<div
		class="pointer-events-none absolute -bottom-7 left-1/2 z-20 -translate-x-1/2 text-sm text-[#f7eadf] italic transition-all duration-700 ease-[cubic-bezier(0.4,0,1,1)]"
		style="font-family: 'Baloo 2', sans-serif; letter-spacing: 0.01em; text-shadow: 0 1px 1px rgba(45,36,32,.7), 0 2px 8px rgba(45,36,32,.35);"
	>
		Discover a random masterpiece... hopefully
	</div>
</div>
