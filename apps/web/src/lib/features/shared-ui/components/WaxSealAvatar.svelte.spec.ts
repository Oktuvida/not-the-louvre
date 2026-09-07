import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import WaxSealAvatar from './WaxSealAvatar.svelte';

describe('WaxSealAvatar', () => {
	it('renders the artist avatar image inside a wax seal', async () => {
		render(WaxSealAvatar, {
			alt: 'journey_artist',
			src: '/avatars/journey.png'
		});

		const avatar = page.getByRole('img', { name: 'journey_artist' });

		await expect.element(avatar).toBeVisible();
		await expect.element(avatar).toHaveAttribute('src', '/avatars/journey.png');
	});

	it('applies a seal shape variation based on the seed', async () => {
		render(WaxSealAvatar, {
			alt: 'artist_a',
			seed: 'user-abc-123',
			src: '/avatars/a.png'
		});

		const seal = page.getByTestId('wax-seal-avatar');

		await expect.element(seal).toBeVisible();
		await expect.element(seal).toHaveAttribute('data-seal-seed', 'user-abc-123');
	});

	it('renders at the specified size', async () => {
		render(WaxSealAvatar, {
			alt: 'big_artist',
			size: 'xl',
			src: '/avatars/big.png'
		});

		const seal = page.getByTestId('wax-seal-avatar');

		await expect.element(seal).toHaveAttribute('data-seal-size', 'xl');
	});

	it('defaults to medium size when no size is specified', async () => {
		render(WaxSealAvatar, {
			alt: 'default_artist',
			src: '/avatars/default.png'
		});

		const seal = page.getByTestId('wax-seal-avatar');

		await expect.element(seal).toHaveAttribute('data-seal-size', 'md');
	});

	it('keeps avatars out of the artwork images priority lane by default', async () => {
		render(WaxSealAvatar, {
			alt: 'lazy_artist',
			src: '/avatars/lazy.png'
		});

		const avatar = page.getByRole('img', { name: 'lazy_artist' });

		await expect.element(avatar).toHaveAttribute('loading', 'lazy');
		await expect.element(avatar).toHaveAttribute('decoding', 'async');
		await expect.element(avatar).toHaveAttribute('fetchpriority', 'low');
	});

	it('lets above-the-fold callers ask for an eager seal', async () => {
		render(WaxSealAvatar, {
			alt: 'eager_artist',
			loading: 'eager',
			src: '/avatars/eager.png'
		});

		const avatar = page.getByRole('img', { name: 'eager_artist' });

		await expect.element(avatar).toHaveAttribute('loading', 'eager');
	});

	it('produces different seal shapes for different seeds', async () => {
		const { unmount } = render(WaxSealAvatar, {
			alt: 'artist_a',
			seed: 'seed-alpha',
			src: '/avatars/a.png'
		});

		const sealA = page.getByTestId('wax-seal-avatar');
		await expect.element(sealA).toBeVisible();
		const styleA = sealA.element().getAttribute('style');

		unmount();

		render(WaxSealAvatar, {
			alt: 'artist_b',
			seed: 'seed-beta',
			src: '/avatars/b.png'
		});

		const sealB = page.getByTestId('wax-seal-avatar');
		await expect.element(sealB).toBeVisible();
		const styleB = sealB.element().getAttribute('style');

		expect(styleA).not.toBe(styleB);
	});
});
