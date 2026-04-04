import { expect, test } from '@playwright/test';
import {
	countDrawingPoints,
	createEmptyDrawingDocumentV2,
	flattenDrawingDocumentToV1,
	parseVersionedDrawingDocument,
	serializeDrawingDocument,
	type DrawingDocumentV2
} from '../lib/features/stroke-json/document';
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

type CapturedDrawingRequest = {
	drawingDocument: string | null;
	isNsfw: string | null;
	method: string;
	parentArtworkId: string | null;
	title: string | null;
	url: string;
};

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

const measureJsonBytes = (value: string) => new TextEncoder().encode(value).byteLength;

const installDrawingDocumentCaptureHarness = async (page: import('@playwright/test').Page) => {
	await page.addInitScript(() => {
		const originalFetch = window.fetch.bind(window);

		Object.defineProperty(window, '__capturedDrawingRequests', {
			configurable: true,
			value: [],
			writable: true
		});

		window.fetch = async (input, init) => {
			const url =
				typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
			const method = (
				init?.method ?? (input instanceof Request ? input.method : 'GET')
			).toUpperCase();
			const body = init?.body;

			if (body instanceof FormData && body.has('drawingDocument')) {
				const capturedRequest = {
					drawingDocument: body.get('drawingDocument')?.toString() ?? null,
					isNsfw: body.get('isNsfw')?.toString() ?? null,
					method,
					parentArtworkId: body.get('parentArtworkId')?.toString() ?? null,
					title: body.get('title')?.toString() ?? null,
					url
				};

				(
					window as Window & {
						__capturedDrawingRequests?: Array<{
							drawingDocument: string | null;
							isNsfw: string | null;
							method: string;
							parentArtworkId: string | null;
							title: string | null;
							url: string;
						}>;
					}
				).__capturedDrawingRequests ??= [];
				(
					window as Window & {
						__capturedDrawingRequests?: Array<{
							drawingDocument: string | null;
							isNsfw: string | null;
							method: string;
							parentArtworkId: string | null;
							title: string | null;
							url: string;
						}>;
					}
				).__capturedDrawingRequests?.push(capturedRequest);
			}

			return originalFetch(input, init);
		};
	});
};

const readCapturedDrawingRequests = async (
	page: import('@playwright/test').Page
): Promise<CapturedDrawingRequest[]> =>
	page.evaluate(() => {
		return ((window as Window & { __capturedDrawingRequests?: CapturedDrawingRequest[] })
			.__capturedDrawingRequests ?? []) as CapturedDrawingRequest[];
	});

const readDrawingDraftEntries = async (
	page: import('@playwright/test').Page,
	surface: 'artwork' | 'avatar'
) =>
	page.evaluate((targetSurface) => {
		return Object.keys(window.localStorage)
			.filter((key) => key.startsWith('drawing-draft:') && key.includes(`:${targetSurface}:`))
			.sort()
			.map((key) => ({ key, value: window.localStorage.getItem(key) }));
	}, surface);

const buildDenseStrokePath = (box: { height: number; width: number; x: number; y: number }) => {
	const verticalPattern = [0.24, 0.68, 0.34, 0.76, 0.44, 0.62];
	const vertexCount = 30;

	return Array.from({ length: vertexCount }, (_, index) => ({
		x: box.x + box.width * (0.12 + (0.76 * index) / (vertexCount - 1)),
		y: box.y + box.height * verticalPattern[index % verticalPattern.length]!
	}));
};

const drawRepeatedDenseStroke = async (
	page: import('@playwright/test').Page,
	canvas: import('@playwright/test').Locator,
	repetitionCount = 45
) => {
	const box = await canvas.boundingBox();
	if (!box) {
		throw new Error('Expected the drawing canvas to expose a bounding box');
	}

	const points = buildDenseStrokePath(box);
	const [startPoint, ...remainingPoints] = points;
	if (!startPoint) {
		throw new Error('Expected a non-empty drawing path');
	}

	for (let iteration = 0; iteration < repetitionCount; iteration += 1) {
		await page.mouse.move(startPoint.x, startPoint.y);
		await page.mouse.down();

		for (const point of remainingPoints) {
			await page.mouse.move(point.x, point.y, { steps: 1 });
		}

		await page.mouse.up();
	}
};

const createCompactionCandidateDraft = (
	surface: 'artwork' | 'avatar',
	strokeCount = 45,
	pointsPerStroke = 30
): DrawingDocumentV2 => {
	const document = createEmptyDrawingDocumentV2(surface);
	const verticalPattern = [0.24, 0.68, 0.34, 0.76, 0.44, 0.62];
	const points = Array.from({ length: pointsPerStroke }, (_, index) => {
		return [
			Math.round(document.width * (0.12 + (0.76 * index) / (pointsPerStroke - 1))),
			Math.round(document.height * verticalPattern[index % verticalPattern.length]!)
		] as [number, number];
	});

	return {
		...document,
		tail: Array.from({ length: strokeCount }, () => ({
			color: surface === 'avatar' ? '#6b8e7f' : '#2d2420',
			points,
			size: surface === 'avatar' ? 6 : 8
		}))
	};
};

const expectEditableV2Draft = (
	rawDraft: string,
	input: {
		expectedSurface: 'artwork' | 'avatar';
		expectedStrokeCount?: number;
		minStrokeCount?: number;
		minPointCount?: number;
	}
) => {
	const parsedDraft = parseVersionedDrawingDocument(rawDraft);
	expect(parsedDraft.version).toBe(2);
	if (parsedDraft.version !== 2) {
		throw new Error('Expected the draft to be stored as DrawingDocumentV2');
	}

	expect(parsedDraft.kind).toBe(input.expectedSurface);
	expect(parsedDraft.base).toEqual([]);
	if (typeof input.expectedStrokeCount === 'number') {
		expect(parsedDraft.tail).toHaveLength(input.expectedStrokeCount);
	}
	if (typeof input.minStrokeCount === 'number') {
		expect(parsedDraft.tail.length).toBeGreaterThanOrEqual(input.minStrokeCount);
	}
	if (typeof input.minPointCount === 'number') {
		expect(countDrawingPoints(parsedDraft)).toBeGreaterThanOrEqual(input.minPointCount);
	}

	return parsedDraft;
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

	test('avatar onboarding stores editable V2 drafts locally and publishes a compacted V2 payload smaller than V1', async ({
		page
	}) => {
		const strokeCount = 45;
		const seededAvatarDraft = createCompactionCandidateDraft('avatar', strokeCount);

		await enableReducedMotion(page);
		await installDrawingDocumentCaptureHarness(page);
		await installAvatarExportHarness(page);

		await openHomeAuthOverlay(page);
		await page.getByRole('button', { name: 'Sign up' }).click();
		await page.getByPlaceholder('artist_123').fill(deterministicAuthUser.nickname);
		await page.getByPlaceholder('Enter your password').fill(deterministicAuthUser.password);
		await page.getByRole('button', { name: 'Start account' }).click();
		await page.getByText('I Stored It').click();
		await expect(page.getByText('Finish your avatar')).toBeVisible();

		const avatarCanvas = page.locator('canvas[width="340"][height="340"]').first();
		await expect(avatarCanvas).toBeVisible();
		await drawRepeatedDenseStroke(page, avatarCanvas, 3);

		await expect
			.poll(
				async () => {
					const entries = await readDrawingDraftEntries(page, 'avatar');
					if (entries.length !== 1 || !entries[0]?.value) {
						return null;
					}

					const parsedDraft = parseVersionedDrawingDocument(entries[0].value);
					return parsedDraft.version;
				},
				{ timeout: 10000 }
			)
			.toBe(2);

		const avatarDraftEntries = await readDrawingDraftEntries(page, 'avatar');
		expect(avatarDraftEntries).toHaveLength(1);
		expect(avatarDraftEntries[0]?.key).toMatch(/^drawing-draft:v2:avatar:/);
		expect(avatarDraftEntries.some(({ key }) => key.startsWith('drawing-draft:v1:avatar:'))).toBe(
			false
		);

		const avatarDraftRaw = avatarDraftEntries[0]?.value;
		if (!avatarDraftRaw) {
			throw new Error('Expected the avatar draft to be persisted in localStorage');
		}

		const avatarStoredDraft = expectEditableV2Draft(avatarDraftRaw, {
			minStrokeCount: 1,
			expectedSurface: 'avatar'
		});
		expect(countDrawingPoints(avatarStoredDraft)).toBeGreaterThan(0);

		const seededAvatarDraftRaw = serializeDrawingDocument(seededAvatarDraft);
		await page.evaluate(
			({ key, value }) => {
				window.localStorage.setItem(key, value);
			},
			{ key: avatarDraftEntries[0]!.key, value: seededAvatarDraftRaw }
		);
		await page.reload();
		await expect(page.getByText('Finish your avatar')).toBeVisible();

		const avatarDraftDocument = expectEditableV2Draft(seededAvatarDraftRaw, {
			expectedStrokeCount: strokeCount,
			expectedSurface: 'avatar',
			minPointCount: 1000
		});
		const avatarOriginalV1Bytes = measureJsonBytes(
			serializeDrawingDocument(flattenDrawingDocumentToV1(avatarDraftDocument))
		);
		const avatarDraftBytes = measureJsonBytes(seededAvatarDraftRaw);

		await page.locator('button').filter({ hasText: 'Enter the gallery' }).click();
		await expectSignedInHomeChrome(page, deterministicAuthUser.nickname);

		const avatarRequests = await readCapturedDrawingRequests(page);
		expect(avatarRequests).toHaveLength(1);
		const avatarPayloadRaw = avatarRequests[0]?.drawingDocument;
		if (!avatarPayloadRaw) {
			throw new Error('Expected the avatar publish flow to send a drawing document');
		}

		const avatarPayloadDocument = parseVersionedDrawingDocument(avatarPayloadRaw);
		expect(avatarPayloadDocument.version).toBe(2);
		if (avatarPayloadDocument.version !== 2) {
			throw new Error('Expected the avatar publish payload to stay on DrawingDocumentV2');
		}

		expect(avatarPayloadDocument.kind).toBe('avatar');
		expect(avatarPayloadDocument.tail.length).toBeLessThan(avatarDraftDocument.tail.length);
		expect(countDrawingPoints(avatarPayloadDocument)).toBeLessThan(
			countDrawingPoints(avatarDraftDocument)
		);
		expect(measureJsonBytes(avatarPayloadRaw)).toBeLessThan(avatarDraftBytes);
		expect(measureJsonBytes(avatarPayloadRaw)).toBeLessThan(avatarOriginalV1Bytes);
		expect(avatarPayloadRaw).not.toBe(seededAvatarDraftRaw);
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

	test('draw route stores editable V2 drafts locally and publishes a compacted V2 payload smaller than V1', async ({
		page
	}) => {
		const strokeCount = 45;
		const seededArtworkDraft = createCompactionCandidateDraft('artwork', strokeCount);

		await installDrawingDocumentCaptureHarness(page);
		await installDrawingExportHarness(page);

		await page.goto('/demo/better-auth/login');
		await signUpThroughNicknameDemo(page);
		await page.goto('/draw');
		await openDrawSketchbook(page);

		const artworkCanvas = page.locator('canvas[width="768"][height="768"]').first();
		await expect(artworkCanvas).toBeVisible();
		await drawRepeatedDenseStroke(page, artworkCanvas, 3);

		await expect
			.poll(
				async () => {
					const entries = await readDrawingDraftEntries(page, 'artwork');
					if (entries.length !== 1 || !entries[0]?.value) {
						return null;
					}

					const parsedDraft = parseVersionedDrawingDocument(entries[0].value);
					return parsedDraft.version;
				},
				{ timeout: 10000 }
			)
			.toBe(2);

		const artworkDraftEntries = await readDrawingDraftEntries(page, 'artwork');
		expect(artworkDraftEntries).toHaveLength(1);
		expect(artworkDraftEntries[0]?.key).toMatch(/^drawing-draft:v2:artwork:/);
		expect(artworkDraftEntries.some(({ key }) => key.startsWith('drawing-draft:v1:artwork:'))).toBe(
			false
		);

		const artworkDraftRaw = artworkDraftEntries[0]?.value;
		if (!artworkDraftRaw) {
			throw new Error('Expected the artwork draft to be persisted in localStorage');
		}

		const storedArtworkDraft = expectEditableV2Draft(artworkDraftRaw, {
			minStrokeCount: 1,
			expectedSurface: 'artwork'
		});
		expect(countDrawingPoints(storedArtworkDraft)).toBeGreaterThan(0);

		const seededArtworkDraftRaw = serializeDrawingDocument(seededArtworkDraft);
		await page.evaluate(
			({ key, value }) => {
				window.localStorage.setItem(key, value);
			},
			{ key: artworkDraftEntries[0]!.key, value: seededArtworkDraftRaw }
		);
		await page.reload();
		await openDrawSketchbook(page);

		const artworkDraftDocument = expectEditableV2Draft(seededArtworkDraftRaw, {
			expectedStrokeCount: strokeCount,
			expectedSurface: 'artwork',
			minPointCount: 1000
		});
		const artworkOriginalV1Bytes = measureJsonBytes(
			serializeDrawingDocument(flattenDrawingDocumentToV1(artworkDraftDocument))
		);
		const artworkDraftBytes = measureJsonBytes(seededArtworkDraftRaw);

		await page.getByPlaceholder('Untitled genius').fill('Compacted Studio Piece');
		await page.getByRole('button', { name: 'Publish' }).click();
		await expect(page.getByText(/Artwork published as/)).toBeVisible();

		const artworkRequests = await readCapturedDrawingRequests(page);
		expect(artworkRequests).toHaveLength(1);
		const artworkPayloadRaw = artworkRequests[0]?.drawingDocument;
		if (!artworkPayloadRaw) {
			throw new Error('Expected the artwork publish flow to send a drawing document');
		}

		const artworkPayloadDocument = parseVersionedDrawingDocument(artworkPayloadRaw);
		expect(artworkPayloadDocument.version).toBe(2);
		if (artworkPayloadDocument.version !== 2) {
			throw new Error('Expected the artwork publish payload to stay on DrawingDocumentV2');
		}

		expect(artworkPayloadDocument.kind).toBe('artwork');
		expect(artworkPayloadDocument.tail.length).toBeLessThan(artworkDraftDocument.tail.length);
		expect(countDrawingPoints(artworkPayloadDocument)).toBeLessThan(
			countDrawingPoints(artworkDraftDocument)
		);
		expect(measureJsonBytes(artworkPayloadRaw)).toBeLessThan(artworkDraftBytes);
		expect(measureJsonBytes(artworkPayloadRaw)).toBeLessThan(artworkOriginalV1Bytes);
		expect(artworkPayloadRaw).not.toBe(seededArtworkDraftRaw);
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
		await expect(
			page.getByRole('dialog', { name: new RegExp(`Artwork details for ${publishedTitle!}`) })
		).toBeVisible();
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
		await expect(
			page.getByRole('dialog', { name: /Artwork details for Realtime Product Piece/ })
		).toBeVisible();
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
			await expect(
				actorPage.getByRole('dialog', { name: /Artwork details for Realtime Product Piece/ })
			).toBeVisible();

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
			await actorPage.getByPlaceholder('Write a comment').fill('Realtime hello');
			await actorPage.getByRole('button', { name: 'Send comment' }).click();
			await commentResponse;

			await expect
				.poll(async () => await page.getByText('Realtime hello').count(), { timeout: 10000 })
				.toBeGreaterThan(0);
		} finally {
			await actorContext.close();
		}

		await page.reload();
		await page.getByRole('button', { name: /Realtime Product Piece/ }).click();
		await expect(
			page.getByRole('dialog', { name: /Artwork details for Realtime Product Piece/ })
		).toBeVisible();
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
		await expect(
			page.getByRole('dialog', { name: /Artwork details for Mystery Comment Piece/ })
		).toBeVisible();
		const commentResponse = page.waitForResponse(
			(response) =>
				response.url().includes('/comments') &&
				response.request().method() === 'POST' &&
				response.status() === 201
		);
		await page.getByPlaceholder('Write a comment').fill('Mystery room comment');
		await page.getByRole('button', { name: 'Send comment' }).click();
		await commentResponse;
		await expect(page.getByText('Mystery room comment')).toBeVisible();
		await page.getByRole('dialog').press('Escape');

		await page.goto('/gallery/mystery');
		await page.getByRole('button', { name: 'Spin!' }).click();

		await expect(
			page.getByRole('dialog', { name: /Artwork details for Mystery Comment Piece/ })
		).toBeVisible({
			timeout: 8000
		});
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

	test.skip('hot wall promotes a live artwork and still opens its detail view', async ({
		page
	}) => {
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
		await expect(
			page.getByRole('dialog', { name: /Artwork details for Hot Wall Piece/ })
		).toBeVisible();
	});

	test('unknown routes render the custom not-found page', async ({ page }) => {
		await page.goto('/totally-made-up-room');

		await expect(page.getByRole('heading', { name: 'Oops! This Canvas is Blank' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Go Home' })).toBeVisible();
	});
});
