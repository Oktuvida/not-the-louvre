import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import GalleryRoomNav from './GalleryRoomNav.svelte';

describe('GalleryRoomNav', () => {
	it('renders room navigation with shared sticker links', async () => {
		await render(GalleryRoomNav, { roomId: 'hall-of-fame' });

		await expect
			.element(page.getByRole('link', { name: 'Hall of Fame' }))
			.toHaveAttribute('data-sticker-variant', 'accent');
		await expect
			.element(page.getByRole('link', { name: 'Mystery Room' }))
			.toHaveAttribute('data-sticker-size', 'md');
		await expect.element(page.getByRole('link', { name: 'Your Studio' })).not.toBeInTheDocument();
	});

	it('offers Wet Paint to everyone, right after the Hot Wall', async () => {
		await render(GalleryRoomNav, { roomId: 'hall-of-fame' });

		const rooms = page.getByRole('link');
		await expect.element(rooms.nth(1)).toHaveTextContent('The Hot Wall');
		await expect.element(rooms.nth(2)).toHaveTextContent('Wet Paint');
	});

	it('includes the personal room for authenticated viewers', async () => {
		await render(GalleryRoomNav, {
			roomId: 'hall-of-fame',
			viewer: { id: 'user-1', role: 'user' }
		});

		await expect.element(page.getByRole('link', { name: 'Your Studio' })).toBeVisible();
	});

	it('keeps room navigation horizontally scrollable for narrow layouts', async () => {
		await render(GalleryRoomNav, { roomId: 'hall-of-fame' });

		const nav = document.querySelector('nav');
		expect(nav).not.toBeNull();
		expect(nav?.className).toContain('overflow-x-auto');
	});
});
