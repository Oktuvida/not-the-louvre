import { expect, test } from '@playwright/test';
import {
	deterministicAuthUser,
	installAvatarExportHarness,
	installDrawingExportHarness,
	openHomeAuthOverlay,
	readVisibleOneTimeKey,
	resetDemoState,
	setAvatarExportMode,
	setDrawingExportMode,
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
		await expect(page.getByRole('link', { name: 'Studio' })).toBeVisible();
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
		await expect(page.getByRole('link', { name: 'Studio' })).toBeVisible();
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
			page.getByText('Avatar media must decode as a single still PNG image')
		).toBeVisible();
		await expect(page.getByText('Finish your avatar')).toBeVisible();

		await setAvatarExportMode(page, 'good');
		await page.locator('button').filter({ hasText: 'Enter the gallery' }).click();
		await expect(page.getByText('Signed in as')).toBeVisible();
		await expect(page.getByRole('link', { name: 'Studio' })).toBeVisible();
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

	test('draw route publishes real artwork through the product flow', async ({ page }) => {
		await installDrawingExportHarness(page);

		await page.goto('/demo/better-auth/login');
		await signUpThroughNicknameDemo(page);
		await page.goto('/draw');

		await expect(page.getByRole('link', { name: 'Exit Studio' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Publish' })).toBeVisible();
		await page.getByPlaceholder('Give your piece a title').fill('Fresh Paint');
		await page.getByRole('button', { name: 'Publish' }).click();

		await expect(page.getByText('Artwork published', { exact: true })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Fresh Paint' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Open gallery' })).toBeVisible();
		await expect(page.getByText(/Artwork id:/)).toBeVisible();
	});

	test('gallery shows a newly published artwork from the real product flow', async ({ page }) => {
		await installDrawingExportHarness(page);

		await page.goto('/demo/better-auth/login');
		await signUpThroughNicknameDemo(page);
		await page.goto('/draw');
		await page.getByPlaceholder('Give your piece a title').fill('Gallery Piece');
		await page.getByRole('button', { name: 'Publish' }).click();
		await expect(page.getByText('Artwork published', { exact: true })).toBeVisible();
		const publishedTitle = (
			await page
				.getByRole('heading')
				.filter({ hasText: /^Untitled #|./ })
				.nth(0)
				.textContent()
		)?.trim();
		expect(publishedTitle).toBeTruthy();

		await page.goto('/gallery/your-studio');
		await expect(page.getByText(publishedTitle!)).toBeVisible();
		await page.getByRole('button', { name: new RegExp(publishedTitle!) }).click();
		await expect(page.getByText('Artwork details')).toBeVisible();
	});

	test('gallery shows an honest empty state when no persisted artworks exist', async ({ page }) => {
		await page.goto('/gallery');

		await expect(page.getByText('No artworks have reached this gallery room yet.')).toBeVisible();
		await expect(page.getByText('Sunset Over Mountains')).not.toBeVisible();
	});

	test('draw route keeps the user on the page when export fails and allows retry', async ({
		page
	}) => {
		await installDrawingExportHarness(page);

		await page.goto('/demo/better-auth/login');
		await signUpThroughNicknameDemo(page);
		await page.goto('/draw');

		await setDrawingExportMode(page, 'unsupported');
		await page.getByPlaceholder('Give your piece a title').fill('Retry Piece');
		await page.getByRole('button', { name: 'Publish' }).click();
		await expect(
			page.getByText('This browser could not export your drawing. Please try again.')
		).toBeVisible();
		await expect(page).toHaveURL(/\/draw$/);

		await setDrawingExportMode(page, 'jpeg');
		await page.getByRole('button', { name: 'Publish' }).click();
		await expect(page.getByText('Artwork published', { exact: true })).toBeVisible();
	});

	test('gallery detail can fork into the draw studio with the parent artwork preloaded', async ({ page }) => {
		await installDrawingExportHarness(page);

		await page.goto('/demo/better-auth/login');
		await signUpThroughNicknameDemo(page);
		await page.goto('/draw');
		await page.getByPlaceholder('Give your piece a title').fill('Fork Source');
		await page.getByRole('button', { name: 'Publish' }).click();
		await expect(page.getByText('Artwork published', { exact: true })).toBeVisible();

		await page.goto('/gallery/your-studio');
		await page.getByRole('button', { name: /Fork Source/ }).click();
		await page.getByRole('link', { name: 'Fork' }).click();

		await expect(page).toHaveURL(/\/draw\?fork=/);
		await expect(page.getByText('Forking from')).toBeVisible();
		await expect(page.getByText('Fork Source')).toBeVisible();
	});

	test('gallery route exposes room navigation', async ({ page }) => {
		await page.goto('/gallery');

		await expect(page.getByRole('heading', { name: 'THE GALLERY' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Mystery Room' })).toBeVisible();
		await expect(page.getByText('No artworks have reached this gallery room yet.')).toBeVisible();
	});

	test('room-specific gallery route keeps room context', async ({ page }) => {
		await page.goto('/gallery/mystery');

		await expect(page.getByRole('link', { name: 'Mystery Room' })).toBeVisible();
		await expect(page.getByText('No artworks have reached this gallery room yet.')).toBeVisible();
	});

	test('unknown routes render the custom not-found page', async ({ page }) => {
		await page.goto('/totally-made-up-room');

		await expect(page.getByRole('heading', { name: 'Oops! This Canvas is Blank' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Go Home' })).toBeVisible();
	});
});
