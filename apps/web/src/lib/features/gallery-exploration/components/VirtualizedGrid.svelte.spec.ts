import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import VirtualizedGridHarness from './VirtualizedGridHarness.svelte';

const createArtwork = (id: string) => ({
	id,
	title: `Artwork ${id}`,
	artist: 'Test Artist',
	imageUrl: `https://example.com/${id}.avif`,
	score: 0,
	upvotes: 0,
	downvotes: 0,
	timestamp: Date.now(),
	isNsfw: false,
	comments: []
});

describe('VirtualizedGrid', () => {
	it('renders rows using WindowVirtualizer with the provided items', async () => {
		const rows = [
			[createArtwork('a1'), createArtwork('a2'), createArtwork('a3')],
			[createArtwork('a4'), createArtwork('a5'), createArtwork('a6')]
		];

		render(VirtualizedGridHarness, { rows });

		// Each artwork should be rendered via the renderCard snippet
		const cards = page.getByRole('list').getByRole('listitem');
		await expect.element(cards.nth(0)).toBeVisible();

		// All 6 artworks should be rendered
		const allCards = document.querySelectorAll('[data-testid^="grid-card-"]');
		expect(allCards.length).toBeGreaterThanOrEqual(6);
	});

	it('row wrappers do not clip overflow so hover animations are visible', async () => {
		const rows = [
			[createArtwork('b1'), createArtwork('b2')],
			[createArtwork('b3'), createArtwork('b4')]
		];

		render(VirtualizedGridHarness, { rows });

		await expect.element(page.getByTestId('grid-card-b1')).toBeVisible();

		const rowElements = document.querySelectorAll('[data-testid="virtualized-row"]');
		expect(rowElements.length).toBeGreaterThan(0);

		const firstRow = rowElements[0] as HTMLElement;
		const style = getComputedStyle(firstRow);

		// content-visibility must NOT be 'auto' — it creates paint containment that clips hover scale animations
		expect(style.contentVisibility).not.toBe('auto');
	});

	it('accepts a renderCard snippet and calls it for each artwork in each row', async () => {
		const rows = [[createArtwork('c1'), createArtwork('c2')], [createArtwork('c3')]];

		render(VirtualizedGridHarness, { rows });

		// Harness renders each artwork with a data-testid
		await expect.element(page.getByTestId('grid-card-c1')).toBeVisible();
		await expect.element(page.getByTestId('grid-card-c2')).toBeVisible();
		await expect.element(page.getByTestId('grid-card-c3')).toBeVisible();

		// Verify each card shows the artwork title
		expect(page.getByTestId('grid-card-c1').element().textContent).toContain('Artwork c1');
		expect(page.getByTestId('grid-card-c2').element().textContent).toContain('Artwork c2');
		expect(page.getByTestId('grid-card-c3').element().textContent).toContain('Artwork c3');
	});
});
