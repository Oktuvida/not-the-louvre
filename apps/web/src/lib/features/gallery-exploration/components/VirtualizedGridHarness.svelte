<script lang="ts">
	import type { Artwork } from '$lib/features/artwork-presentation/model/artwork';
	import VirtualizedGrid from './VirtualizedGrid.svelte';

	interface Props {
		rows: Artwork[][];
	}

	let { rows }: Props = $props();
</script>

<div role="list" style="height: 800px; overflow: auto;">
	<VirtualizedGrid {rows}>
		{#snippet renderCard(artwork)}
			<div role="listitem" data-testid={`grid-card-${artwork.id}`}>
				{artwork.title}
			</div>
		{/snippet}
	</VirtualizedGrid>
</div>
