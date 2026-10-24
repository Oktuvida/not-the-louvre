import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
// The z-index ladder and the spacing scale are global; the browser project does
// not load the root stylesheet for a component under test.
import '../../../../routes/layout.css';
import GalleryStatusRegion from './GalleryStatusRegion.svelte';

const region = () => document.querySelector('[data-testid="gallery-status-region"]');

describe('GalleryStatusRegion', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it('keeps the live region in the DOM while it has nothing to say', async () => {
		await render(GalleryStatusRegion, { message: null, onDismiss: vi.fn() });

		const container = region();
		expect(container).not.toBeNull();
		// A region that appears together with its message is announced
		// unreliably, so the container has to predate everything it carries.
		expect(container?.textContent?.trim()).toBe('');
		await expect
			.element(page.getByRole('button', { name: 'Dismiss message' }))
			.not.toBeInTheDocument();
	});

	it('interrupts for a failure and waits its turn for anything else', async () => {
		const { rerender } = await render(GalleryStatusRegion, {
			message: 'That vote did not make it onto the ledger.',
			onDismiss: vi.fn()
		});

		expect(region()?.getAttribute('role')).toBe('alert');
		expect(region()?.getAttribute('aria-live')).toBe('assertive');

		await rerender({ message: 'Signed out everywhere.', tone: 'info' });

		expect(region()?.getAttribute('role')).toBe('status');
		expect(region()?.getAttribute('aria-live')).toBe('polite');
	});

	it('outranks the persistent pills and clears the ambient audio tab', async () => {
		await render(GalleryStatusRegion, {
			message: 'Gallery could not be refreshed.',
			onDismiss: vi.fn()
		});

		const tokens = getComputedStyle(document.documentElement);
		const status = Number(tokens.getPropertyValue('--z-status'));

		// The gallery's only failure surface was painted under the audio tab and
		// the Ops pill, which also swallowed the tap meant for its dismiss button.
		expect(status).toBeGreaterThan(Number(tokens.getPropertyValue('--z-ambient')));
		expect(status).toBeGreaterThan(Number(tokens.getPropertyValue('--z-ops')));
		expect(status).toBeLessThan(Number(tokens.getPropertyValue('--z-nav-fade')));

		const styles = getComputedStyle(region() as Element);
		expect(Number(styles.zIndex)).toBe(status);
		// Outranking is not enough: the tab is 3.6rem tall at 0.4rem from the
		// bottom on a phone, and a notice underneath it is a notice nobody reads.
		expect(Number.parseFloat(styles.bottom)).toBeGreaterThanOrEqual(64);
	});

	it('hands the message back on dismiss', async () => {
		const onDismiss = vi.fn();
		await render(GalleryStatusRegion, { message: 'Gallery could not be refreshed.', onDismiss });

		await expect.element(page.getByText('Gallery could not be refreshed.')).toBeVisible();
		await page.getByRole('button', { name: 'Dismiss message' }).click();

		expect(onDismiss).toHaveBeenCalledTimes(1);
	});

	it('retires the message on its own after eight seconds, and not before', async () => {
		vi.useFakeTimers();
		const onDismiss = vi.fn();

		await render(GalleryStatusRegion, { message: 'Gallery could not be refreshed.', onDismiss });

		vi.advanceTimersByTime(7999);
		expect(onDismiss).not.toHaveBeenCalled();

		vi.advanceTimersByTime(1);
		expect(onDismiss).toHaveBeenCalledTimes(1);
	});

	it('gives a replacement message its own full window instead of the last one leftovers', async () => {
		vi.useFakeTimers();
		const onDismiss = vi.fn();

		const { rerender } = await render(GalleryStatusRegion, {
			message: 'First failure.',
			onDismiss
		});

		vi.advanceTimersByTime(6000);
		await rerender({ message: 'Second failure.', onDismiss });

		// The first message's timer must not carry over and cut this one short.
		vi.advanceTimersByTime(6000);
		expect(onDismiss).not.toHaveBeenCalled();

		vi.advanceTimersByTime(2000);
		expect(onDismiss).toHaveBeenCalledTimes(1);
	});
});
