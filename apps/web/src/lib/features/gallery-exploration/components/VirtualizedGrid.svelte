<script lang="ts" generics="T">
	import { WindowVirtualizer } from 'virtua/svelte';
	import type { Snippet } from 'svelte';

	interface Props {
		rows: T[][];
		renderCard: Snippet<[item: T]>;
		gap?: string;
	}

	let { rows, renderCard, gap = '3rem' }: Props = $props();
</script>

<WindowVirtualizer data={rows}>
	{#snippet children(row)}
		<div
			data-testid="virtualized-row"
			class="virtualized-row"
			style:--grid-gap={gap}
			style:content-visibility="auto"
			style:contain-intrinsic-size="auto 250px"
		>
			{#each row as item (typeof item === 'object' && item !== null && 'id' in item ? (item as Record<string, unknown>).id : item)}
				{@render renderCard(item)}
			{/each}
		</div>
	{/snippet}
</WindowVirtualizer>

<style>
	.virtualized-row {
		display: grid;
		grid-template-columns: repeat(1, 1fr);
		gap: var(--grid-gap, 3rem);
		padding-bottom: var(--grid-gap, 3rem);
	}

	@media (min-width: 768px) {
		.virtualized-row {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	@media (min-width: 1024px) {
		.virtualized-row {
			grid-template-columns: repeat(3, 1fr);
		}
	}
</style>
