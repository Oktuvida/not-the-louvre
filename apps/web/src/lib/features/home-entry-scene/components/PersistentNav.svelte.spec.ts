import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import PersistentNav from './PersistentNav.svelte';

describe('PersistentNav', () => {
	it('shows backend-backed signed-in chrome only when a canonical user is present', async () => {
		render(PersistentNav, {
			user: {
				authUserId: 'auth-user-1',
				email: 'artist_1@not-the-louvre.local',
				id: 'product-user-1',
				nickname: 'artist_1',
				role: 'user'
			}
		});

		await expect.element(page.getByText('Signed in as')).toBeVisible();
		await expect.element(page.getByText('artist_1')).toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Logout' })).toBeVisible();
	});

	it('hides signed-in chrome when no canonical backend user exists', async () => {
		render(PersistentNav, { user: null });

		await expect.element(page.getByText('Signed in as')).not.toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Logout' })).not.toBeInTheDocument();
	});
});
