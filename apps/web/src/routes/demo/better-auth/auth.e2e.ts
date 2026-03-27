import { expect, test } from '@playwright/test';

const nickname = `tester_${Date.now()}`;

test('supports nickname signup, login, availability, and recovery surfaces', async ({ page }) => {
	await page.goto('/demo/better-auth/login');

	await page.getByLabel('Check nickname availability').fill(nickname);
	await page.getByRole('button', { name: 'Check nickname' }).click();
	await expect(page.getByText(`Nickname status: available`)).toBeVisible();

	await page.locator('form[action="?/signIn"] input[name="nickname"]').fill(nickname);
	await page.locator('form[action="?/signIn"] input[name="password"]').fill('password123');
	await page.getByRole('button', { name: 'Register' }).click();

	await expect(page).toHaveURL(/\/demo\/better-auth\?recoveryKey=/);
	await expect(page.getByText('New recovery key:')).toBeVisible();

	const recoveryKeyText = await page.getByText(/New recovery key:/).textContent();
	const recoveryKey = recoveryKeyText?.split(': ').at(1);
	if (!recoveryKey) throw new Error('Recovery key was not rendered');

	await expect(page.getByText(`Hi, ${nickname}!`)).toBeVisible();

	await page.getByRole('button', { name: 'Sign out' }).click();
	await expect(page).toHaveURL(/\/demo\/better-auth\/login/);

	await page.goto('/demo/better-auth/login');
	await page.getByLabel('Check nickname availability').fill(nickname);
	await page.getByRole('button', { name: 'Check nickname' }).click();
	await expect(page.getByText(`Nickname status: taken`)).toBeVisible();

	await page.locator('form[action="?/signIn"] input[name="nickname"]').fill(nickname);
	await page.locator('form[action="?/signIn"] input[name="password"]').fill('wrong-password');
	await page.getByRole('button', { name: 'Login with nickname' }).click();
	await expect(page.getByText('Invalid nickname or password')).toBeVisible();

	await page.locator('form[action="?/signIn"] input[name="nickname"]').fill(nickname);
	await page.locator('form[action="?/signIn"] input[name="password"]').fill('password123');
	await page.getByRole('button', { name: 'Login with nickname' }).click();
	await expect(page).toHaveURL(/\/demo\/better-auth$/);

	await page.getByRole('button', { name: 'Sign out' }).click();
	await expect(page).toHaveURL(/\/demo\/better-auth\/login/);

	await page.locator('input[name="recoveryNickname"]').fill(nickname);
	await page.locator('input[name="recoveryKey"]').fill(recoveryKey);
	await page.locator('input[name="newPassword"]').fill('newpassword123');
	await page.getByRole('button', { name: 'Recover account' }).click();
	await expect(page.getByText('Rotated recovery key:')).toBeVisible();

	await page.locator('form[action="?/signIn"] input[name="nickname"]').fill(nickname);
	await page.locator('form[action="?/signIn"] input[name="password"]').fill('password123');
	await page.getByRole('button', { name: 'Login with nickname' }).click();
	await expect(page.getByText('Invalid nickname or password')).toBeVisible();

	await page.locator('form[action="?/signIn"] input[name="nickname"]').fill(nickname);
	await page.locator('form[action="?/signIn"] input[name="password"]').fill('newpassword123');
	await page.getByRole('button', { name: 'Login with nickname' }).click();
	await expect(page).toHaveURL(/\/demo\/better-auth$/);
});
