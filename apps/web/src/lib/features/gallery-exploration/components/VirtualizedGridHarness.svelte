<script lang="ts">
	import type { Artwork } from '#lib/features/artwork-presentation/model/artwork.js';
	import VirtualizedGrid from './VirtualizedGrid.svelte';

	interface Props {
		items: Artwork[];
		/** Called each time a card is built, so a spec can count them. */
		onCardBuilt?: () => void;
		serverRendered?: boolean;
	}

	let { items, onCardBuilt, serverRendered }: Props = $props();

	const built = () => {
		onCardBuilt?.();
	};
</script>

<div role="list" style="height: 800px; overflow: auto;">
	<VirtualizedGrid {items} {serverRendered}>
		{#snippet renderCard(artwork)}
			<div role="listitem" data-testid={`grid-card-${artwork.id}`} {@attach built}>
				{artwork.title}
			</div>
		{/snippet}
	</VirtualizedGrid>
</div>
