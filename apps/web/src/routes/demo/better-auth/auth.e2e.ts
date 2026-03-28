import { expect, test } from '@playwright/test';
import {
	checkNicknameAvailability,
	deterministicAuthUser,
	openNicknameAuthDemo,
	recoverThroughNicknameDemo,
	resetDemoState,
	signInThroughNicknameDemo,
	signOutThroughNicknameDemo,
	signUpThroughNicknameDemo
} from '../e2e-helpers';

test.beforeEach(async ({ request }) => {
	await resetDemoState(request);
});

test('supports nickname signup, login, availability, and recovery surfaces', async ({ page }) => {
	await openNicknameAuthDemo(page);

	await checkNicknameAvailability(page, deterministicAuthUser.nickname);
	await expect(page.getByText(`Nickname status: available`)).toBeVisible();

	const recoveryKey = await signUpThroughNicknameDemo(page);
	await signOutThroughNicknameDemo(page);

	await openNicknameAuthDemo(page);
	await checkNicknameAvailability(page, deterministicAuthUser.nickname);
	await expect(page.getByText(`Nickname status: taken`)).toBeVisible();

	await page
		.locator('form[action="?/signIn"] input[name="nickname"]')
		.fill(deterministicAuthUser.nickname);
	await page.locator('form[action="?/signIn"] input[name="password"]').fill('wrong-password');
	await page.getByRole('button', { name: 'Login with nickname' }).click();
	await expect(page.getByText('Invalid nickname or password')).toBeVisible();

	await signInThroughNicknameDemo(
		page,
		deterministicAuthUser.nickname,
		deterministicAuthUser.password
	);

	await signOutThroughNicknameDemo(page);

	await recoverThroughNicknameDemo(page, {
		newPassword: deterministicAuthUser.recoveredPassword,
		nickname: deterministicAuthUser.nickname,
		recoveryKey
	});

	await page
		.locator('form[action="?/signIn"] input[name="nickname"]')
		.fill(deterministicAuthUser.nickname);
	await page
		.locator('form[action="?/signIn"] input[name="password"]')
		.fill(deterministicAuthUser.password);
	await page.getByRole('button', { name: 'Login with nickname' }).click();
	await expect(page.getByText('Invalid nickname or password')).toBeVisible();

	await signInThroughNicknameDemo(
		page,
		deterministicAuthUser.nickname,
		deterministicAuthUser.recoveredPassword
	);
});
