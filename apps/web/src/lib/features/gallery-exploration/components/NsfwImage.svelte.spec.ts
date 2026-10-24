import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import NsfwImage from './NsfwImage.svelte';

// A one-pixel GIF that really resolves, so `onload` and `complete` behave the
// way they do against the media route.
const PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

describe('NsfwImage', () => {
	it('applies blur classes when blurred prop is true', async () => {
		await render(NsfwImage, {
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
		await render(NsfwImage, {
			src: 'https://example.com/safe.avif',
			alt: 'Safe artwork',
			blurred: false
		});

		const image = page.getByAltText('Safe artwork');

		await expect.element(image).toBeInTheDocument();
		await expect.element(image).not.toHaveAttribute('aria-label');
	});

	it('shows 18+ badge overlay when blurred', async () => {
		await render(NsfwImage, {
			src: 'https://example.com/nsfw.avif',
			alt: 'Sensitive artwork',
			blurred: true
		});

		const badge = page.getByText('18+', { exact: true });

		await expect.element(badge).toBeInTheDocument();
	});

	it('does not show 18+ badge overlay when not blurred', async () => {
		await render(NsfwImage, {
			src: 'https://example.com/safe.avif',
			alt: 'Safe artwork',
			blurred: false
		});

		const badge = page.getByText('18+', { exact: true });

		await expect.element(badge).not.toBeInTheDocument();
	});

	it('keeps the blur but drops the badge when the caller paints its own scrim', async () => {
		await render(NsfwImage, {
			src: 'https://example.com/nsfw.avif',
			alt: 'Sensitive artwork',
			blurred: true,
			showScrim: false
		});

		const image = page.getByAltText('Sensitive artwork');

		await expect.element(image).toBeInTheDocument();
		// The shared treatment still applies — only the built-in badge is gone,
		// so a richer scrim above it never announces "18+" twice.
		expect(image.element().className).toContain('is-sensitive');
		await expect.element(page.getByText('18+', { exact: true })).not.toBeInTheDocument();
		expect(document.querySelector('.nsfw-scrim')).toBeNull();
	});

	it('re-shows a recycled card instantly instead of replaying the fade', async () => {
		const first = await render(NsfwImage, { src: PIXEL, alt: 'First mount' });

		await vi.waitFor(() => {
			expect(page.getByAltText('First mount').element().className).toContain('is-loaded');
		});
		first.unmount();

		await render(NsfwImage, { src: PIXEL, alt: 'Recycled mount' });

		// Same source, already decoded this session: opaque on the first frame.
		expect(page.getByAltText('Recycled mount').element().className).toContain('is-loaded');
	});
});
