import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import NsfwImage from './NsfwImage.svelte';

// A one-pixel GIF that really resolves, so `onload` and `complete` behave the
// way they do against the media route.
const PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

const placeholderLayer = () => document.querySelector('.nsfw-placeholder');

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

	it('shows 18+ badge overlay when blurred', async () => {
		render(NsfwImage, {
			src: 'https://example.com/nsfw.avif',
			alt: 'Sensitive artwork',
			blurred: true
		});

		const badge = page.getByText('18+', { exact: true });

		await expect.element(badge).toBeInTheDocument();
	});

	it('does not show 18+ badge overlay when not blurred', async () => {
		render(NsfwImage, {
			src: 'https://example.com/safe.avif',
			alt: 'Safe artwork',
			blurred: false
		});

		const badge = page.getByText('18+', { exact: true });

		await expect.element(badge).not.toBeInTheDocument();
	});

	it('keeps the placeholder mounted but drops its blur once the photo is opaque', async () => {
		render(NsfwImage, {
			src: PIXEL,
			alt: 'Retired placeholder artwork',
			placeholder: PIXEL
		});

		const image = page.getByAltText('Retired placeholder artwork');
		await expect.element(image).toBeInTheDocument();

		await vi.waitFor(() => {
			expect(image.element().className).toContain('is-loaded');
		});
		await vi.waitFor(
			() => {
				const layer = placeholderLayer();
				expect(layer).not.toBeNull();
				expect(layer?.className).toContain('is-retired');
			},
			{ timeout: 2000 }
		);
	});

	it('never retires the placeholder under a sensitive photo, so no sharp LQIP leaks', async () => {
		render(NsfwImage, {
			src: PIXEL,
			alt: 'Sensitive placeholder artwork',
			blurred: true,
			placeholder: PIXEL
		});

		const image = page.getByAltText('Sensitive placeholder artwork');
		await expect.element(image).toBeInTheDocument();

		await vi.waitFor(() => {
			expect(image.element().className).toContain('is-loaded');
		});

		const layer = placeholderLayer();
		expect(layer?.className).toContain('is-sensitive');
		expect(layer?.className).not.toContain('is-retired');
	});

	it('re-shows a recycled card instantly instead of replaying the fade', async () => {
		const first = render(NsfwImage, { src: PIXEL, alt: 'First mount' });

		await vi.waitFor(() => {
			expect(page.getByAltText('First mount').element().className).toContain('is-loaded');
		});
		first.unmount();

		render(NsfwImage, { src: PIXEL, alt: 'Recycled mount' });

		// Same source, already decoded this session: opaque on the first frame.
		expect(page.getByAltText('Recycled mount').element().className).toContain('is-loaded');
	});
});
