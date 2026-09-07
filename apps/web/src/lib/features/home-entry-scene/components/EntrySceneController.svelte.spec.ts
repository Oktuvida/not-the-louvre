import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import EntrySceneController from './EntrySceneController.svelte';

// The scene mounts a Threlte `<Canvas>`, which the headless browser cannot give
// a WebGL context. These specs cover the auth/onboarding state machine, so the
// scene is swapped for an inert stub. An explicit factory is required: the bare
// auto-mock does not produce a mountable Svelte 5 component.
vi.mock('$lib/features/home-entry-scene/scene/StudioScene.svelte', async () => ({
	default: (await import('./StudioSceneStub.svelte')).default
}));

// The wall zoom runs on GSAP for ~2.2s before the auth panel is revealed, so the
// assertions that wait on it need more than the 1s default retry window.
const TRANSITION_TIMEOUT = 8000;

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

		await expect
			.element(page.getByText('Welcome back'), { timeout: TRANSITION_TIMEOUT })
			.toBeVisible();
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
		await expect
			.element(page.getByRole('button', { name: /Edit avatar for artist_1/ }))
			.toBeVisible();
		await expect.element(page.getByRole('button', { name: /logout/i })).toBeVisible();
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
		await expect.element(page.getByText('HELLO')).not.toBeInTheDocument();
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

		await expect.element(page.getByText('HELLO'), { timeout: TRANSITION_TIMEOUT }).toBeVisible();
		await expect
			.element(page.getByRole('button', { name: /Edit avatar for artist_1/ }))
			.toBeVisible();
	});
});
