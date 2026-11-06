<script lang="ts">
	import type { Artwork } from '#lib/features/artwork-presentation/model/artwork.js';
	import type { GridLayoutSnapshot } from '#lib/features/gallery-exploration/model/grid.js';
	import VirtualizedGridRestoreHarness from './VirtualizedGridRestoreHarness.svelte';

	interface Props {
		items: Artwork[];
		onGrid?: (grid: { snapshotLayout(): GridLayoutSnapshot | null }) => void;
		/** How tall the page stays while one copy of the grid makes way for the next. */
		pageHeight?: number;
		restoredLayout?: GridLayoutSnapshot | null;
		/** Each visit puts a new copy of the grid up, as each arrival in a room does. */
		visit?: number;
	}

	let { items, onGrid, pageHeight = 0, restoredLayout = null, visit = 0 }: Props = $props();
</script>

<!-- The page around the grid keeps its height across the swap, so nothing moves
     the window: it stays where the visitor left it. -->
<div style:min-height={`${pageHeight}px`}>
	{#key visit}
		<VirtualizedGridRestoreHarness {items} {onGrid} {restoredLayout} />
	{/key}
</div>
