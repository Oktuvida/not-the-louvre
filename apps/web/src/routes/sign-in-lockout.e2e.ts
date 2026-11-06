import { expect, test } from '@playwright/test';
import {
	deterministicAuthUser,
	openNicknameAuthDemo,
	resetDemoState,
	signUpThroughNicknameDemo
} from './demo/e2e-helpers';

test.describe('sign-in lockout', () => {
	test.beforeEach(async ({ request }) => {
		await resetDemoState(request);
	});

	test('a visitor who keeps mistyping is told why every time, and told to wait once locked out', async ({
		page
	}) => {
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await page.goto('/');
		await page.getByRole('button', { name: 'Come In' }).click();
		await page.getByPlaceholder('artist_123').fill('nobody_here');
		await page.getByPlaceholder('Enter your password').fill('not-the-password');
		const signIn = page.getByRole('button', { name: /^sign in$/i });
		const wrong = page.getByText("That nickname and password don't match.");

		// Every wrong guess says so, the second as clearly as the first: the same
		// answer twice is still an answer.
		for (let guess = 1; guess <= 4; guess++) {
			await signIn.click();
			await expect(wrong).toBeVisible();
		}

		// The fifth trips the block, and every try after it says to wait.
		for (let attempt = 1; attempt <= 2; attempt++) {
			await signIn.click();
			await expect(page.getByText(/too many|try again/i)).toBeVisible();
		}
	});

	test('a visitor who forges X-Forwarded-For on every attempt is still locked out', async ({
		baseURL,
		page,
		request
	}) => {
		await openNicknameAuthDemo(page);
		await signUpThroughNicknameDemo(page);

		// Anyone can send X-Forwarded-For, so a fresh value per guess must not buy a
		// fresh allowance of guesses.
		const signIn = async (password: string, forgedAddress: string) => {
			const response = await request.post('/?/signIn', {
				form: { nickname: deterministicAuthUser.nickname, password },
				headers: {
					origin: baseURL ?? '',
					'x-forwarded-for': forgedAddress,
					'x-sveltekit-action': 'true'
				}
			});
			return response.json();
		};

		for (let guess = 1; guess <= 4; guess++) {
			expect(await signIn('not-the-password', `203.0.113.${guess}`)).toMatchObject({
				type: 'failure',
				status: 401
			});
		}

		// The fifth failure trips the block, and the block holds even for the
		// right password.
		expect(await signIn('not-the-password', '203.0.113.5')).toMatchObject({
			type: 'failure',
			status: 429
		});
		expect(await signIn(deterministicAuthUser.password, '203.0.113.6')).toMatchObject({
			type: 'failure',
			status: 429
		});
	});

	test("a locked-out visitor cannot sign in through Better Auth's own endpoint instead", async ({
		baseURL,
		request
	}) => {
		const { nickname, password } = deterministicAuthUser;
		const headers = { origin: baseURL ?? '', 'x-sveltekit-action': 'true' };
		const post = async (action: string, form: Record<string, string>) =>
			(await request.post(`/?/${action}`, { form, headers })).json();

		expect(await post('signUp', { nickname, password })).toMatchObject({ type: 'success' });
		let lastGuess: unknown;
		for (let guess = 1; guess <= 5; guess++) {
			lastGuess = await post('signIn', { nickname, password: 'not-the-password' });
		}
		expect(lastGuess).toMatchObject({ type: 'failure', status: 429 });

		// Better Auth answers on the configured ORIGIN, as production does, and the
		// e2e server is configured with 127.0.0.1.
		const origin = new URL(baseURL ?? '').origin.replace('localhost', '127.0.0.1');
		const response = await request.post(`${origin}/api/auth/sign-in/username`, {
			data: { username: nickname, password },
			headers: { origin }
		});

		expect(response.ok()).toBe(false);
		expect(response.headers()['set-cookie'] ?? '').not.toContain('session_token');
	});
});
