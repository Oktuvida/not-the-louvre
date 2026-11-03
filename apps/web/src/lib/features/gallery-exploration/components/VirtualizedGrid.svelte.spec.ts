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

	it('has the rows a screen and a half below the window already in the page', async () => {
		// One column (the test window is phone-sized) of many rows, far taller
		// than the window.
		await render(VirtualizedGridHarness, { items: createArtworks(300, 'buffer') });
		await expect.element(page.getByTestId('grid-card-buffer1')).toBeVisible();

		// Their pictures start loading as soon as their rows are in the page, so
		// that is how far ahead of the visitor the wall gets ready.
		await vi.waitFor(() => {
			const rows = [...document.querySelectorAll('[data-testid="virtualized-row"]')];
			const lowestRow = Math.max(...rows.map((row) => row.getBoundingClientRect().bottom));
			expect(lowestRow).toBeGreaterThanOrEqual(window.innerHeight * 2.5);
		});
	});

	// A room walked into in the browser has no server-drawn grid to hand over
	// from. Drawing the whole feed in the plain grid only to measure it, and
	// then building it all again in the virtual one, doubled the cost of the
	// room's first frame.
	it('walked into in the browser, builds only the cards its rows need', async () => {
		let cardsBuilt = 0;
		await render(VirtualizedGridHarness, {
			items: createArtworks(300, 'walk'),
			onCardBuilt: () => {
				cardsBuilt += 1;
			},
			serverRendered: false
		});
		await expect.element(page.getByTestId('grid-card-walk1')).toBeVisible();

		const cardsInRows = document.querySelectorAll(
			'[data-testid="virtualized-row"] [data-testid^="grid-card-"]'
		).length;
		// The rows on screen and in the buffer, and a row of the plain grid to
		// measure them by.
		expect(cardsBuilt).toBeLessThanOrEqual(cardsInRows + 6);
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

	it('on a phone, one card per row', async () => {
		// The test window is phone-sized; gallery-scale.e2e.ts checks the wider
		// screens at their real sizes.
		await render(VirtualizedGridHarness, { items: createArtworks(24, 'd') });

		await vi.waitFor(() => {
			const rows = [...document.querySelectorAll('[data-testid="virtualized-row"]')].map(
				(row) => row.querySelectorAll('[data-testid^="grid-card-"]').length
			);
			expect(rows.length).toBeGreaterThan(1);
			expect(rows.every((count) => count === 1)).toBe(true);
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
