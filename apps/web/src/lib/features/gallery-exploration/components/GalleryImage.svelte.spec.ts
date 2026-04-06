import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import GalleryImage from './GalleryImage.svelte';

describe('GalleryImage', () => {
	it('renders img with default width=768, height=768, loading=lazy, decoding=async', async () => {
		render(GalleryImage, {
			src: '/api/artworks/artwork-1/media',
			alt: 'Test Artwork'
		});

		const image = page.getByAltText('Test Artwork');

		await expect.element(image).toBeInTheDocument();
		await expect.element(image).toHaveAttribute('src', '/api/artworks/artwork-1/media');
		await expect.element(image).toHaveAttribute('width', '768');
		await expect.element(image).toHaveAttribute('height', '768');
		await expect.element(image).toHaveAttribute('loading', 'lazy');
		await expect.element(image).toHaveAttribute('decoding', 'async');
	});

	it('passes through className to the img element', async () => {
		render(GalleryImage, {
			src: '/api/artworks/artwork-1/media',
			alt: 'Styled Artwork',
			className: 'h-full w-full object-cover'
		});

		const image = page.getByAltText('Styled Artwork');

		await expect.element(image).toHaveAttribute('class', 'h-full w-full object-cover');
	});

	it('accepts optional width/height overrides', async () => {
		render(GalleryImage, {
			src: '/api/artworks/artwork-1/media',
			alt: 'Small Frame',
			width: 200,
			height: 200
		});

		const image = page.getByAltText('Small Frame');

		await expect.element(image).toHaveAttribute('width', '200');
		await expect.element(image).toHaveAttribute('height', '200');
		await expect.element(image).toHaveAttribute('loading', 'lazy');
		await expect.element(image).toHaveAttribute('decoding', 'async');
	});
});
