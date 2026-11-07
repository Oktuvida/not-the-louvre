import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import WishReport from './WishReport.svelte';

const wish = { author: 'oktuvida', id: 'wish-1', text: 'a very tired sun' };

const json = (body: unknown, status: number) =>
	new Response(JSON.stringify(body), {
		headers: { 'content-type': 'application/json' },
		status
	});

const openMenu = () => page.getByRole('button', { name: /Report this slip/ }).click();

describe('WishReport', () => {
	it('sends the reason chosen and thanks the artist', async () => {
		const onReported = vi.fn();
		const request = vi.fn<typeof fetch>().mockResolvedValue(json({ report: {} }, 201));
		render(WishReport, { onReported, request, wish });

		await openMenu();
		await page.getByRole('button', { exact: true, name: 'Hate' }).click();

		await expect
			.element(page.getByRole('status'))
			.toHaveTextContent('Thanks. A moderator will read it.');
		expect(onReported).toHaveBeenCalledOnce();
		expect(request.mock.calls[0]?.[0]).toBe('/api/wishes/wish-1/reports');
		expect(request.mock.calls[0]?.[1]?.body).toBe(JSON.stringify({ reason: 'hate' }));
	});

	it('says so when the artist has already reported it', async () => {
		const onReported = vi.fn();
		const request = vi
			.fn<typeof fetch>()
			.mockResolvedValue(json({ code: 'DUPLICATE_REPORT', message: 'Duplicate' }, 409));
		render(WishReport, { onReported, request, wish });

		await openMenu();
		await page.getByRole('button', { exact: true, name: 'Spam' }).click();

		await expect
			.element(page.getByRole('status'))
			.toHaveTextContent('You already reported this one.');
		expect(onReported).not.toHaveBeenCalled();
	});
});
