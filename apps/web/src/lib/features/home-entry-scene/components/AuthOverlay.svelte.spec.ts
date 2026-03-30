import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import AuthOverlay from './AuthOverlay.svelte';

describe('AuthOverlay', () => {
	const submitButton = (label: string) => page.getByRole('button', { name: label }).last();

	beforeEach(() => {
		vi.unstubAllGlobals();
	});

	it('blocks signup when the nickname filter rejects the chosen nickname', async () => {
		const checkTextContent = vi.fn(async () => ({
			message: 'Choose a different nickname.',
			status: 'blocked' as const
		}));
		const requestSubmit = vi.fn();
		const fetchSpy = vi.fn(
			async () =>
				new Response(
					JSON.stringify({
						type: 'success',
						data: { action: 'checkNickname', availability: 'available' }
					})
				)
		);
		vi.stubGlobal('fetch', fetchSpy);
		vi.spyOn(HTMLFormElement.prototype, 'requestSubmit').mockImplementation(requestSubmit);

		render(AuthOverlay, {
			checkTextContent,
			dispatch: vi.fn(),
			entryState: 'auth-signup'
		});

		await page.getByPlaceholder('artist_123').fill('blocked_name');
		await page.getByPlaceholder('Enter your password').fill('password123');
		await submitButton('Start account').click();

		await expect.element(page.getByText('Choose a different nickname.')).toBeVisible();
		expect(requestSubmit).not.toHaveBeenCalled();
	});

	it('blocks signup when the nickname filter is unavailable', async () => {
		const checkTextContent = vi.fn(async () => ({
			message: 'Nickname safety check is unavailable right now. Please try again.',
			status: 'unavailable' as const
		}));
		const requestSubmit = vi.fn();
		const fetchSpy = vi.fn(
			async () =>
				new Response(
					JSON.stringify({
						type: 'success',
						data: { action: 'checkNickname', availability: 'available' }
					})
				)
		);
		vi.stubGlobal('fetch', fetchSpy);
		vi.spyOn(HTMLFormElement.prototype, 'requestSubmit').mockImplementation(requestSubmit);

		render(AuthOverlay, {
			checkTextContent,
			dispatch: vi.fn(),
			entryState: 'auth-signup'
		});

		await page.getByPlaceholder('artist_123').fill('uncertain_name');
		await page.getByPlaceholder('Enter your password').fill('password123');
		await submitButton('Start account').click();

		await expect
			.element(page.getByText('Nickname safety check is unavailable right now. Please try again.'))
			.toBeVisible();
		expect(requestSubmit).not.toHaveBeenCalled();
	});

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

	it('notifies the controller when the avatar step is dismissed', async () => {
		const dispatch = vi.fn();
		const onAvatarDismiss = vi.fn();
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
			onAvatarDismiss,
			resumeAvatarOnboarding: true
		});

		await page.getByRole('button', { name: 'Close' }).click();

		expect(onAvatarDismiss).toHaveBeenCalled();
		expect(dispatch).toHaveBeenCalledWith('AUTH_SUCCESS');
	});

	it('returns the live avatar URL to the controller after a successful avatar save', async () => {
		const dispatch = vi.fn();
		const onAvatarSaved = vi.fn();
		const fetchSpy = vi.fn(
			async () =>
				new Response(
					JSON.stringify({ avatarUrl: '/api/users/product-user-1/avatar?v=1711713600000' }),
					{
						headers: { 'content-type': 'application/json' },
						status: 200
					}
				)
		);
		const toBlobSpy = vi
			.spyOn(HTMLCanvasElement.prototype, 'toBlob')
			.mockImplementation((callback) => {
				callback(new Blob([new Uint8Array([1, 2, 3])], { type: 'image/webp' }));
			});

		vi.stubGlobal('fetch', fetchSpy);

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
			onAvatarSaved,
			resumeAvatarOnboarding: true
		});

		await expect.element(page.getByText('Finish your avatar')).toBeVisible();
		await page.getByRole('button', { name: 'Enter the gallery' }).click();

		await vi.waitFor(() => {
			expect(onAvatarSaved).toHaveBeenCalledWith({
				avatarOnboardingCompletedAt: expect.any(Date),
				avatarUrl: '/api/users/product-user-1/avatar?v=1711713600000'
			});
			expect(dispatch).toHaveBeenCalledWith('AUTH_SUCCESS');
		});

		expect(fetchSpy).toHaveBeenCalledWith('/api/users/product-user-1/avatar', {
			body: expect.any(FormData),
			method: 'PUT'
		});

		toBlobSpy.mockRestore();
	});
});
