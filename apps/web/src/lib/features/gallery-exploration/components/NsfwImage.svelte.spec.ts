import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import NsfwImage from './NsfwImage.svelte';

describe('NsfwImage', () => {
	it('applies blur classes when blurred prop is true', async () => {
		render(NsfwImage, {
			src: 'https://example.com/nsfw.avif',
			alt: 'Sensitive artwork',
			blurred: true,
			ariaLabel: 'Sensitive artwork, click to reveal'
		});

		const image = page.getByAltText('Sensitive artwork');

		await expect.element(image).toBeInTheDocument();
		await expect.element(image).toHaveAttribute('aria-label', 'Sensitive artwork, click to reveal');
	});

	it('renders normally without blur when blurred prop is false', async () => {
		render(NsfwImage, {
			src: 'https://example.com/safe.avif',
			alt: 'Safe artwork',
			blurred: false
		});

		const image = page.getByAltText('Safe artwork');

		await expect.element(image).toBeInTheDocument();
		await expect.element(image).not.toHaveAttribute('aria-label');
	});
});
