import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import AuthOverlay from './AuthOverlay.svelte';

describe('AuthOverlay', () => {
	const submitButton = (label: string) => page.getByRole('button', { name: label }).last();

	it('starts on the sign-in view and validates fields before login submit', async () => {
		const dispatch = vi.fn();
		render(AuthOverlay, {
			dispatch,
			entryState: 'auth-login',
			form: undefined
		});

		await expect.element(page.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
		await submitButton('Sign In').click();
		await expect.element(page.getByText('Nickname is required')).toBeInTheDocument();
		await expect.element(page.getByText('Password is required')).toBeInTheDocument();
	});

	it('shows backend-driven sign-in failures without leaving the login context', async () => {
		const dispatch = vi.fn();
		render(AuthOverlay, {
			dispatch,
			entryState: 'auth-login',
			form: {
				action: 'signIn',
				code: 'INVALID_CREDENTIALS',
				message: 'Invalid nickname or password'
			}
		});

		await expect.element(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
		await expect.element(page.getByText('Invalid nickname or password')).toBeVisible();
		expect(dispatch).not.toHaveBeenCalledWith('AUTH_SUCCESS');
	});

	it('shows duplicate nickname failures in the signup context', async () => {
		const dispatch = vi.fn();
		render(AuthOverlay, {
			dispatch,
			entryState: 'auth-signup',
			form: {
				action: 'signUp',
				code: 'NICKNAME_TAKEN',
				message: 'Nickname is already taken'
			}
		});

		await expect.element(page.getByRole('heading', { name: 'Draw yourself' })).toBeInTheDocument();
		await expect.element(page.getByText('That nickname is already taken')).toBeVisible();
	});

	it('shows the backend-issued signup recovery key and waits for acknowledgement', async () => {
		const dispatch = vi.fn();
		render(AuthOverlay, {
			dispatch,
			entryState: 'auth-signup',
			form: {
				action: 'signUp',
				onboarding: 'needs-avatar',
				recoveryKey: 'signup-recovery-key',
				success: true
			}
		});

		await expect.element(page.getByRole('heading', { name: 'Keep this key' })).toBeInTheDocument();
		await expect.element(page.getByText('signup-recovery-key')).toBeInTheDocument();
		expect(dispatch).not.toHaveBeenCalledWith('AUTH_SUCCESS');
	});

	it('shows the rotated recovery key and returns to login after acknowledgement', async () => {
		const dispatch = vi.fn();
		render(AuthOverlay, {
			dispatch,
			entryState: 'auth-recovery',
			form: {
				action: 'recover',
				recoveryKey: 'rotated-recovery-key',
				rotatedRecoveryKey: 'rotated-recovery-key',
				success: true
			}
		});

		await expect
			.element(page.getByRole('heading', { name: 'Replacement key' }))
			.toBeInTheDocument();
		await expect.element(page.getByText('rotated-recovery-key')).toBeInTheDocument();
		await page.getByRole('button', { name: 'Back To Sign In' }).click();
		expect(dispatch).toHaveBeenCalledWith('SHOW_LOGIN');
	});

	it('reopens directly on the avatar step for authenticated users with incomplete onboarding', async () => {
		const dispatch = vi.fn();
		render(AuthOverlay, {
			authenticatedUser: {
				authUserId: 'auth-user-1',
				avatarOnboardingCompletedAt: null,
				email: 'artist_1@not-the-louvre.local',
				id: 'product-user-1',
				nickname: 'artist_1',
				role: 'user'
			},
			dispatch,
			entryState: 'auth-signup',
			form: undefined,
			resumeAvatarOnboarding: true
		});

		await expect.element(page.getByText('Finish your avatar')).toBeVisible();
		await expect.element(page.getByRole('textbox')).toHaveValue('artist_1');
	});
});
