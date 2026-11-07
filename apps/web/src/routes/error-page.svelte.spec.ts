import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import './layout.css';

vi.mock('$app/state', () => ({
	page: {
		error: { message: 'Authenticated session is missing its product user profile' },
		status: 500
	}
}));

import ErrorPage from './+error.svelte';

// When the museum has nothing to show, the wall says so in its own voice:
// an empty frame and the label beside it, never the error's own wording.
describe('the error page', () => {
	it('closes a room that broke behind the scenes, without repeating what broke', async () => {
		await render(ErrorPage);

		await expect.element(page.getByRole('heading', { name: 'Room 500' })).toBeVisible();
		await expect.element(page.getByText('Closed for repairs')).toBeVisible();
		await expect
			.element(page.getByText('Something fell off the wall behind the scenes.', { exact: false }))
			.toBeVisible();
		await expect
			.element(page.getByText('Authenticated session is missing its product user profile'))
			.not.toBeInTheDocument();
		await expect.element(page.getByRole('link', { name: /go home/i })).toHaveAttribute('href', '/');
	});
});
