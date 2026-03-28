import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import AuthOverlay from './AuthOverlay.svelte';

describe('AuthOverlay', () => {
	const submitButton = (label: string) => page.getByRole('button', { name: label }).last();

	it('starts on the sign-in view and validates fields before login submit', async () => {
		const dispatch = vi.fn();
		render(AuthOverlay, { entryState: 'auth-login', dispatch });

		await expect.element(page.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
		await submitButton('Sign In').click();
		await expect.element(page.getByText('Nickname is required')).toBeInTheDocument();
		await expect.element(page.getByText('Password is required')).toBeInTheDocument();
	});

	it('toggles to sign-up and debounces nickname availability', async () => {
		const dispatch = vi.fn();
		render(AuthOverlay, { entryState: 'auth-login', dispatch });

		await page.getByRole('button', { name: 'Sign up' }).click();
		expect(dispatch).toHaveBeenCalledWith('SHOW_SIGN_UP');
	});

	it('renders the signup account step when the parent enters signup mode', async () => {
		const dispatch = vi.fn();
		render(AuthOverlay, { entryState: 'auth-signup', dispatch });

		await expect.element(page.getByRole('heading', { name: 'Draw yourself' })).toBeInTheDocument();
		await page.getByPlaceholder('artist_123').fill('new_artist');
		await new Promise((resolve) => setTimeout(resolve, 350));

		await expect.element(page.getByText('Nickname available')).toBeInTheDocument();
	});

	it('opens the recovery view from sign in and dispatches AUTH_CANCEL on close', async () => {
		const dispatch = vi.fn();
		render(AuthOverlay, { entryState: 'auth-login', dispatch });

		await page.getByRole('button', { name: 'Use recovery key' }).click();
		expect(dispatch).toHaveBeenCalledWith('SHOW_RECOVERY');
	});

	it('renders the recovery view when the parent enters recovery mode and dispatches AUTH_CANCEL on close', async () => {
		const dispatch = vi.fn();
		render(AuthOverlay, { entryState: 'auth-recovery', dispatch });

		await expect.element(page.getByRole('heading', { name: 'Recover access' })).toBeInTheDocument();
		await page.getByRole('button', { name: 'Close' }).click();
		expect(dispatch).toHaveBeenCalledWith('AUTH_CANCEL');
	});

	it('shows signup-success then avatar onboarding before entry completes', async () => {
		const dispatch = vi.fn();
		render(AuthOverlay, { entryState: 'auth-signup', dispatch });

		await page.getByPlaceholder('artist_123').fill('fresh_artist');
		await page.getByPlaceholder('Enter your password').fill('password123');
		await new Promise((resolve) => setTimeout(resolve, 350));
		await submitButton('Start account').click();

		await expect.element(page.getByRole('heading', { name: 'Keep this key' })).toBeInTheDocument();
		await expect.element(page.getByText('studio-fresh_artist-key')).toBeInTheDocument();
		expect(dispatch).not.toHaveBeenCalledWith('AUTH_SUCCESS');
		await page.getByRole('button', { name: 'I Stored It' }).click();
		await expect
			.element(page.getByRole('heading', { name: 'Finish your avatar' }))
			.toBeInTheDocument();
		await page.getByRole('button', { name: 'Enter the gallery' }).click();
		await vi.waitFor(() => {
			expect(dispatch).toHaveBeenCalledWith('AUTH_SUCCESS');
		});
	});

	it('shows recover-success with the rotated replacement key', async () => {
		const dispatch = vi.fn();
		render(AuthOverlay, { entryState: 'auth-recovery', dispatch });

		await page.getByPlaceholder('artist_123').fill('artist_1');
		await page
			.getByPlaceholder('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx')
			.fill('12345678-1234-1234-1234-123456789012');
		await page.getByPlaceholder('Choose a new password').fill('password123');
		await submitButton('Recover Access').click();

		await expect
			.element(page.getByRole('heading', { name: 'Replacement key' }))
			.toBeInTheDocument();
		await expect.element(page.getByText('recovery-artist_1-key')).toBeInTheDocument();
		await page.getByRole('button', { name: 'Back To Sign In' }).click();
		expect(dispatch).toHaveBeenCalledWith('SHOW_LOGIN');
	});
});
