<script lang="ts">
	import type { Artwork } from '#lib/features/artwork-presentation/model/artwork.js';
	import PolaroidCard from '#lib/features/shared-ui/components/PolaroidCard.svelte';

	let {
		adultContentEnabled = false,
		artwork,
		onPrefetch,
		onSelect,
		viewerId = null
	}: {
		adultContentEnabled?: boolean;
		artwork: Artwork;
		onPrefetch?: (artworkId: string) => void;
		onSelect: (artwork: Artwork) => void;
		viewerId?: string | null;
	} = $props();
</script>

<!-- The piece the wall grew from, pinned above it like any other polaroid. -->
<aside class="forks-head" aria-label={`Forks of ${artwork.title}`}>
	<PolaroidCard
		{artwork}
		{viewerId}
		{adultContentEnabled}
		pencilNote="the original"
		imageLoading="eager"
		onclick={() => onSelect(artwork)}
		onPointerIntent={() => onPrefetch?.(artwork.id)}
	/>
	<p class="forks-head-slip">and what came of it</p>
</aside>

<style>
	.forks-head {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.1rem;
		width: min(19rem, 100%);
	}

	/* Pencilled on a slip of paper, as the Mystery Room's line is. */
	.forks-head-slip {
		margin: 0;
		padding: 0.3rem 0.85rem 0.35rem;
		rotate: -1deg;
		background: #fffdf8;
		box-shadow:
			0 1px 1px rgb(0 0 0 / 0.1),
			0 4px 10px rgb(40 25 10 / 0.25);
		color: #5a4a3c;
		font-family: var(--font-hand);
		font-size: 1.15rem;
		font-weight: 500;
		line-height: 1.2;
	}
</style>
