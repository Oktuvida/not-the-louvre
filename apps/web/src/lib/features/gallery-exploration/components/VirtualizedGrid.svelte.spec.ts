import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import { makeArtworks } from '#lib/features/gallery-exploration/fixtures/artworks.js';
import VirtualizedGridHarness from './VirtualizedGridHarness.svelte';
import VirtualizedGridRestoreHarness from './VirtualizedGridRestoreHarness.svelte';
import type { GridLayoutSnapshot } from '#lib/features/gallery-exploration/model/grid.js';

const createArtworks = (count: number, prefix: string) => makeArtworks(count, { prefix });

describe('VirtualizedGrid', () => {
	it('renders rows using WindowVirtualizer with the provided items', async () => {
		await render(VirtualizedGridHarness, { items: createArtworks(6, 'a') });

		// Each artwork should be rendered via the renderCard snippet
		const cards = page.getByRole('list').getByRole('listitem');
		await expect.element(cards.nth(0)).toBeVisible();

		// All 6 artworks should be rendered
		const allCards = document.querySelectorAll('[data-testid^="grid-card-"]');
		expect(allCards.length).toBeGreaterThanOrEqual(6);
	});

	it('row wrappers do not clip overflow so hover animations are visible', async () => {
		await render(VirtualizedGridHarness, { items: createArtworks(4, 'b') });

		await expect.element(page.getByTestId('grid-card-b1')).toBeVisible();

		const rowElements = document.querySelectorAll('[data-testid="virtualized-row"]');
		expect(rowElements.length).toBeGreaterThan(0);

		const firstRow = rowElements[0] as HTMLElement;
		const style = getComputedStyle(firstRow);

		// content-visibility must NOT be 'auto' — it creates paint containment that clips hover scale animations
		expect(style.contentVisibility).not.toBe('auto');
	});

	it('accepts a renderCard snippet and calls it for each artwork', async () => {
		await render(VirtualizedGridHarness, { items: createArtworks(3, 'c') });

		// Harness renders each artwork with a data-testid
		await expect.element(page.getByTestId('grid-card-c1')).toBeVisible();
		await expect.element(page.getByTestId('grid-card-c2')).toBeVisible();
		await expect.element(page.getByTestId('grid-card-c3')).toBeVisible();

		// Verify each card shows the artwork title
		expect(page.getByTestId('grid-card-c1').element().textContent).toContain('Artwork c1');
		expect(page.getByTestId('grid-card-c2').element().textContent).toContain('Artwork c2');
		expect(page.getByTestId('grid-card-c3').element().textContent).toContain('Artwork c3');
	});

	it('chunks rows to match the real column count for the measured width', async () => {
		// Harness viewport defaults to the test browser width; force a narrow
		// minColumnWidth so multiple columns fit deterministically.
		await render(VirtualizedGridHarness, { items: createArtworks(24, 'd'), minColumnWidth: 100 });

		await expect.element(page.getByTestId('grid-card-d1')).toBeVisible();

		// Width measurement lands asynchronously via bind:clientWidth, so poll
		// until the explicit column template replaces the auto-fill fallback.
		await vi.waitFor(() => {
			const firstRow = document.querySelector('[data-testid="virtualized-row"]') as HTMLElement;
			// CSSOM serializes `minmax(0, 1fr)` back as `minmax(0px, 1fr)`
			const match = /^repeat\((\d+), minmax\(0(?:px)?, 1fr\)\)$/.exec(
				firstRow.style.gridTemplateColumns
			);
			expect(match).not.toBeNull();

			const columnCount = Number(match![1]);
			expect(columnCount).toBeGreaterThanOrEqual(1);
			// Every full row must hold exactly columnCount cards
			expect(firstRow.querySelectorAll('[data-testid^="grid-card-"]')).toHaveLength(columnCount);
		});
	});

	it('mounted again with the layout it had, shows the same card in the same place', async () => {
		const items = createArtworks(120, 'r');
		let grid: { snapshotLayout(): GridLayoutSnapshot | null } | undefined;
		const card = () => document.querySelector<HTMLElement>('[data-testid="grid-card-r100"]');

		const first = await render(VirtualizedGridRestoreHarness, {
			items,
			onGrid: (handle: NonNullable<typeof grid>) => (grid = handle)
		});
		// Scroll down through the grid the way a visitor would, so every row on
		// the way gets measured, until the card is on screen.
		await vi.waitFor(
			() => {
				window.scrollBy(0, 300);
				const top = card()?.getBoundingClientRect().top;
				expect(top !== undefined && top > 0 && top < window.innerHeight / 2).toBe(true);
			},
			{ interval: 30, timeout: 10_000 }
		);
		const leftAt = { scrollY: window.scrollY, top: card()!.getBoundingClientRect().top };
		const layout = grid!.snapshotLayout();
		expect(layout).not.toBeNull();

		await first.unmount();
		window.scrollTo(0, 0);
		await render(VirtualizedGridRestoreHarness, { items, restoredLayout: layout });
		await vi.waitFor(() => {
			window.scrollTo(0, leftAt.scrollY);
			expect(window.scrollY).toBe(leftAt.scrollY);
		});

		await vi.waitFor(() => {
			expect(Math.abs(card()!.getBoundingClientRect().top - leftAt.top)).toBeLessThan(2);
		});
	});
});
