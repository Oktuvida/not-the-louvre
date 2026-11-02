import { page } from 'vitest/browser';
import { createRawSnippet } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import WashiTape from './WashiTape.svelte';

const tapeLabel = (text: string) =>
	createRawSnippet<[]>(() => ({ render: () => `<span>${text}</span>` }));

const tape = () => document.querySelector<HTMLButtonElement>('.washi-tape');

describe('WashiTape', () => {
	it('is a control, named by what is written on it', async () => {
		await render(WashiTape, { children: tapeLabel('Close') });

		const control = page.getByRole('button', { name: 'Close' });
		await expect.element(control).toBeVisible();
		await expect.element(control).toHaveAttribute('type', 'button');
	});

	it('is stuck on crooked, at the angle the call site asks for', async () => {
		const { rerender } = await render(WashiTape, { children: tapeLabel('Close') });

		// Both close buttons share the default; the detail panel's chips are
		// stuck on at other angles, so it is a prop rather than a second rule.
		expect(getComputedStyle(tape() as HTMLElement).rotate).toBe('2.4deg');

		await rerender({ children: tapeLabel('Close'), rotate: '-2deg' });
		expect(getComputedStyle(tape() as HTMLElement).rotate).toBe('-2deg');
	});

	it('behaves like the button it is', async () => {
		const onclick = vi.fn();

		await render(WashiTape, { children: tapeLabel('Close'), class: 'ml-2', onclick });

		await page.getByRole('button', { name: 'Close' }).click();

		expect(onclick).toHaveBeenCalledTimes(1);
		expect([...(tape()?.classList ?? [])]).toEqual(expect.arrayContaining(['washi-tape', 'ml-2']));
	});
});
