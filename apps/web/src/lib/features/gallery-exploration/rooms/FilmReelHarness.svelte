<script lang="ts">
	import type { Artwork } from '$lib/features/artwork-presentation/model/artwork';
	import FilmReel from './FilmReel.svelte';

	interface Props {
		artworks: Artwork[];
		adultContentEnabled?: boolean;
		onLand?: (artwork: Artwork) => void;
		onIdleCycleComplete?: () => void;
		onIdleProgress?: (fraction: number) => void;
	}

	let {
		artworks,
		adultContentEnabled = false,
		onLand = () => {},
		onIdleCycleComplete,
		onIdleProgress
	}: Props = $props();

	let filmReel: ReturnType<typeof FilmReel> | undefined = $state();
</script>

<div style="width: 800px; height: 400px;">
	<FilmReel
		bind:this={filmReel}
		{adultContentEnabled}
		{artworks}
		{onLand}
		{onIdleCycleComplete}
		{onIdleProgress}
	/>
</div>
