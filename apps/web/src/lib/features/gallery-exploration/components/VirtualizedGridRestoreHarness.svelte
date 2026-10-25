<script lang="ts">
	import type { Artwork } from '#lib/features/artwork-presentation/model/artwork.js';
	import type { GridLayoutSnapshot } from '#lib/features/gallery-exploration/model/grid.js';
	import VirtualizedGrid from './VirtualizedGrid.svelte';

	interface Props {
		items: Artwork[];
		onGrid?: (grid: { snapshotLayout(): GridLayoutSnapshot | null }) => void;
		restoredLayout?: GridLayoutSnapshot | null;
	}

	let { items, onGrid, restoredLayout = null }: Props = $props();
	let grid = $state<{ snapshotLayout(): GridLayoutSnapshot | null }>();

	$effect(() => {
		if (grid) onGrid?.(grid);
	});

	// Rows of very different heights, so a layout estimated from a few
	// measured rows puts every later row somewhere else.
	const heightOf = (artwork: Artwork) => 120 + (items.indexOf(artwork) % 5) * 90;
</script>

<VirtualizedGrid bind:this={grid} {items} minColumnWidth={180} {restoredLayout}>
	{#snippet renderCard(artwork)}
		<div data-testid={`grid-card-${artwork.id}`} style:height={`${heightOf(artwork)}px`}>
			{artwork.title}
		</div>
	{/snippet}
</VirtualizedGrid>
