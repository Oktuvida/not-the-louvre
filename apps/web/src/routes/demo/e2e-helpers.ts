import { expect, type APIRequestContext } from '@playwright/test';
import { createEmptyDrawingDocument } from '../../lib/features/stroke-json/document';
import type { Page } from '@playwright/test';

export const deterministicAuthUser = {
	nickname: 'journey_artist',
	password: 'password123',
	recoveredPassword: 'newpassword123'
} as const;

export const deterministicActorUser = {
	nickname: 'journey_viewer',
	password: 'password123',
	recoveredPassword: 'newpassword123'
} as const;

export const deterministicArtwork = {
	title: 'Deterministic Gallery Study'
} as const;

export const resetDemoState = async (request: APIRequestContext) => {
	// A body makes this a JSON request: SvelteKit 3 refuses body-less cross-site
	// POSTs as if they were form submissions.
	const response = await request.post('/demo/test-support/reset', { data: {} });
	expect(response.ok(), 'expected demo reset endpoint to succeed').toBe(true);
	return response;
};

/**
 * Signs up and publishes a one-stroke artwork through the product actions,
 * then reads its id back from the gallery the way a visitor would find it.
 */
export const publishArtworkThroughActions = async (
	request: APIRequestContext,
	baseURL: string | undefined,
	options: { isNsfw?: boolean; title: string }
) => {
	const { nickname, password } = deterministicAuthUser;
	const headers = { origin: baseURL ?? '', 'x-sveltekit-action': 'true' };
	await request.post('/?/signUp', { form: { nickname, password }, headers });

	const published = await request.post('/draw?/publish', {
		form: {
			drawingDocument: JSON.stringify({
				...createEmptyDrawingDocument('artwork'),
				strokes: [
					{
						color: '#2d2420',
						points: [
							[120, 120],
							[640, 640]
						],
						size: 12
					}
				]
			}),
			isNsfw: options.isNsfw ? 'true' : 'false',
			title: options.title
		},
		headers
	});
	expect(await published.json()).toMatchObject({ type: 'success' });

	const gallery = await (await request.get('/gallery/your-studio')).text();
	const id = /\/api\/artworks\/([^/"]+)\/media/.exec(gallery)?.[1];
	if (!id) throw new Error('The published artwork is not in the studio room');
	return id;
};

export const openNicknameAuthDemo = async (page: Page) => {
	await page.goto('/demo/better-auth/login');
	await expect(page.getByText('Authentication demo state: signed out')).toBeVisible();
};

export const openHomeAuthOverlay = async (page: Page) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'Come In' }).click();
	await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
};

export const readVisibleOneTimeKey = async (page: Page) => {
	const recoveryKey = await page.locator('p.font-mono').textContent();
	if (!recoveryKey) {
		throw new Error('One-time recovery key was not rendered');
	}

	return recoveryKey.trim();
};

export const checkNicknameAvailability = async (page: Page, nickname: string) => {
	await page.getByLabel('Check nickname availability').fill(nickname);
	await page.getByRole('button', { name: 'Check nickname' }).click();
	return page.getByText(/Nickname status:/);
};

export const signUpThroughNicknameDemo = async (
	page: Page,
	credentials: { nickname: string; password: string } = deterministicAuthUser
) => {
	await page.locator('form[action="?/signIn"] input[name="nickname"]').fill(credentials.nickname);
	await page.locator('form[action="?/signIn"] input[name="password"]').fill(credentials.password);
	await page.getByRole('button', { name: 'Register' }).click();

	await expect(page).toHaveURL(/\/demo\/better-auth\?recoveryKey=/);
	await expect(page.getByText(`Signed in as: ${credentials.nickname}`)).toBeVisible();

	const recoveryKeyText = await page.getByText(/New recovery key:/).textContent();
	const recoveryKey = recoveryKeyText?.split(': ').at(1)?.trim();
	if (!recoveryKey) {
		throw new Error('Recovery key was not rendered');
	}

	return recoveryKey;
};

export const signOutThroughNicknameDemo = async (page: Page) => {
	await page.getByRole('button', { name: 'Sign out' }).click();
	await expect(page).toHaveURL(/\/demo\/better-auth\/login/);
	await expect(page.getByText('Authentication demo state: signed out')).toBeVisible();
};

export const signInThroughNicknameDemo = async (page: Page, nickname: string, password: string) => {
	await page.locator('form[action="?/signIn"] input[name="nickname"]').fill(nickname);
	await page.locator('form[action="?/signIn"] input[name="password"]').fill(password);
	await page.getByRole('button', { name: 'Login with nickname' }).click();
	await expect(page).toHaveURL(/\/demo\/better-auth$/);
	await expect(page.getByText(`Signed in as: ${nickname}`)).toBeVisible();
};

export const recoverThroughNicknameDemo = async (
	page: Page,
	input: { newPassword: string; nickname: string; recoveryKey: string }
) => {
	await page.locator('input[name="recoveryNickname"]').fill(input.nickname);
	await page.locator('input[name="recoveryKey"]').fill(input.recoveryKey);
	await page.locator('input[name="newPassword"]').fill(input.newPassword);
	await page.getByRole('button', { name: 'Recover account' }).click();
	await expect(page.getByText('Rotated recovery key:')).toBeVisible();
};
