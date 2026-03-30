import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import GalleryRoomNav from './GalleryRoomNav.svelte';

describe('GalleryRoomNav', () => {
	it('renders room navigation with shared sticker links', async () => {
		render(GalleryRoomNav, { roomId: 'hall-of-fame' });

		await expect
			.element(page.getByRole('link', { name: 'Hall of Fame' }))
			.toHaveAttribute('data-sticker-variant', 'accent');
		await expect
			.element(page.getByRole('link', { name: 'Mystery Room' }))
			.toHaveAttribute('data-sticker-size', 'md');
		await expect.element(page.getByRole('link', { name: 'Your Studio' })).not.toBeInTheDocument();
	});

	it('includes the personal room for authenticated viewers', async () => {
		render(GalleryRoomNav, {
			roomId: 'hall-of-fame',
			viewer: { id: 'user-1', role: 'user' }
		});

		await expect.element(page.getByRole('link', { name: 'Your Studio' })).toBeVisible();
	});
});
