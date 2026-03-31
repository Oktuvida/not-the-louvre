import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import EntrySceneController from './EntrySceneController.svelte';

const authenticatedUser = {
	authUserId: 'auth-user-1',
	avatarOnboardingCompletedAt: new Date('2026-03-28T10:00:00.000Z'),
	email: 'artist_1@not-the-louvre.local',
	id: 'product-user-1',
	nickname: 'artist_1',
	role: 'user'
};

describe('EntrySceneController', () => {
	beforeEach(() => {
		vi.unstubAllGlobals();
	});

	it('shows the wall first and reveals auth after Come In completes', async () => {
		render(EntrySceneController, {
			auth: { integrityFailure: null, onboarding: null, status: 'signed-out', user: null }
		});

		await expect.element(page.getByRole('button', { name: 'Come In' })).toBeVisible();

		await page.getByRole('button', { name: 'Come In' }).click();
		await new Promise((resolve) => setTimeout(resolve, 2400));

		await expect.element(page.getByText('Welcome back')).toBeVisible();
	});

	it('bootstraps directly into the signed-in scene when the server session already exists', async () => {
		render(EntrySceneController, {
			auth: {
				integrityFailure: null,
				onboarding: { status: 'complete' },
				status: 'authenticated',
				user: authenticatedUser
			}
		});

		await expect.element(page.getByText('HELLO')).toBeVisible();
		await expect.element(page.getByText('artist_1')).toBeVisible();
		await expect.element(page.getByRole('button', { name: 'LOGOUT' })).toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Come In' })).not.toBeInTheDocument();
	});

	it('keeps the signup overlay visible after backend signup success until the user acknowledges the recovery key', async () => {
		render(EntrySceneController, {
			auth: {
				integrityFailure: null,
				onboarding: { status: 'complete' },
				status: 'authenticated',
				user: authenticatedUser
			},
			form: {
				action: 'signUp',
				onboarding: 'needs-avatar',
				recoveryKey: 'signup-recovery-key',
				success: true
			}
		});

		await expect.element(page.getByRole('heading', { name: 'Keep this key' })).toBeVisible();
		await expect.element(page.getByText('signup-recovery-key')).toBeVisible();
		await expect.element(page.getByText('HELLO')).not.toBeInTheDocument();
	});

	it('does not flash the avatar step before the signup recovery key when onboarding is also pending', async () => {
		const headings: string[] = [];
		const recordHeading = () => {
			const heading = document.querySelector('h2')?.textContent?.trim();
			if (heading) headings.push(heading);
		};
		const observer = new MutationObserver(recordHeading);

		observer.observe(document.body, {
			characterData: true,
			childList: true,
			subtree: true
		});

		render(EntrySceneController, {
			auth: {
				integrityFailure: null,
				onboarding: { status: 'needs-avatar' },
				status: 'authenticated',
				user: {
					authUserId: 'auth-user-1',
					avatarOnboardingCompletedAt: null,
					email: 'artist_1@not-the-louvre.local',
					id: 'product-user-1',
					nickname: 'artist_1',
					role: 'user'
				}
			},
			form: {
				action: 'signUp',
				onboarding: 'needs-avatar',
				recoveryKey: 'signup-recovery-key',
				success: true
			}
		});

		recordHeading();

		await expect.element(page.getByRole('heading', { name: 'Keep this key' })).toBeVisible();
		observer.disconnect();

		expect(headings).not.toContain('Finish your avatar');
	});

	it('renders a safe blocked message when auth bootstrap detects an integrity failure', async () => {
		render(EntrySceneController, {
			auth: {
				integrityFailure: {
					message: 'Authenticated session is missing its product user profile',
					reason: 'missing-product-user'
				},
				onboarding: null,
				status: 'integrity-failure',
				user: null
			}
		});

		await expect.element(page.getByText('Session needs repair')).toBeVisible();
		await expect
			.element(page.getByText('Authenticated session is missing its product user profile'))
			.toBeVisible();
		await expect.element(page.getByText('HELLO')).not.toBeInTheDocument();
	});

	it('resumes avatar onboarding for authenticated users who have not completed it yet', async () => {
		render(EntrySceneController, {
			auth: {
				integrityFailure: null,
				onboarding: { status: 'needs-avatar' },
				status: 'authenticated',
				user: {
					authUserId: 'auth-user-1',
					avatarOnboardingCompletedAt: null,
					email: 'artist_1@not-the-louvre.local',
					id: 'product-user-1',
					nickname: 'artist_1',
					role: 'user'
				}
			}
		});

		await expect.element(page.getByText('Finish your avatar')).toBeVisible();
		await expect.element(page.getByText('Signed in as')).not.toBeInTheDocument();
	});

	it('lets authenticated users close the avatar onboarding overlay into the signed-in scene', async () => {
		render(EntrySceneController, {
			auth: {
				integrityFailure: null,
				onboarding: { status: 'needs-avatar' },
				status: 'authenticated',
				user: {
					authUserId: 'auth-user-1',
					avatarOnboardingCompletedAt: null,
					email: 'artist_1@not-the-louvre.local',
					id: 'product-user-1',
					nickname: 'artist_1',
					role: 'user'
				}
			}
		});

		await expect.element(page.getByText('Finish your avatar')).toBeVisible();
		await page.getByRole('button', { name: 'Close' }).click();
		await new Promise((resolve) => setTimeout(resolve, 1800));

		await expect.element(page.getByText('HELLO')).toBeVisible();
		await expect.element(page.getByText('artist_1', { exact: true })).toBeVisible();
	});
});
