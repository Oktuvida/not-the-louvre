import { page } from 'vitest/browser';
import { createRawSnippet } from 'svelte';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
// The paper lives in the global stylesheet, which the browser project does not
// load for a component under test. Importing it is what lets this spec assert
// the material itself instead of the class names that stand for it.
import '../../../../routes/layout.css';
import PaperSheet from './PaperSheet.svelte';

const sheetContent = (text: string) =>
	createRawSnippet<[]>(() => ({ render: () => `<p>${text}</p>` }));

const sheet = () => document.querySelector<HTMLElement>('.paper-sheet');

describe('PaperSheet', () => {
	it('paints the one paper the whole museum is printed on', async () => {
		await render(PaperSheet, { children: sheetContent('Studio access') });

		await expect.element(page.getByText('Studio access')).toBeVisible();

		const element = sheet();
		expect(element).not.toBeNull();

		// These three declarations are the drift the primitive exists to stop:
		// the tool tray used to carry the same shadow at 0.28/0.16 while the
		// auth sheet a click away carried it at 0.32/0.18.
		const styles = getComputedStyle(element as HTMLElement);
		expect(styles.backgroundColor).toBe('rgb(251, 247, 240)');
		expect(styles.borderRadius).toBe('3px');
		expect(styles.boxShadow).toContain('rgba(0, 0, 0, 0.32) 4px 6px 16px');
		expect(styles.boxShadow).toContain('rgba(0, 0, 0, 0.18) 1px 2px 4px');
		// The grain has to have something to hang off.
		expect(styles.position).toBe('relative');
	});

	it('wears the shared paper grain, and lends it to its content when it scrolls', async () => {
		const { rerender } = await render(PaperSheet, { children: sheetContent('Grainy') });

		expect(sheet()?.classList.contains('paper-grain')).toBe(true);

		// The grain is one feTurbulence tile that used to be pasted into four
		// stylesheets; the pseudo-element is the only thing that can be asked
		// whether the sheet is actually wearing it.
		const grain = getComputedStyle(sheet() as HTMLElement, '::before');
		expect(grain.backgroundImage).toContain('feTurbulence');

		// A scrolling sheet clips its own grain: those two put it on the inner
		// element that scrolls with the content instead.
		await rerender({ children: sheetContent('Grainy'), grain: false });
		expect(sheet()?.classList.contains('paper-grain')).toBe(false);
		expect(getComputedStyle(sheet() as HTMLElement, '::before').backgroundImage).toBe('none');
	});

	it('keeps the call site in charge of geometry and semantics', async () => {
		await render(PaperSheet, {
			'aria-modal': 'true',
			as: 'section',
			children: sheetContent('Redraw your avatar'),
			class: 'rotate-[1.2deg] p-5',
			role: 'dialog'
		});

		const element = sheet();
		expect(element?.tagName).toBe('SECTION');
		expect(element?.getAttribute('role')).toBe('dialog');
		expect(element?.getAttribute('aria-modal')).toBe('true');
		// Geometry classes ride along; the paper class is never replaced.
		expect([...(element?.classList ?? [])]).toEqual(
			expect.arrayContaining(['paper-sheet', 'paper-grain', 'rotate-[1.2deg]', 'p-5'])
		);
	});
});
