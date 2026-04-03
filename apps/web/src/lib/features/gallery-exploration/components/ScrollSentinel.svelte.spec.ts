import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ScrollSentinel from './ScrollSentinel.svelte';

describe('ScrollSentinel', () => {
	beforeEach(() => {
		window.scrollTo(0, 0);
	});

	describe('sentinel triggering', () => {
		it('renders a sentinel element that triggers onTrigger when it enters the viewport', async () => {
			const onTrigger = vi.fn();

			render(ScrollSentinel, {
				onTrigger,
				hasMore: true,
				isLoading: false,
				error: null
			});

			await expect.element(page.getByTestId('scroll-sentinel')).toBeInTheDocument();

			// Scroll the sentinel into view
			const sentinel = document.querySelector('[data-testid="scroll-sentinel"]');
			sentinel?.scrollIntoView();

			await vi.waitFor(() => {
				expect(onTrigger).toHaveBeenCalled();
			});
		});

		it('does NOT call onTrigger when disabled is true', async () => {
			const onTrigger = vi.fn();

			render(ScrollSentinel, {
				onTrigger,
				disabled: true,
				hasMore: true,
				isLoading: false,
				error: null
			});

			const sentinel = document.querySelector('[data-testid="scroll-sentinel"]');
			sentinel?.scrollIntoView();

			// Wait a tick and verify it was not called
			await new Promise((r) => setTimeout(r, 100));
			expect(onTrigger).not.toHaveBeenCalled();
		});

		it('does NOT call onTrigger when hasMore is false', async () => {
			const onTrigger = vi.fn();

			render(ScrollSentinel, {
				onTrigger,
				hasMore: false,
				isLoading: false,
				error: null
			});

			const sentinel = document.querySelector('[data-testid="scroll-sentinel"]');
			sentinel?.scrollIntoView();

			await new Promise((r) => setTimeout(r, 100));
			expect(onTrigger).not.toHaveBeenCalled();
		});
	});

	describe('loading state', () => {
		it('renders skeleton placeholder cards when isLoading is true', async () => {
			render(ScrollSentinel, {
				onTrigger: vi.fn(),
				hasMore: true,
				isLoading: true,
				error: null,
				skeletonCount: 3
			});

			await expect.element(page.getByTestId('scroll-sentinel-skeleton')).toBeInTheDocument();

			const skeletons = document.querySelectorAll('[data-testid^="skeleton-card-"]');
			expect(skeletons.length).toBe(3);
		});

		it('does not render skeletons when isLoading is false', async () => {
			render(ScrollSentinel, {
				onTrigger: vi.fn(),
				hasMore: true,
				isLoading: false,
				error: null
			});

			await expect.element(page.getByTestId('scroll-sentinel-skeleton')).not.toBeInTheDocument();
		});
	});

	describe('error/retry', () => {
		it('renders error message and retry button when error is set', async () => {
			render(ScrollSentinel, {
				onTrigger: vi.fn(),
				onRetry: vi.fn(),
				hasMore: true,
				isLoading: false,
				error: 'Failed to load artworks'
			});

			await expect.element(page.getByTestId('scroll-sentinel-error')).toBeVisible();
			await expect.element(page.getByText('Failed to load artworks')).toBeVisible();
			await expect.element(page.getByRole('button', { name: /retry/i })).toBeVisible();
		});

		it('calls onRetry when retry button is clicked', async () => {
			const onRetry = vi.fn();

			render(ScrollSentinel, {
				onTrigger: vi.fn(),
				onRetry,
				hasMore: true,
				isLoading: false,
				error: 'Failed to load artworks'
			});

			await page.getByRole('button', { name: /retry/i }).click();

			expect(onRetry).toHaveBeenCalledOnce();
		});
	});

	describe('end-of-list', () => {
		it('renders end-of-list indicator when hasMore is false and not loading and no error', async () => {
			render(ScrollSentinel, {
				onTrigger: vi.fn(),
				hasMore: false,
				isLoading: false,
				error: null
			});

			await expect.element(page.getByTestId('scroll-sentinel-end')).toBeVisible();
		});

		it('does not render end-of-list when hasMore is true', async () => {
			render(ScrollSentinel, {
				onTrigger: vi.fn(),
				hasMore: true,
				isLoading: false,
				error: null
			});

			await expect.element(page.getByTestId('scroll-sentinel-end')).not.toBeInTheDocument();
		});
	});
});
