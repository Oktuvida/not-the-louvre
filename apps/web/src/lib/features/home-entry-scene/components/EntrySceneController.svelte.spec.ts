import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import EntrySceneController from './EntrySceneController.svelte';

describe('EntrySceneController', () => {
	beforeEach(() => {
		vi.unstubAllGlobals();
	});

	it('shows the wall first and reveals auth after Come In completes', async () => {
		render(EntrySceneController);

		await expect.element(page.getByRole('button', { name: 'Come In' })).toBeVisible();

		await page.getByRole('button', { name: 'Come In' }).click();
		await new Promise((resolve) => setTimeout(resolve, 2400));

		await expect.element(page.getByText('Welcome back')).toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Close' })).toBeVisible();
	});

	it('reverses back outside after dismissing auth', async () => {
		render(EntrySceneController);

		await page.getByRole('button', { name: 'Come In' }).click();
		await new Promise((resolve) => setTimeout(resolve, 2400));
		await page.getByRole('button', { name: 'Close' }).click();
		await new Promise((resolve) => setTimeout(resolve, 1500));

		await expect.element(page.getByRole('button', { name: 'Come In' })).toBeVisible();
	});

	it('uses the reduced-motion fallback to reveal auth quickly', async () => {
		vi.stubGlobal('matchMedia', (query: string) => ({
			matches: query === '(prefers-reduced-motion: reduce)',
			media: query,
			onchange: null,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			addListener: vi.fn(),
			removeListener: vi.fn(),
			dispatchEvent: vi.fn()
		}));

		render(EntrySceneController);

		await page.getByRole('button', { name: 'Come In' }).click();
		await new Promise((resolve) => setTimeout(resolve, 800));

		await expect.element(page.getByText('Welcome back')).toBeVisible();
	});

	it('can switch from login to signup onboarding and back to recovery entry points', async () => {
		render(EntrySceneController);

		await page.getByRole('button', { name: 'Come In' }).click();
		await new Promise((resolve) => setTimeout(resolve, 2400));

		await page.getByRole('button', { name: 'Sign up' }).click();
		await expect.element(page.getByRole('heading', { name: 'Draw yourself' })).toBeVisible();

		await page.getByRole('button', { name: 'Log in' }).click();
		await expect.element(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();

		await page.getByRole('button', { name: 'Use recovery key' }).click();
		await expect.element(page.getByRole('heading', { name: 'Recover access' })).toBeVisible();
	});

	it('shows signed-in account controls and returns outside after logout', async () => {
		render(EntrySceneController);
		await page.getByRole('button', { name: 'Come In' }).click();
		await new Promise((resolve) => setTimeout(resolve, 2400));
		await page.getByPlaceholder('artist_123').fill('artist_1');
		await page.getByPlaceholder('Enter your password').fill('password123');
		await page.getByRole('button', { name: 'Sign In' }).last().click();

		await expect.element(page.getByText('Signed in as')).toBeInTheDocument();
		await expect.element(page.getByText('artist_1')).toBeInTheDocument();
		await page.getByRole('button', { name: 'Logout' }).click();

		await expect.element(page.getByRole('button', { name: 'Come In' })).toBeInTheDocument();
	});
});
