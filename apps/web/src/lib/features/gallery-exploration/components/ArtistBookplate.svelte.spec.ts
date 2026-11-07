import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ArtistBookplate from './ArtistBookplate.svelte';

const artist = (stats: { hangingSince: Date | string | null; pieces: number; stars: number }) => ({
	avatarUrl: null,
	id: 'artist-1',
	nickname: 'coral_brush',
	stats
});

describe('ArtistBookplate', () => {
	it('says whose studio this is, and what hangs in it', async () => {
		await render(ArtistBookplate, {
			artist: artist({
				hangingSince: new Date('2026-10-02T10:00:00.000Z'),
				pieces: 12,
				stars: 636
			})
		});

		const plate = page.getByRole('complementary', { name: 'The studio of coral_brush' });
		await expect.element(plate.getByText('this studio belongs to')).toBeVisible();
		await expect.element(plate.getByText('coral_brush', { exact: true })).toBeVisible();
		await expect
			.element(plate.getByText('12 pieces · 636 stars · hanging since Oct 2026'))
			.toBeVisible();
	});

	it('leads with the artist’s portrait', async () => {
		await render(ArtistBookplate, {
			artist: {
				...artist({ hangingSince: null, pieces: 0, stars: 0 }),
				avatarUrl: '/no-such-avatar.webp'
			}
		});

		await expect
			.element(page.getByRole('img', { name: 'Portrait of coral_brush' }))
			.toHaveAttribute('src', '/no-such-avatar.webp');
	});

	it('hangs no empty frame for an artist with no portrait', async () => {
		await render(ArtistBookplate, {
			artist: artist({ hangingSince: null, pieces: 0, stars: 0 })
		});

		expect(page.getByRole('img').query()).toBeNull();
	});

	it('counts one of a thing as one', async () => {
		await render(ArtistBookplate, {
			artist: artist({ hangingSince: '2026-10-02T10:00:00.000Z', pieces: 1, stars: 1 })
		});

		await expect.element(page.getByText('1 piece · 1 star · hanging since Oct 2026')).toBeVisible();
	});

	it('says so when nothing is up yet', async () => {
		await render(ArtistBookplate, {
			artist: artist({ hangingSince: null, pieces: 0, stars: 0 })
		});

		await expect.element(page.getByText('nothing on the wall yet')).toBeVisible();
	});
});
