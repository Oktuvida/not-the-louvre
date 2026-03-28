import { expect, test } from '@playwright/test';
import { deterministicAuthUser, resetDemoState } from './e2e-helpers';

test.describe('deterministic backend e2e reset', () => {
	test.beforeEach(async ({ request }) => {
		await resetDemoState(request);
	});

	test('restores nickname availability before a journey begins', async ({ page }) => {
		await page.goto('/demo/better-auth/login');

		await page.getByLabel('Check nickname availability').fill(deterministicAuthUser.nickname);
		await page.getByRole('button', { name: 'Check nickname' }).click();

		await expect(page.getByText('Nickname status: available')).toBeVisible();
	});

	test('allows the same canonical user to sign up again after reset', async ({ page }) => {
		await page.goto('/demo/better-auth/login');

		await page
			.locator('form[action="?/signIn"] input[name="nickname"]')
			.fill(deterministicAuthUser.nickname);
		await page
			.locator('form[action="?/signIn"] input[name="password"]')
			.fill(deterministicAuthUser.password);
		await page.getByRole('button', { name: 'Register' }).click();

		await expect(page).toHaveURL(/\/demo\/better-auth\?recoveryKey=/);
		await expect(page.getByText(`Signed in as: ${deterministicAuthUser.nickname}`)).toBeVisible();
	});
});
