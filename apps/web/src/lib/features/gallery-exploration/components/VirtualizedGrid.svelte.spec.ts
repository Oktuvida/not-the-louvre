import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import type { Artwork } from '$lib/features/artwork-presentation/model/artwork';
import VirtualizedGridHarness from './VirtualizedGridHarness.svelte';

const createArtwork = (id: string): Artwork => ({
	id,
	title: `Artwork ${id}`,
	artist: 'Test Artist',
	authorId: `user-${id}`,
	imageUrl: `https://example.com/${id}.avif`,
	score: 0,
	upvotes: 0,
	downvotes: 0,
	timestamp: Date.now(),
	isNsfw: false,
	comments: []
});

const createArtworks = (count: number, prefix: string): Artwork[] =>
	Array.from({ length: count }, (_, index) => createArtwork(`${prefix}${index + 1}`));

describe('VirtualizedGrid', () => {
	it('renders rows using WindowVirtualizer with the provided items', async () => {
		render(VirtualizedGridHarness, { items: createArtworks(6, 'a') });

		// Each artwork should be rendered via the renderCard snippet
		const cards = page.getByRole('list').getByRole('listitem');
		await expect.element(cards.nth(0)).toBeVisible();

		// All 6 artworks should be rendered
		const allCards = document.querySelectorAll('[data-testid^="grid-card-"]');
		expect(allCards.length).toBeGreaterThanOrEqual(6);
	});

	it('row wrappers do not clip overflow so hover animations are visible', async () => {
		render(VirtualizedGridHarness, { items: createArtworks(4, 'b') });

		await expect.element(page.getByTestId('grid-card-b1')).toBeVisible();

		const rowElements = document.querySelectorAll('[data-testid="virtualized-row"]');
		expect(rowElements.length).toBeGreaterThan(0);

		const firstRow = rowElements[0] as HTMLElement;
		const style = getComputedStyle(firstRow);

		// content-visibility must NOT be 'auto' — it creates paint containment that clips hover scale animations
		expect(style.contentVisibility).not.toBe('auto');
	});

	it('accepts a renderCard snippet and calls it for each artwork', async () => {
		render(VirtualizedGridHarness, { items: createArtworks(3, 'c') });

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
		render(VirtualizedGridHarness, { items: createArtworks(24, 'd'), minColumnWidth: 100 });

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
});
