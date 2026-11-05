import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import MailboxDialog from './MailboxDialog.svelte';

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), {
		headers: { 'content-type': 'application/json' },
		status
	});

const slip = { author: 'oktuvida', id: 'wish-1', text: 'a very tired sun' };

describe('MailboxDialog', () => {
	it('lets the artist try again when the box will not open', async () => {
		const request = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(json({ code: 'WISH_LISTING_FAILED', message: 'No' }, 500))
			.mockResolvedValueOnce(json({ wishes: [slip] }));
		render(MailboxDialog, { onClose: vi.fn(), onTake: vi.fn(), request });

		await expect.element(page.getByText('The box is stuck.')).toBeVisible();
		await page.getByRole('button', { name: 'try again' }).click();

		await expect
			.element(page.getByRole('button', { name: /a very tired sun, left by oktuvida/ }))
			.toBeVisible();
	});

	it('hands the slip it was given back to whoever opened the box', async () => {
		const onTake = vi.fn();
		const request = vi.fn<typeof fetch>().mockResolvedValue(json({ wishes: [slip] }));
		render(MailboxDialog, { onClose: vi.fn(), onTake, request });

		await page.getByRole('button', { name: /Draw this: a very tired sun/ }).click();

		expect(onTake).toHaveBeenCalledWith(slip);
	});

	it('offers others only when there may be others', async () => {
		const request = vi.fn<typeof fetch>().mockResolvedValue(json({ wishes: [slip] }));
		render(MailboxDialog, { onClose: vi.fn(), onTake: vi.fn(), request });

		await expect
			.element(page.getByRole('button', { name: /Draw this: a very tired sun/ }))
			.toBeVisible();
		await expect
			.element(page.getByRole('button', { name: 'show me others' }))
			.not.toBeInTheDocument();
	});

	it('takes back a refusal once the artist starts rewriting', async () => {
		const request = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(json({ wishes: [] }))
			.mockResolvedValueOnce(json({ code: 'INVALID_WISH', message: 'Not that word' }, 400));
		render(MailboxDialog, { onClose: vi.fn(), onTake: vi.fn(), request });

		const field = page.getByLabelText('or leave one');
		await field.fill('a rude word');
		await page.getByRole('button', { name: 'Into the box' }).click();
		await expect.element(page.getByText('Not that word')).toBeVisible();

		await field.fill('a kind word');

		await expect.element(page.getByText('Not that word')).not.toBeInTheDocument();
	});
});
