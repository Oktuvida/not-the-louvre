import { expect, test } from '@playwright/test';
import {
	deterministicAuthUser,
	deterministicActorUser,
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

const openDrawSketchbook = async (page: import('@playwright/test').Page) => {
	await enableReducedMotion(page);
	await expect(page.getByRole('button', { name: 'Open sketchbook' })).toBeVisible();
	await page.getByRole('button', { name: 'Open sketchbook' }).click();
	await expect(page.getByPlaceholder('Untitled genius')).toBeVisible();
};

const expectSignedInHomeChrome = async (
	page: import('@playwright/test').Page,
	nickname: string
) => {
	await expect(page.getByText('HELLO')).toBeVisible();
	await expect(
		page.getByRole('button', { name: new RegExp(`Edit avatar for ${nickname}`) })
	).toBeVisible();
	await expect(page.getByRole('button', { name: /logout/i })).toBeVisible();
};

const readDrawingCanvasCenterPixel = async (page: import('@playwright/test').Page) =>
	page.locator('canvas[width="768"][height="768"]').evaluate((node) => {
		const canvas = node as HTMLCanvasElement;
		const context = canvas.getContext('2d');
		if (!context) {
			throw new Error('Expected the draw canvas to expose a 2D context');
		}

		return Array.from(context.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data);
	});

test.describe('Not the Louvre frontend port', () => {
	test.beforeEach(async ({ request }) => {
		await resetDemoState(request);
	});

	test('home route presents the studio landing experience', async ({ page }) => {
		await page.goto('/');

		await expect(page.getByRole('heading', { name: 'NOT THE LOUVRE' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Come In' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'GALLERY' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'MYSTERY' })).not.toBeVisible();
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
		await expectSignedInHomeChrome(page, deterministicAuthUser.nickname);
		await expect(page.getByRole('button', { name: 'Studio' })).toBeVisible();
		await page.getByRole('button', { name: /logout/i }).click();

		await openHomeAuthOverlay(page);
		await page.getByPlaceholder('artist_123').fill(deterministicAuthUser.nickname);
		await page.getByPlaceholder('Enter your password').fill(deterministicAuthUser.password);
		await page.getByRole('button', { name: 'Sign In' }).last().click();
		await expectSignedInHomeChrome(page, deterministicAuthUser.nickname);
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
		await expectSignedInHomeChrome(page, deterministicAuthUser.nickname);
		await expect(page.getByRole('button', { name: 'Studio' })).toBeVisible();
		await page.reload();
		await expectSignedInHomeChrome(page, deterministicAuthUser.nickname);
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
		await expect(page.getByText('HELLO')).not.toBeVisible();
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
		await expect(page.getByText('Avatar save requires an avatar drawing document')).toBeVisible();
		await expect(page.getByText('Finish your avatar')).toBeVisible();

		await setAvatarExportMode(page, 'good');
		await page.locator('button').filter({ hasText: 'Enter the gallery' }).click();
		await expectSignedInHomeChrome(page, deterministicAuthUser.nickname);
		await expect(page.getByRole('button', { name: 'Studio' })).toBeVisible();
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
		await expectSignedInHomeChrome(page, deterministicAuthUser.nickname);
		await page.getByRole('button', { name: /logout/i }).click();

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
		await expectSignedInHomeChrome(page, deterministicAuthUser.nickname);
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
		await expectSignedInHomeChrome(page, deterministicAuthUser.nickname);

		await page.goto('/');
		await expectSignedInHomeChrome(page, deterministicAuthUser.nickname);
		await page.getByRole('button', { name: /logout/i }).click();

		await expect(page.getByRole('button', { name: 'Come In' })).toBeVisible();
		await expect(page.getByText('HELLO')).not.toBeVisible();
	});

	test('draw route publishes real artwork through the product flow', async ({ page }) => {
		await installDrawingExportHarness(page);

		await page.goto('/demo/better-auth/login');
		await signUpThroughNicknameDemo(page);
		await page.goto('/draw');
		await openDrawSketchbook(page);

		await expect(page.getByRole('link', { name: 'Exit Studio' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Publish' })).toBeVisible();
		await page.getByPlaceholder('Untitled genius').fill('Fresh Paint');
		await page.getByRole('button', { name: 'Publish' }).click();

		await expect(page.getByText(/Artwork published as/)).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Fresh Paint' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Open gallery' })).toBeVisible();
	});

	test('gallery shows a newly published artwork from the real product flow', async ({ page }) => {
		await installDrawingExportHarness(page);

		await page.goto('/demo/better-auth/login');
		await signUpThroughNicknameDemo(page);
		await page.goto('/draw');
		await openDrawSketchbook(page);
		await page.getByPlaceholder('Untitled genius').fill('Gallery Piece');
		await page.getByRole('button', { name: 'Publish' }).click();
		await expect(page.getByText(/Artwork published as/)).toBeVisible();
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

	test('gallery detail persists vote counts and receives realtime vote and comment updates', async ({
		browser,
		page
	}) => {
		await installDrawingExportHarness(page);

		await page.goto('/demo/better-auth/login');
		await signUpThroughNicknameDemo(page);
		await page.goto('/draw');
		await openDrawSketchbook(page);
		await page.getByPlaceholder('Untitled genius').fill('Realtime Product Piece');
		await page.getByRole('button', { name: 'Publish' }).click();
		await expect(page.getByText(/Artwork published as/)).toBeVisible();

		await page.goto('/gallery/your-studio');
		await page.getByRole('button', { name: /Realtime Product Piece/ }).click();
		await expect(page.getByText('Artwork details')).toBeVisible();
		await expect(page.getByRole('button', { name: /👍\s*0/ })).toBeVisible();
		await expect(page.getByRole('button', { name: /👎\s*0/ })).toBeVisible();

		const actorContext = await browser.newContext();
		const actorPage = await actorContext.newPage();

		try {
			await installDrawingExportHarness(actorPage);
			await actorPage.goto('/demo/better-auth/login');
			await signUpThroughNicknameDemo(actorPage, deterministicActorUser);
			await actorPage.goto('/gallery');
			await actorPage.getByRole('button', { name: /Realtime Product Piece/ }).click();
			await expect(actorPage.getByText('Artwork details')).toBeVisible();

			const voteResponse = actorPage.waitForResponse(
				(response) =>
					response.url().includes('/vote') &&
					response.request().method() === 'POST' &&
					response.ok()
			);
			await actorPage.getByRole('button', { name: /👍\s*0/ }).click();
			await voteResponse;

			await expect
				.poll(async () => await page.getByRole('button', { name: /👍\s*1/ }).count(), {
					timeout: 10000
				})
				.toBeGreaterThan(0);
			await expect
				.poll(async () => await page.getByText('⭐ 1').count(), { timeout: 10000 })
				.toBeGreaterThan(0);

			const commentResponse = actorPage.waitForResponse(
				(response) =>
					response.url().includes('/comments') &&
					response.request().method() === 'POST' &&
					response.status() === 201
			);
			await actorPage.getByPlaceholder('Say something about this piece').fill('Realtime hello');
			await actorPage.getByRole('button', { name: '💬 Comment' }).click();
			await commentResponse;

			await expect
				.poll(async () => await page.getByText('Realtime hello').count(), { timeout: 10000 })
				.toBeGreaterThan(0);
		} finally {
			await actorContext.close();
		}

		await page.reload();
		await page.getByRole('button', { name: /Realtime Product Piece/ }).click();
		await expect(page.getByText('Artwork details')).toBeVisible();
		await expect(page.getByRole('button', { name: /👍\s*1/ })).toBeVisible();
		await expect(page.getByRole('button', { name: /👎\s*0/ })).toBeVisible();
		await expect(page.getByText('Realtime hello')).toBeVisible();
	});

	test('mystery room loads persisted comments for the revealed artwork detail', async ({
		page
	}) => {
		await installDrawingExportHarness(page);

		await page.goto('/demo/better-auth/login');
		await signUpThroughNicknameDemo(page);
		await page.goto('/draw');
		await openDrawSketchbook(page);
		await page.getByPlaceholder('Untitled genius').fill('Mystery Comment Piece');
		await page.getByRole('button', { name: 'Publish' }).click();
		await expect(page.getByText(/Artwork published as/)).toBeVisible();

		await page.goto('/gallery/your-studio');
		await page.getByRole('button', { name: /Mystery Comment Piece/ }).click();
		await expect(page.getByText('Artwork details')).toBeVisible();
		const commentResponse = page.waitForResponse(
			(response) =>
				response.url().includes('/comments') &&
				response.request().method() === 'POST' &&
				response.status() === 201
		);
		await page.getByPlaceholder('Say something about this piece').fill('Mystery room comment');
		await page.getByRole('button', { name: '💬 Comment' }).click();
		await commentResponse;
		await expect(page.getByText('Mystery room comment')).toBeVisible();
		await page.getByRole('dialog').press('Escape');

		await page.goto('/gallery/mystery');
		await page.getByRole('button', { name: 'Spin!' }).click();
		await expect(page.getByRole('button', { name: 'View Details' })).toBeVisible({ timeout: 5000 });
		await page.getByRole('button', { name: 'View Details' }).click();

		await expect(page.getByText('Artwork details')).toBeVisible();
		await expect(page.getByText('Mystery room comment')).toBeVisible();
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
		await openDrawSketchbook(page);

		await setDrawingExportMode(page, 'unsupported');
		await page.getByPlaceholder('Untitled genius').fill('Retry Piece');
		await page.getByRole('button', { name: 'Publish' }).click();
		await expect(
			page.getByText('This browser could not prepare your drawing. Please try again.')
		).toBeVisible();
		await expect(page).toHaveURL(/\/draw$/);

		await setDrawingExportMode(page, 'webp');
		await page.getByRole('button', { name: 'Publish' }).click();
		await expect(page.getByText(/Artwork published as/)).toBeVisible();
	});

	test('gallery detail can fork into the draw studio with the parent artwork preloaded', async ({
		page
	}) => {
		await installDrawingExportHarness(page);

		await page.goto('/demo/better-auth/login');
		await signUpThroughNicknameDemo(page);
		await page.goto('/draw');
		await openDrawSketchbook(page);
		await setDrawingExportMode(page, 'webp');
		await page.getByPlaceholder('Untitled genius').fill('Fork Source');
		await page.getByRole('button', { name: 'Publish' }).click();
		await expect(page.getByText(/Artwork published as/)).toBeVisible();

		await page.goto('/gallery/your-studio');
		await page.getByRole('button', { name: /Fork Source/ }).click();
		await page.getByRole('dialog').getByRole('button', { name: 'Fork' }).click();

		await expect(page).toHaveURL(/\/draw\?fork=/);
		await expect(page.getByRole('button', { name: 'Publish' })).toBeVisible();
		await expect(page.getByText('Forking Fork Source')).toBeVisible();
		await expect(page.getByText('Fork Source')).toBeVisible();
		await expect.poll(() => readDrawingCanvasCenterPixel(page)).not.toEqual([253, 251, 247, 255]);
		await page.getByPlaceholder('Untitled genius').fill('Fork Child');
		await page.getByRole('button', { name: 'Publish' }).click();
		await expect(page.getByText(/Artwork published as/)).toBeVisible();

		await page.goto('/gallery/your-studio');
		await expect(page.getByText('Fork Child')).toBeVisible();
		await expect(page.getByText('Forked', { exact: true })).toBeVisible();
		await expect(page.getByText('From Fork Source')).toBeVisible();
	});

	test('gallery route exposes room navigation', async ({ page }) => {
		await page.goto('/gallery');

		await expect(page.getByRole('link', { name: 'Hall of Fame' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Mystery Room' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Your Studio' })).not.toBeVisible();
		await expect(page.getByRole('link', { name: 'Create Art' })).not.toBeVisible();
		await expect(page.getByText('No artworks have reached this gallery room yet.')).toBeVisible();
	});

	test('signed-out visitors are redirected away from the personal studio route', async ({
		page
	}) => {
		await page.goto('/gallery/your-studio');

		await expect(page).toHaveURL(/\/gallery$/);
		await expect(page.getByRole('link', { name: 'Your Studio' })).not.toBeVisible();
	});

	test('signed-out gallery back button returns home without authenticated transition handling', async ({
		page
	}) => {
		await page.goto('/gallery');

		await page.getByRole('link', { name: 'Back' }).click();

		await expect(page).toHaveURL(/\/$/);
		await expect(page.getByRole('button', { name: 'Come In' })).toBeVisible();
	});

	test('room-specific gallery route keeps room context', async ({ page }) => {
		await page.goto('/gallery/mystery');

		await expect(page.getByRole('link', { name: 'Mystery Room' })).toBeVisible();
		await expect(page.getByText('No artworks have reached this gallery room yet.')).toBeVisible();
	});

	test('hot wall promotes a live artwork and still opens its detail view', async ({ page }) => {
		await installDrawingExportHarness(page);

		await page.goto('/demo/better-auth/login');
		await signUpThroughNicknameDemo(page);
		await page.goto('/draw');
		await openDrawSketchbook(page);
		await page.getByPlaceholder('Untitled genius').fill('Hot Wall Piece');
		await page.getByRole('button', { name: 'Publish' }).click();
		await expect(page.getByText(/Artwork published as/)).toBeVisible();

		await page.goto('/gallery/hot-wall');
		await expect(page.getByText('Hot right now')).toBeVisible();
		await page.getByRole('button', { name: /Hot Wall Piece/ }).click();
		await expect(page.getByText('Artwork details')).toBeVisible();
	});

	test('unknown routes render the custom not-found page', async ({ page }) => {
		await page.goto('/totally-made-up-room');

		await expect(page.getByRole('heading', { name: 'Oops! This Canvas is Blank' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Go Home' })).toBeVisible();
	});
});
