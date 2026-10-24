<script lang="ts" generics="T">
	import { WindowVirtualizer } from 'virtua/svelte';
	import type { Snippet } from 'svelte';
	import type { CacheSnapshot } from 'virtua';
	import {
		GALLERY_GRID_GAP,
		GALLERY_GRID_MIN_COLUMN_WIDTH,
		type GridLayoutSnapshot
	} from '#lib/features/gallery-exploration/model/grid.js';

	interface Props {
		items: T[];
		renderCard: Snippet<[item: T]>;
		/** Grid gap in pixels (also used as row spacing). */
		gap?: number;
		/** Minimum column width in pixels, mirroring the CSS auto-fill behavior. */
		minColumnWidth?: number;
		/** The layout this grid had when its room was left (see `snapshotLayout`). */
		restoredLayout?: GridLayoutSnapshot | null;
	}

	let {
		items,
		renderCard,
		gap = GALLERY_GRID_GAP,
		minColumnWidth = GALLERY_GRID_MIN_COLUMN_WIDTH,
		restoredLayout = null
	}: Props = $props();

	// Before the container is measured (SSR / first paint) we fall back to
	// auto-fill CSS columns so the server-rendered layout stays correct.
	const SSR_FALLBACK_CHUNK = 6;

	let containerElement = $state<HTMLDivElement>();
	let containerWidth = $state(0);

	$effect(() => {
		const element = containerElement;
		if (!element) return;

		containerWidth = element.clientWidth;

		let frame = 0;
		const observer = new ResizeObserver((entries) => {
			const width = entries[entries.length - 1]?.contentRect.width;
			if (width === undefined) return;
			// Defer the write a frame so the re-chunk layout change never runs
			// inside the observer callback (avoids ResizeObserver loop errors).
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(() => {
				containerWidth = Math.floor(width);
			});
		});
		observer.observe(element);

		return () => {
			cancelAnimationFrame(frame);
			observer.disconnect();
		};
	});

	const isMeasured = $derived(containerWidth > 0);
	const columnCount = $derived(
		isMeasured
			? Math.max(1, Math.floor((containerWidth + gap) / (minColumnWidth + gap)))
			: SSR_FALLBACK_CHUNK
	);

	// Each virtualized row holds exactly one visual grid line, so mount and
	// unmount granularity matches what is actually on screen.
	const rows = $derived.by(() => {
		const result: T[][] = [];
		for (let index = 0; index < items.length; index += columnCount) {
			result.push(items.slice(index, index + columnCount));
		}
		return result;
	});

	const itemKey = (item: T): unknown =>
		typeof item === 'object' && item !== null && 'id' in item
			? (item as Record<string, unknown>).id
			: item;

	const rowKey = (row: T[], index: number): string | number => {
		const first = row[0];
		const key = first === undefined ? undefined : itemKey(first);
		return typeof key === 'string' || typeof key === 'number' ? key : index;
	};

	let virtualizer = $state<{ getCache(): CacheSnapshot }>();

	/*
	 * Coming back to a room, the virtualizer is handed the row sizes it had
	 * measured. Without them it estimates every row it has not seen yet, so the
	 * saved scroll offset lands on another card. The cache is read once, on
	 * mount, and describes rows of a given width: the virtualizer waits for the
	 * real column count, and a grid that now chunks differently (the window was
	 * resized) starts from estimates as before.
	 */
	const restoring = (() => restoredLayout !== null)();
	const restoredCache = $derived(
		restoredLayout &&
			restoredLayout.columnCount === columnCount &&
			restoredLayout.rowCount === rows.length
			? restoredLayout.cache
			: undefined
	);

	/** The measured rows, for the room to keep while the visitor is away. */
	export const snapshotLayout = (): GridLayoutSnapshot | null =>
		virtualizer && isMeasured
			? { cache: virtualizer.getCache(), columnCount, rowCount: rows.length }
			: null;

	const gridTemplateColumns = $derived(
		isMeasured
			? `repeat(${columnCount}, minmax(0, 1fr))`
			: `repeat(auto-fill, minmax(${minColumnWidth}px, 1fr))`
	);
</script>

<div bind:this={containerElement}>
	{#if !restoring || isMeasured}
		<WindowVirtualizer
			bind:this={virtualizer}
			data={rows}
			getKey={rowKey}
			bufferSize={600}
			cache={restoredCache}
		>
			{#snippet children(row)}
				<div
					data-testid="virtualized-row"
					class="virtualized-row"
					style:grid-template-columns={gridTemplateColumns}
					style:--grid-gap={`${gap}px`}
				>
					{#each row as item (itemKey(item))}
						{@render renderCard(item)}
					{/each}
				</div>
			{/snippet}
		</WindowVirtualizer>
	{/if}
</div>

<style>
	.virtualized-row {
		display: grid;
		gap: var(--grid-gap, 3rem);
		padding-bottom: var(--grid-gap, 3rem);
	}
</style>
