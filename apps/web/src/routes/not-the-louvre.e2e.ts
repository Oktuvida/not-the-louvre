import { expect, test } from '@playwright/test';

const enableReducedMotion = async (page: import('@playwright/test').Page) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
};

test.describe('Not the Louvre frontend port', () => {
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

	test('home sign-in flow enters the gallery chrome', async ({ page }) => {
		await enableReducedMotion(page);

		await page.goto('/');
		await page.getByRole('button', { name: 'Come In' }).click();
		await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();

		await page.getByPlaceholder('artist_123').fill('artist_1');
		await page.getByPlaceholder('Enter your password').fill('password123');
		await page.getByRole('button', { name: 'Sign In' }).last().click();

		await expect(page.getByText('Signed in as')).toBeVisible();
		await expect(page.getByText('artist_1')).toBeVisible();
	});

	test('home signup flow goes through key acknowledgement and avatar onboarding', async ({
		page
	}) => {
		await enableReducedMotion(page);

		await page.goto('/');
		await page.getByRole('button', { name: 'Come In' }).click();
		await page.getByRole('button', { name: 'Sign up' }).click();

		await page.getByPlaceholder('artist_123').fill('fresh_artist');
		await page.getByPlaceholder('Enter your password').fill('password123');
		await expect(page.getByText('Nickname available')).toBeVisible();
		await page.getByRole('button', { name: 'Start account' }).click();

		await expect(page.getByRole('heading', { name: 'Keep this key' })).toBeVisible();
		await expect(page.getByText('studio-fresh_artist-key')).toBeVisible();
		await page.getByRole('button', { name: 'I Stored It' }).click();
		await expect(page.getByRole('heading', { name: 'Finish your avatar' })).toBeVisible();
		await page.getByRole('button', { name: 'Enter the gallery' }).click();

		await expect(page.getByText('Signed in as')).toBeVisible();
		await expect(page.getByText('fresh_artist')).toBeVisible();
	});

	test('home recovery flow stays in context and returns to login after replacement key', async ({
		page
	}) => {
		await enableReducedMotion(page);

		await page.goto('/');
		await page.getByRole('button', { name: 'Come In' }).click();
		await page.getByRole('button', { name: 'Use recovery key' }).click();

		await page.getByPlaceholder('artist_123').fill('artist_1');
		await page
			.getByPlaceholder('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx')
			.fill('12345678-1234-1234-1234-123456789012');
		await page.getByPlaceholder('Choose a new password').fill('newpassword123');
		await page.getByRole('button', { name: 'Recover Access' }).click();

		await expect(page.getByRole('heading', { name: 'Replacement key' })).toBeVisible();
		await expect(page.getByText('recovery-artist_1-key')).toBeVisible();
		await page.getByRole('button', { name: 'Back To Sign In' }).click();
		await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
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
