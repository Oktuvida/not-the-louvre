import { expect, type APIRequestContext } from '@playwright/test';
import type { Page } from '@playwright/test';
import { ARTWORK_MEDIA_MAX_BYTES } from '../../lib/server/artwork/config';
import {
	createAvifTestFile,
	createJpegTestFile,
	createMalformedAvifFile,
	createMalformedPngFile,
	createPngTestFile,
	createWebpTestFile
} from '../../lib/server/media/test-helpers';

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
	const response = await request.post('/demo/test-support/reset');
	expect(response.ok(), 'expected demo reset endpoint to succeed').toBe(true);
	return response;
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

export const installAvatarExportHarness = async (page: Page) => {
	const validAvatar = await createPngTestFile({ height: 256, name: 'avatar.png', width: 256 });
	const invalidAvatar = createMalformedPngFile();
	const validBase64 = Buffer.from(await validAvatar.arrayBuffer()).toString('base64');
	const invalidBase64 = Buffer.from(await invalidAvatar.arrayBuffer()).toString('base64');

	await page.addInitScript(
		({ bad, good }) => {
			Object.defineProperty(window, '__ntlBypassClientContentFilters', {
				configurable: true,
				value: true,
				writable: true
			});

			const decode = (value: string) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
			const originalToBlob = HTMLCanvasElement.prototype.toBlob;

			Object.defineProperty(window, '__avatarExportMode', {
				configurable: true,
				value: 'good',
				writable: true
			});

			HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
				if (type === 'image/png') {
					const mode = (window as Window & { __avatarExportMode?: string }).__avatarExportMode;

					if (mode === 'unsupported') {
						callback(null);
						return;
					}

					callback(
						new Blob([decode(mode === 'bad' ? bad : good)], {
							type: 'image/png'
						})
					);
					return;
				}

				originalToBlob.call(this, callback, type, quality);
			};
		},
		{ bad: invalidBase64, good: validBase64 }
	);
};

export const setAvatarExportMode = async (page: Page, mode: 'bad' | 'good' | 'unsupported') => {
	await page.evaluate((nextMode) => {
		(window as Window & { __avatarExportMode?: string }).__avatarExportMode = nextMode;
	}, mode);
};

export const installDrawingExportHarness = async (page: Page) => {
	const validWebp = await createWebpTestFile({ height: 1024, name: 'drawing.webp', width: 1024 });
	const validJpeg = await createJpegTestFile({ height: 1024, name: 'drawing.jpg', width: 1024 });
	const validPng = await createPngTestFile({ height: 1024, name: 'drawing.png', width: 1024 });
	const invalidBytes = createMalformedAvifFile();

	const payload = {
		bad: Buffer.from(await invalidBytes.arrayBuffer()).toString('base64'),
		jpeg: Buffer.from(await validJpeg.arrayBuffer()).toString('base64'),
		png: Buffer.from(await validPng.arrayBuffer()).toString('base64'),
		webp: Buffer.from(await validWebp.arrayBuffer()).toString('base64')
	};

	await page.addInitScript((assets) => {
		Object.defineProperty(window, '__ntlBypassClientContentFilters', {
			configurable: true,
			value: true,
			writable: true
		});

		const decode = (value: string) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
		const originalToBlob = HTMLCanvasElement.prototype.toBlob;

		Object.defineProperty(window, '__drawingExportMode', {
			configurable: true,
			value: 'webp',
			writable: true
		});

		HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
			const mode = (window as Window & { __drawingExportMode?: string }).__drawingExportMode;

			if (type === 'image/webp' || type === 'image/jpeg' || type === 'image/png') {
				if (mode === 'unsupported') {
					callback(null);
					return;
				}

				if (mode === 'bad') {
					callback(new Blob([decode(assets.bad)], { type }));
					return;
				}

				if (mode === 'jpeg') {
					if (type === 'image/webp') {
						callback(null);
						return;
					}
					if (type === 'image/jpeg') {
						callback(new Blob([decode(assets.jpeg)], { type }));
						return;
					}
				}

				if (mode === 'png') {
					if (type === 'image/webp' || type === 'image/jpeg') {
						callback(null);
						return;
					}
					if (type === 'image/png') {
						callback(new Blob([decode(assets.png)], { type }));
						return;
					}
				}

				if (mode === 'webp' && type === 'image/webp') {
					callback(new Blob([decode(assets.webp)], { type }));
					return;
				}
			}

			originalToBlob.call(this, callback, type, quality);
		};
	}, payload);
};

export const setDrawingExportMode = async (
	page: Page,
	mode: 'bad' | 'jpeg' | 'png' | 'unsupported' | 'webp'
) => {
	await page.evaluate((nextMode) => {
		(window as Window & { __drawingExportMode?: string }).__drawingExportMode = nextMode;
	}, mode);
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

export const createArtworkUpload = async () => {
	const file = await createAvifTestFile({
		height: 1024,
		name: 'journey-artwork.avif',
		width: 1024
	});

	return {
		buffer: Buffer.from(await file.arrayBuffer()),
		mimeType: file.type,
		name: file.name
	};
};

export const createDisguisedJpegUpload = async () => {
	const file = await createJpegTestFile({
		height: 1024,
		name: 'renamed-artwork.avif',
		width: 1024
	});

	return {
		buffer: Buffer.from(await file.arrayBuffer()),
		mimeType: 'image/avif',
		name: 'renamed-artwork.avif'
	};
};

export const createOversizedArtworkUpload = () => ({
	buffer: Buffer.from(new Uint8Array(ARTWORK_MEDIA_MAX_BYTES + 1)),
	mimeType: 'image/avif',
	name: 'oversized-artwork.avif'
});

export const publishArtworkThroughDemo = async (
	page: Page,
	input: {
		title?: string;
		upload?: Awaited<ReturnType<typeof createArtworkUpload>>;
	} = {}
) => {
	await page.goto('/demo/artwork-publish');
	await expect(page.getByText('Artwork demo state: authenticated')).toBeVisible();
	await page.getByLabel('Artwork title').fill(input.title ?? deterministicArtwork.title);
	await page
		.getByLabel('Artwork media')
		.setInputFiles(input.upload ?? (await createArtworkUpload()));
	await page.getByRole('button', { name: 'Publish artwork' }).click();
	await expect(page).toHaveURL(/\/demo\/artwork-publish\?published=/);
};

export const publishArtworkThroughRealtimeDemo = async (
	page: Page,
	input: {
		title?: string;
		upload?: Awaited<ReturnType<typeof createArtworkUpload>>;
	} = {}
) => {
	await page.goto('/demo/artwork-realtime-votes');
	await expect(page.getByText('Realtime vote demo state: authenticated')).toBeVisible();
	await page.getByLabel('Artwork title').fill(input.title ?? 'Realtime Gallery Study');
	await page
		.getByLabel('Artwork media')
		.setInputFiles(input.upload ?? (await createArtworkUpload()));
	await page.getByRole('button', { name: 'Publish tracked artwork' }).click();
	await expect(page).toHaveURL(/\/demo\/artwork-realtime-votes\?artworkId=/);

	const trackedArtworkText = await page.getByText(/Tracked artwork ID:/).textContent();
	const trackedArtworkId = trackedArtworkText?.split(': ').at(1)?.trim();
	if (!trackedArtworkId) {
		throw new Error('Tracked artwork ID was not rendered');
	}

	return trackedArtworkId;
};
