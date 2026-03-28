import { expect, test } from '@playwright/test';
import {
	deterministicAuthUser,
	installAvatarExportHarness,
	openHomeAuthOverlay,
	readVisibleOneTimeKey,
	resetDemoState,
	setAvatarExportMode,
	signUpThroughNicknameDemo
} from './demo/e2e-helpers';

const enableReducedMotion = async (page: import('@playwright/test').Page) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
};

test.describe('Not the Louvre frontend port', () => {
	test.beforeEach(async ({ request }) => {
		await resetDemoState(request);
	});

	test('home route presents the studio landing experience', async ({ page }) => {
		await page.goto('/');

		await expect(page.getByRole('heading', { name: 'NOT THE LOUVRE' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Come In' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'GALLERY' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'MYSTERY' })).toBeVisible();
		await expect(
			page.getByText('A social art studio where your doodles compete for glory')
		).toBeVisible();
	});

	test('home sign-in flow enters the gallery chrome with a real backend user', async ({ page }) => {
		await enableReducedMotion(page);
		await installAvatarExportHarness(page);

		await page.goto('/demo/better-auth/login');
		await signUpThroughNicknameDemo(page);

		await page.goto('/');
		await expect(page.getByText('Finish your avatar')).toBeVisible();
		await page.locator('button').filter({ hasText: 'Enter the gallery' }).click();
		await expect(page.getByText('Signed in as')).toBeVisible();
		await page.getByRole('button', { name: 'Logout' }).click();

		await openHomeAuthOverlay(page);
		await page.getByPlaceholder('artist_123').fill(deterministicAuthUser.nickname);
		await page.getByPlaceholder('Enter your password').fill(deterministicAuthUser.password);
		await page.getByRole('button', { name: 'Sign In' }).last().click();

		await expect(page.getByText('Signed in as')).toBeVisible();
		await expect(page.getByText(deterministicAuthUser.nickname)).toBeVisible();
	});

	test('home signup flow uses the backend recovery key and keeps the avatar onboarding step', async ({
		page
	}) => {
		await enableReducedMotion(page);
		await installAvatarExportHarness(page);

		await openHomeAuthOverlay(page);
		await page.getByRole('button', { name: 'Sign up' }).click();

		await page.getByPlaceholder('artist_123').fill(deterministicAuthUser.nickname);
		await page.getByPlaceholder('Enter your password').fill(deterministicAuthUser.password);
		await expect(page.getByText('Nickname available')).toBeVisible();
		await page.getByRole('button', { name: 'Start account' }).click();

		await expect(page.getByText('Keep this key')).toBeVisible();
		const recoveryKey = await readVisibleOneTimeKey(page);
		expect(recoveryKey).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
		await page.getByText('I Stored It').click();
		await expect(page.getByText('Finish your avatar')).toBeVisible();
		await page.locator('button').filter({ hasText: 'Enter the gallery' }).click();

		await expect(page.getByText('Signed in as')).toBeVisible();
		await expect(page.getByText(deterministicAuthUser.nickname)).toBeVisible();
		await page.reload();
		await expect(page.getByText('Signed in as')).toBeVisible();
		await expect(page.getByText('Finish your avatar')).not.toBeVisible();
	});

	test('home route reload resumes avatar onboarding for authenticated users who have not finished it', async ({
		page
	}) => {
		await enableReducedMotion(page);
		await installAvatarExportHarness(page);

		await openHomeAuthOverlay(page);
		await page.getByRole('button', { name: 'Sign up' }).click();
		await page.getByPlaceholder('artist_123').fill(deterministicAuthUser.nickname);
		await page.getByPlaceholder('Enter your password').fill(deterministicAuthUser.password);
		await page.getByRole('button', { name: 'Start account' }).click();
		await page.getByText('I Stored It').click();

		await expect(page.getByText('Finish your avatar')).toBeVisible();
		await page.reload();
		await expect(page.getByText('Finish your avatar')).toBeVisible();
		await expect(page.getByText('Signed in as')).not.toBeVisible();
	});

	test('avatar save failure stays in onboarding and retry can complete the flow', async ({
		page
	}) => {
		await enableReducedMotion(page);
		await installAvatarExportHarness(page);

		await openHomeAuthOverlay(page);
		await page.getByRole('button', { name: 'Sign up' }).click();
		await page.getByPlaceholder('artist_123').fill(deterministicAuthUser.nickname);
		await page.getByPlaceholder('Enter your password').fill(deterministicAuthUser.password);
		await page.getByRole('button', { name: 'Start account' }).click();
		await page.getByText('I Stored It').click();

		await setAvatarExportMode(page, 'bad');
		await page.locator('button').filter({ hasText: 'Enter the gallery' }).click();
		await expect(
			page.getByText('Avatar media must decode as a single still AVIF image')
		).toBeVisible();
		await expect(page.getByText('Finish your avatar')).toBeVisible();

		await setAvatarExportMode(page, 'good');
		await page.locator('button').filter({ hasText: 'Enter the gallery' }).click();
		await expect(page.getByText('Signed in as')).toBeVisible();
	});

	test('home recovery flow rotates the recovery key and lets the user sign in with the new password', async ({
		page
	}) => {
		await enableReducedMotion(page);
		await installAvatarExportHarness(page);

		await page.goto('/demo/better-auth/login');
		const recoveryKey = await signUpThroughNicknameDemo(page);

		await page.goto('/');
		await expect(page.getByText('Finish your avatar')).toBeVisible();
		await page.locator('button').filter({ hasText: 'Enter the gallery' }).click();
		await expect(page.getByText('Signed in as')).toBeVisible();
		await page.getByRole('button', { name: 'Logout' }).click();

		await openHomeAuthOverlay(page);
		await page.getByRole('button', { name: 'Use recovery key' }).click();

		await page.getByPlaceholder('artist_123').fill(deterministicAuthUser.nickname);
		await page.getByPlaceholder('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx').fill(recoveryKey);
		await page
			.getByPlaceholder('Choose a new password')
			.fill(deterministicAuthUser.recoveredPassword);
		await page.getByRole('button', { name: 'Recover Access' }).click();

		await expect(page.getByRole('heading', { name: 'Replacement key' })).toBeVisible();
		const rotatedRecoveryKey = await readVisibleOneTimeKey(page);
		expect(rotatedRecoveryKey).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
		);
		await page.getByRole('button', { name: 'Back To Sign In' }).click();
		await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();

		await page.getByPlaceholder('artist_123').fill(deterministicAuthUser.nickname);
		await page.getByPlaceholder('Enter your password').fill(deterministicAuthUser.password);
		await page.getByRole('button', { name: 'Sign In' }).last().click();
		await expect(page.getByText('Invalid nickname or password')).toBeVisible();

		await page
			.getByPlaceholder('Enter your password')
			.fill(deterministicAuthUser.recoveredPassword);
		await page.getByRole('button', { name: 'Sign In' }).last().click();
		await expect(page.getByText('Signed in as')).toBeVisible();
	});

	test('existing authenticated sessions bootstrap directly into the signed-in home scene and can log out', async ({
		page
	}) => {
		await enableReducedMotion(page);
		await installAvatarExportHarness(page);

		await openHomeAuthOverlay(page);
		await page.getByRole('button', { name: 'Sign up' }).click();
		await page.getByPlaceholder('artist_123').fill(deterministicAuthUser.nickname);
		await page.getByPlaceholder('Enter your password').fill(deterministicAuthUser.password);
		await page.getByRole('button', { name: 'Start account' }).click();
		await page.getByText('I Stored It').click();
		await page.locator('button').filter({ hasText: 'Enter the gallery' }).click();
		await expect(page.getByText('Signed in as')).toBeVisible();

		await page.goto('/');
		await expect(page.getByText('Signed in as')).toBeVisible();
		await expect(page.getByText(deterministicAuthUser.nickname)).toBeVisible();
		await page.getByRole('button', { name: 'Logout' }).click();

		await expect(page.getByRole('button', { name: 'Come In' })).toBeVisible();
		await expect(page.getByText('Signed in as')).not.toBeVisible();
	});

	test('draw route exposes the studio drawing workspace', async ({ page }) => {
		await page.goto('/draw');

		await expect(page.getByRole('link', { name: 'Exit Studio' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Publish' })).toBeVisible();
		await expect(page.getByText('Your character is painting...')).toBeVisible();
	});

	test('gallery route exposes room navigation', async ({ page }) => {
		await page.goto('/gallery');

		await expect(page.getByRole('heading', { name: 'THE GALLERY' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Mystery Room' })).toBeVisible();
		await expect(page.getByText('The most legendary artworks of all time')).toBeVisible();
		await expect(page.getByText('CHAMPION')).toBeVisible();
	});

	test('room-specific gallery route keeps room context', async ({ page }) => {
		await page.goto('/gallery/mystery');

		await expect(page.getByRole('link', { name: 'Mystery Room' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Spin!' })).toBeVisible();
	});

	test('unknown routes render the custom not-found page', async ({ page }) => {
		await page.goto('/totally-made-up-room');

		await expect(page.getByRole('heading', { name: 'Oops! This Canvas is Blank' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Go Home' })).toBeVisible();
	});
});
