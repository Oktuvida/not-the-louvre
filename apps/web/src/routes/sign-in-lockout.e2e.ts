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
});
