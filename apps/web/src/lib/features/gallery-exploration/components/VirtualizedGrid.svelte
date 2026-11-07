<script lang="ts" generics="T">
	import { WindowVirtualizer } from 'virtua/svelte';
	import { untrack, type Snippet } from 'svelte';
	import type { CacheSnapshot } from 'virtua';
	import type { GridLayoutSnapshot } from '#lib/features/gallery-exploration/model/grid.js';
	import '../gallery-grid.css';

	interface Props {
		items: T[];
		renderCard: Snippet<[item: T]>;
		/** The layout this grid had when its room was left (see `snapshotLayout`). */
		restoredLayout?: GridLayoutSnapshot | null;
		/**
		 * Whether the page arrived with this grid drawn by the server, so the
		 * plain grid has to hold every card the server drew (see below).
		 */
		serverRendered?: boolean;
	}

	let { items, renderCard, restoredLayout = null, serverRendered = true }: Props = $props();

	/*
	 * The page arrives with the cards in a plain CSS grid (gallery-grid.css),
	 * laid out by the browser before any script runs. Once it is on screen the
	 * grid is measured — how many columns the template resolved to, how far one
	 * row of cards is from the next — and handed to the virtualizer, which takes
	 * over with rows of exactly that size, so the hand-over moves nothing.
	 *
	 * A grid built in the browser (a room walked into) has nothing on screen to
	 * hand over from, so its plain grid draws only the first cards, enough for
	 * a row or two to measure. Drawing the whole feed there only to build it
	 * again in the virtualizer doubled the cost of the room's first frame.
	 */
	const MEASURED_CARDS = 6;
	const plainGridItems = $derived(serverRendered ? items : items.slice(0, MEASURED_CARDS));
	let probeElement = $state<HTMLDivElement>();
	let staticGridElement = $state<HTMLDivElement>();
	let columnCount = $state(0);
	let rowSize = $state<number | undefined>();

	// Rows are kept in the page a screen and a half past the window, above and
	// below. A row's pictures start loading as it mounts, so this is how far
	// ahead of the visitor the wall gets ready: enough that a fast fling over a
	// slow connection still finds the artworks painted.
	const bufferSize = typeof window === 'undefined' ? 600 : Math.round(window.innerHeight * 1.5);

	const readColumnCount = (probe: HTMLElement) =>
		getComputedStyle(probe).gridTemplateColumns.split(' ').filter(Boolean).length;

	/** From one row of cards to the next in the plain grid, gap included. */
	const readRowSize = (grid: HTMLElement | undefined) => {
		const cards = grid ? [...grid.children].filter((child) => child instanceof HTMLElement) : [];
		const first = cards[0];
		if (!grid || !first) return undefined;

		const nextRow = cards.find((card) => card.offsetTop > first.offsetTop + 1);
		// A single row is its cards plus the gap the row ends with.
		return nextRow ? nextRow.offsetTop - first.offsetTop : grid.offsetHeight;
	};

	$effect(() => {
		const probe = probeElement;
		if (!probe) return;

		// Measured once, at the hand-over; the plain grid is gone after it.
		rowSize = readRowSize(untrack(() => staticGridElement));
		columnCount = readColumnCount(probe);

		let frame = 0;
		const observer = new ResizeObserver(() => {
			// A frame later, so the re-chunk never runs inside the observer
			// callback (avoids ResizeObserver loop errors).
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(() => {
				columnCount = readColumnCount(probe);
			});
		});
		observer.observe(probe);

		return () => {
			cancelAnimationFrame(frame);
			observer.disconnect();
		};
	});

	const isMeasured = $derived(columnCount > 0);

	// Each virtualized row holds exactly one visual grid line, so mount and
	// unmount granularity matches what is actually on screen.
	const rows = $derived.by(() => {
		const result: T[][] = [];
		if (!isMeasured) return result;
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
	 * resized) starts from estimates as before. A restored grid skips the plain
	 * one: it would lay out the whole feed only to be replaced.
	 */
	const restoring = (() => restoredLayout !== null)();
	const restoredCache = $derived(
		restoredLayout &&
			restoredLayout.columnCount === columnCount &&
			restoredLayout.rowCount === rows.length
			? restoredLayout.cache
			: undefined
	);

	/*
	 * The virtualizer starts out taking the window to be at the top of the
	 * page, and learns where it is only from the window's scroll events. A
	 * grid put up under a window that is already further down hears none
	 * unless something moves the window afterwards. Turning back before the
	 * next room had been drawn did exactly that: nothing took the window to
	 * the top on the way out, so it was still where the visitor left it, the
	 * scrolls that put a Back in its place had nothing to move, and the grid
	 * drew the rows at the top of its wall while the visitor looked at an
	 * empty stretch further down. Once it is listening, it is told where the
	 * window is.
	 */
	$effect(() => {
		if (virtualizer && window.scrollY > 0) dispatchEvent(new Event('scroll'));
	});

	/** The measured rows, for the room to keep while the visitor is away. */
	export const snapshotLayout = (): GridLayoutSnapshot | null =>
		virtualizer && isMeasured
			? { cache: virtualizer.getCache(), columnCount, rowCount: rows.length }
			: null;
</script>

<div class="gallery-grid-host">
	<div bind:this={probeElement} class="gallery-grid gallery-grid-probe" aria-hidden="true"></div>
	{#if isMeasured}
		<WindowVirtualizer
			bind:this={virtualizer}
			data={rows}
			getKey={rowKey}
			{bufferSize}
			itemSize={rowSize}
			cache={restoredCache}
		>
			{#snippet children(row)}
				<div
					data-testid="virtualized-row"
					class="gallery-grid gallery-grid-row"
					style:grid-template-columns={`repeat(${columnCount}, minmax(0, 1fr))`}
				>
					{#each row as item (itemKey(item))}
						{@render renderCard(item)}
					{/each}
				</div>
			{/snippet}
		</WindowVirtualizer>
	{:else if !restoring}
		<div bind:this={staticGridElement} class="gallery-grid gallery-grid-row">
			{#each plainGridItems as item (itemKey(item))}
				{@render renderCard(item)}
			{/each}
		</div>
	{/if}
</div>
