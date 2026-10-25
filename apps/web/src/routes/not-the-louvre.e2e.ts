import { expect, test } from '@playwright/test';
import {
	getRenderableDrawingStrokes,
	parseVersionedDrawingDocument
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
	// The studio ignores strokes until the book has opened and the draft has
	// loaded; the title field unlocks at the same moment.
	await expect(page.getByPlaceholder('Untitled genius')).toBeEnabled();
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
	page.getByLabel('Drawing canvas').evaluate((node) => {
		const canvas = node as HTMLCanvasElement;
		const context = canvas.getContext('2d');
		if (!context) {
			throw new Error('Expected the draw canvas to expose a 2D context');
		}

		return Array.from(
			context.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data
		);
	});

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
	page.evaluate(async (targetSurface) => {
		const openDatabase = () =>
			new Promise<IDBDatabase>((resolve, reject) => {
				const request = indexedDB.open('drawing-drafts');
				request.onsuccess = () => resolve(request.result);
				request.onerror = () =>
					reject(request.error ?? new Error('Failed to open drawing drafts database'));
			});

		const waitForRequest = <T>(request: IDBRequest<T>) =>
			new Promise<T>((resolve, reject) => {
				request.onsuccess = () => resolve(request.result);
				request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
			});

		const waitForTransaction = (transaction: IDBTransaction) =>
			new Promise<void>((resolve, reject) => {
				transaction.oncomplete = () => resolve();
				transaction.onabort = () =>
					reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
				transaction.onerror = () =>
					reject(transaction.error ?? new Error('IndexedDB transaction failed'));
			});

		const database = await openDatabase();

		try {
			const snapshotTransaction = database.transaction(['snapshots'], 'readonly');
			const snapshotRecords = (await waitForRequest(
				snapshotTransaction.objectStore('snapshots').getAll()
			)) as Array<{ document: Record<string, unknown>; draftKey: string }>;
			await waitForTransaction(snapshotTransaction);

			const entries: Array<{ key: string; value: string }> = [];

			for (const snapshotRecord of snapshotRecords
				.filter((record) => record.draftKey.includes(`:${targetSurface}:`))
				.sort((left, right) => left.draftKey.localeCompare(right.draftKey))) {
				const journalTransaction = database.transaction(['journal'], 'readonly');
				const journalIndex = journalTransaction.objectStore('journal').index('by-draft-sequence');
				const range = IDBKeyRange.bound(
					[snapshotRecord.draftKey, 0],
					[snapshotRecord.draftKey, Number.MAX_SAFE_INTEGER]
				);
				const journalRecords = (await waitForRequest(journalIndex.getAll(range))) as Array<{
					stroke: Record<string, unknown>;
				}>;
				await waitForTransaction(journalTransaction);

				const hydratedDocument = JSON.parse(JSON.stringify(snapshotRecord.document)) as {
					tail?: Array<Record<string, unknown>>;
				};
				if (Array.isArray(hydratedDocument.tail)) {
					for (const journalRecord of journalRecords) {
						hydratedDocument.tail.push(journalRecord.stroke);
					}
				}

				entries.push({
					key: snapshotRecord.draftKey,
					value: JSON.stringify(hydratedDocument)
				});
			}

			return entries;
		} finally {
			database.close();
		}
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

	test('home route stays usable while the studio GLB is still loading', async ({ page }) => {
		await page.route('**/models/studio-transformed.glb', async () => {
			await new Promise(() => {});
		});

		await page.goto('/');

		await expect(page.getByText(/Loading Studio(\.\.\.|…)/)).toBeVisible();
		await expect(page.getByRole('button', { name: 'Come In' })).toBeVisible();
		await page.getByRole('button', { name: 'Come In' }).click();
		await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
	});

	// Old phones, blocklisted GPUs and browsers with WebGL turned off cannot give
	// three.js a context. The 3D studio is decoration; signing in is not.
	test('home route still lets visitors sign in when the browser has no WebGL', async ({ page }) => {
		await page.addInitScript(() => {
			const getContext = HTMLCanvasElement.prototype.getContext;
			HTMLCanvasElement.prototype.getContext = function (
				this: HTMLCanvasElement,
				type: string,
				...rest: unknown[]
			) {
				if (type.startsWith('webgl') || type === 'experimental-webgl') return null;
				return (getContext as (...args: unknown[]) => unknown).call(this, type, ...rest);
			} as typeof getContext;
		});

		await page.goto('/');

		await expect(page.getByText('Scene preview paused')).toBeVisible();
		await page.getByRole('button', { name: 'Come In' }).click();
		await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
	});

	test('home route keeps the localized scene fallback when the studio GLB fails', async ({
		page
	}) => {
		await page.route('**/models/studio-transformed.glb', async (route) => {
			await route.abort();
		});

		await page.goto('/');

		await expect(page.getByText(/Loading Studio(\.\.\.|…)/)).toBeVisible();
		await expect(page.getByRole('button', { name: 'Come In' })).toBeVisible();
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

	// Publish used to "compact" the drawing and drop strokes hidden under later
	// ones, erasing the history a timelapse needs. Three passes over the same path
	// are exactly what it dropped.
	test('avatar onboarding publishes every stroke the visitor drew', async ({ page }) => {
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

		const avatarCanvas = page.getByLabel('Avatar drawing canvas');
		// The pad takes strokes once the local draft has loaded.
		await expect(avatarCanvas).toHaveAttribute('aria-disabled', 'false');
		await drawRepeatedDenseStroke(page, avatarCanvas, 3);

		await page.locator('button').filter({ hasText: 'Enter the gallery' }).click();
		await expectSignedInHomeChrome(page, deterministicAuthUser.nickname);

		const [request] = await readCapturedDrawingRequests(page);
		const published = parseVersionedDrawingDocument(request?.drawingDocument ?? '');
		expect(published.kind).toBe('avatar');
		expect(getRenderableDrawingStrokes(published)).toHaveLength(3);
	});

	test('draw route keeps the drawing across a reload and publishes every stroke', async ({
		page
	}) => {
		await installDrawingDocumentCaptureHarness(page);
		await installDrawingExportHarness(page);

		await page.goto('/demo/better-auth/login');
		await signUpThroughNicknameDemo(page);
		await page.goto('/draw');
		await openDrawSketchbook(page);

		const artworkCanvas = page.getByLabel('Drawing canvas');
		await expect(artworkCanvas).toBeVisible();
		await drawRepeatedDenseStroke(page, artworkCanvas, 3);
		// The local draft is written shortly after each stroke; reload only once it
		// holds all three.
		await expect
			.poll(async () => {
				// The store also keeps an untouched baseline snapshot next to the draft.
				const draft = (await readDrawingDraftEntries(page, 'artwork')).find(
					({ key }) => !key.startsWith('baseline:')
				);
				return draft
					? getRenderableDrawingStrokes(parseVersionedDrawingDocument(draft.value)).length
					: 0;
			})
			.toBe(3);

		await page.reload();
		await openDrawSketchbook(page);
		await page.getByPlaceholder('Untitled genius').fill('Every Stroke Piece');
		await page.getByRole('button', { name: 'Publish' }).click();
		await expect(page.getByText(/Artwork published as/)).toBeVisible();

		const [request] = await readCapturedDrawingRequests(page);
		const published = parseVersionedDrawingDocument(request?.drawingDocument ?? '');
		expect(published.kind).toBe('artwork');
		expect(getRenderableDrawingStrokes(published)).toHaveLength(3);
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
		await expect(page.getByRole('link', { name: 'See it on the wall' })).toHaveAttribute(
			'href',
			'/gallery/your-studio'
		);
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

	test('gallery browser back closes locally opened artwork detail before leaving the room', async ({
		page
	}) => {
		await installDrawingExportHarness(page);

		await page.goto('/demo/better-auth/login');
		await signUpThroughNicknameDemo(page);
		await page.goto('/draw');
		await openDrawSketchbook(page);
		await page.getByPlaceholder('Untitled genius').fill('History Close Piece');
		await page.getByRole('button', { name: 'Publish' }).click();
		await expect(page.getByText(/Artwork published as/)).toBeVisible();

		await page.setViewportSize({ height: 844, width: 390 });
		await page.goto('/gallery/your-studio');
		await page.getByRole('button', { name: /History Close Piece/ }).click();
		await expect(
			page.getByRole('dialog', { name: /Artwork details for History Close Piece/ })
		).toBeVisible();

		await page.goBack();

		await expect(page).toHaveURL(/\/gallery\/your-studio$/);
		await expect(
			page.getByRole('dialog', { name: /Artwork details for History Close Piece/ })
		).not.toBeVisible();
		await expect(page.getByRole('button', { name: /History Close Piece/ })).toBeVisible();
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
			// The visitor's book is on the back of the postcard.
			await actorPage.getByRole('button', { name: 'Read the comments' }).click();
			await actorPage.getByPlaceholder('Write a comment').fill('Realtime hello');
			await actorPage.getByRole('button', { name: 'Send comment' }).click();
			await commentResponse;

			await expect
				.poll(async () => await page.getByText('Realtime hello').count(), { timeout: 10000 })
				.toBeGreaterThan(0);
		} finally {
			await actorContext.close();
		}

		// The open artwork owns the address bar, so a reload lands on its
		// permalink with the postcard already open.
		await page.reload();
		await expect(page).toHaveURL(/\/artwork\/[^/]+$/);
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
		// The visitor's book is on the back of the postcard.
		await page.getByRole('button', { name: 'Read the comments' }).click();
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
		await page.getByRole('button', { name: 'Read the comments' }).click();
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

	test('successful fork publish exits fork mode so draw again and reload stay empty', async ({
		page
	}) => {
		await installDrawingExportHarness(page);

		await page.goto('/demo/better-auth/login');
		await signUpThroughNicknameDemo(page);
		await page.goto('/draw');
		await openDrawSketchbook(page);
		await setDrawingExportMode(page, 'webp');
		await page.getByPlaceholder('Untitled genius').fill('Fork Reset Source');
		await page.getByRole('button', { name: 'Publish' }).click();
		await expect(page.getByText(/Artwork published as/)).toBeVisible();

		await page.goto('/gallery/your-studio');
		await page.getByRole('button', { name: /Fork Reset Source/ }).click();
		await page.getByRole('dialog').getByRole('button', { name: 'Fork' }).click();

		await expect(page).toHaveURL(/\/draw\?fork=/);
		await expect(page.getByRole('button', { name: 'Publish' })).toBeVisible();
		await expect(page.getByText('Forking Fork Reset Source')).toBeVisible();

		const forkArtworkId = new URL(page.url()).searchParams.get('fork');
		if (!forkArtworkId) {
			throw new Error('Expected the fork route to expose an artwork id in the query string');
		}

		await page.getByPlaceholder('Untitled genius').fill('Fork Reset Child');
		await page.getByRole('button', { name: 'Publish' }).click();
		await expect(page.getByText(/Artwork published as/)).toBeVisible();
		await expect(page).toHaveURL(/\/draw$/);
		await expect(page.getByText('Forking Fork Reset Source')).not.toBeVisible();
		await expect
			.poll(async () =>
				(await readDrawingDraftEntries(page, 'artwork')).some(({ key }) =>
					key.endsWith(`:${forkArtworkId}`)
				)
			)
			.toBe(false);
		expect(
			await page.evaluate(() =>
				Object.keys(window.localStorage).filter((key) => key.startsWith('studio-fork-context:'))
			)
		).toEqual([]);

		await page.getByRole('button', { name: 'Draw again' }).click();
		await expect(page.getByRole('button', { name: 'Publish' })).toBeVisible();
		await expect(page).toHaveURL(/\/draw$/);
		await expect(page.getByText('Forking Fork Reset Source')).not.toBeVisible();
		await expect.poll(() => readDrawingCanvasCenterPixel(page)).toEqual([253, 251, 247, 255]);

		await page.reload();
		await expect(page).toHaveURL(/\/draw$/);
		await expect(page.getByRole('button', { name: 'Open sketchbook' })).toBeVisible();
		await openDrawSketchbook(page);
		await expect(page.getByText('Forking Fork Reset Source')).not.toBeVisible();
		await expect.poll(() => readDrawingCanvasCenterPixel(page)).toEqual([253, 251, 247, 255]);
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
