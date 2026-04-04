import { expect, test } from '@playwright/test';
import { encodeCompressedDrawingDocument } from '../../../lib/features/stroke-json/storage';

const compressedArtworkPayload = encodeCompressedDrawingDocument({
	background: '#fdfbf7',
	height: 768,
	kind: 'artwork',
	strokes: [
		{
			color: '#2d2420',
			points: [
				[48, 48],
				[120, 120],
				[220, 180]
			],
			size: 6
		},
		{
			color: '#c84f4f',
			points: [
				[280, 160],
				[360, 220],
				[420, 260]
			],
			size: 10
		}
	],
	version: 1,
	width: 768
});

test('draws on the stroke-json demo and runs bitmap, json clone, and raster oracle experiments', async ({
	page
}) => {
	await page.goto('/demo/stroke-json');

	await expect(page.getByRole('heading', { name: 'Stroke JSON Lab' })).toBeVisible();

	const canvas = page.locator('canvas').first();
	await expect(canvas).toBeVisible();

	const box = await canvas.boundingBox();
	if (!box) {
		throw new Error('Expected the stroke demo canvas to expose a bounding box');
	}

	await page.mouse.move(box.x + 40, box.y + 40);
	await page.mouse.down();
	await page.mouse.move(box.x + 120, box.y + 110, { steps: 6 });
	await page.mouse.move(box.x + 180, box.y + 180, { steps: 6 });
	await page.mouse.up();

	await expect(page.getByTestId('stroke-count')).toHaveText('1');
	await expect(page.getByTestId('document-version')).toHaveText('2');
	await expect(page.getByTestId('base-stroke-count')).toHaveText('0');
	await expect(page.getByTestId('tail-stroke-count')).toHaveText('1');
	await expect(page.getByTestId('total-points')).not.toHaveText('0');
	await expect(page.getByTestId('json-gzip-bytes')).not.toHaveText('0');
	await expect(page.getByTestId('original-export-bytes')).not.toHaveText('0');

	await page.getByRole('button', { name: 'Run 20x bitmap clone' }).click();
	await page.getByRole('button', { name: 'Run 20x JSON clone' }).click();
	await page.getByLabel('Raster guard preset').selectOption('conservative');
	await page.getByRole('button', { name: 'Run exact raster oracle' }).click();
	await page.getByRole('button', { name: 'Run 20x prod-like pipeline' }).click();

	await expect(page.getByText(/Final bitmap clone preview/)).toBeVisible();
	await expect(page.getByText(/Final JSON clone preview/)).toBeVisible();
	await expect(page.getByText(/Raster oracle preview/)).toBeVisible();
	await expect(page.getByText(/Prod-like pipeline preview/)).toBeVisible();
	await expect(page.getByText(/Original export bytes:/)).toBeVisible();
	await expect(page.getByText(/Original export format:/)).toBeVisible();
	await expect(page.getByText(/JSON raw bytes:/)).toBeVisible();
	await expect(page.getByText(/JSON gzip bytes:/)).toBeVisible();
	await expect(page.getByText(/Bitmap diff pixels:/)).toBeVisible();
	await expect(page.getByText(/JSON diff pixels:/)).toBeVisible();
	await expect(page.getByText(/Exact raster oracle/)).toBeVisible();
	await expect(page.getByText(/Runs 20 chained passes of/)).toBeVisible();
	await expect(page.getByRole('button', { name: 'Run lossless compaction' })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Run phase 1 comparison' })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Run phase 2 benchmark' })).toHaveCount(0);
	await expect(page.getByText(/Phase 1 benchmark/)).toHaveCount(0);
	await expect(page.getByText(/Phase 2 benchmark/)).toHaveCount(0);
	await expect(page.getByLabel('simplify-js high quality')).toHaveCount(0);
	await expect(page.getByTestId('bitmap-clone-bytes')).not.toHaveText('Pending');
	await expect(page.getByTestId('json-clone-bytes')).not.toHaveText('Pending');
	await expect(page.getByTestId('raster-oracle-selected-preset')).toHaveText(/Conservative/i);
	await expect(page.getByTestId('raster-oracle-max-stroke-area')).not.toHaveText('Pending');
	await expect(page.getByTestId('raster-oracle-guarded-stroke-count')).not.toHaveText('Pending');
	await expect(page.getByTestId('raster-oracle-final-diff-pixels')).not.toHaveText('Pending');
	await expect(page.getByTestId('raster-oracle-final-raw-bytes')).not.toHaveText('Pending');
	await expect(page.getByTestId('raster-oracle-final-gzip-bytes')).not.toHaveText('Pending');
	await expect(page.getByTestId('raster-oracle-final-stroke-count')).not.toHaveText('Pending');
	await expect(page.getByTestId('raster-oracle-final-point-count')).not.toHaveText('Pending');
	await expect(page.getByTestId('prod-like-phase2-max-stroke-area')).not.toHaveText('Unlimited');
	await expect(page.getByTestId('prod-like-final-diff-pixels')).not.toHaveText('Pending');
	await expect(page.getByTestId('prod-like-final-raw-bytes')).not.toHaveText('Pending');
	await expect(page.getByTestId('prod-like-final-gzip-bytes')).not.toHaveText('Pending');
	await expect(page.getByTestId('prod-like-total-duration-ms')).not.toHaveText('Pending');
	await expect(page.getByTestId('prod-like-final-duration-ms')).not.toHaveText('Pending');
	await expect(page.getByTestId('prod-like-iteration-row')).toHaveCount(20);
	expect(
		Number(await page.getByTestId('prod-like-final-diff-pixels').textContent())
	).toBeGreaterThanOrEqual(0);
	await expect(page.getByTestId('prod-like-final-stroke-count')).not.toHaveText('Pending');
	await expect(page.getByTestId('prod-like-final-point-count')).not.toHaveText('Pending');
});

test('does not keep growing the stroke document while the pointer is outside the canvas', async ({
	page
}) => {
	await page.goto('/demo/stroke-json');

	const canvas = page.locator('canvas').first();
	await expect(canvas).toBeVisible();

	const box = await canvas.boundingBox();
	if (!box) {
		throw new Error('Expected the stroke demo canvas to expose a bounding box');
	}

	await page.mouse.move(box.x + 40, box.y + 40);
	await page.mouse.down();
	await page.mouse.move(box.x + 100, box.y + 100, { steps: 6 });

	await page.mouse.move(box.x - 40, box.y + 100);

	const pointsWhileOutside = Number(await page.getByTestId('total-points').textContent());
	const strokesWhileOutside = Number(await page.getByTestId('stroke-count').textContent());

	await page.mouse.move(box.x - 120, box.y + 120, { steps: 8 });

	await expect(page.getByTestId('total-points')).toHaveText(String(pointsWhileOutside));
	await expect(page.getByTestId('stroke-count')).toHaveText(String(strokesWhileOutside));

	await page.mouse.move(box.x + 140, box.y + 140, { steps: 8 });
	await page.mouse.up();

	await expect(page.getByTestId('stroke-count')).toHaveText(String(strokesWhileOutside + 1));
	await expect(page.getByTestId('total-points')).not.toHaveText(String(pointsWhileOutside));
	await expect(page.getByTestId('json-raw-bytes')).not.toHaveText('0');
	await expect(page.getByTestId('json-gzip-bytes')).not.toHaveText('0');
});

test('loads a compressed artwork payload into the lab', async ({ page }) => {
	await page.goto('/demo/stroke-json');

	await page.getByLabel('Compressed drawing payload').fill(compressedArtworkPayload);
	await page.getByRole('button', { name: 'Load compressed payload' }).click();

	await expect(page.getByTestId('document-version')).toHaveText('2');
	await expect(page.getByTestId('base-stroke-count')).toHaveText('0');
	await expect(page.getByTestId('tail-stroke-count')).toHaveText('2');
	await expect(page.getByTestId('stroke-count')).toHaveText('2');
	await expect(page.getByTestId('total-points')).toHaveText('6');
	await expect(page.getByTestId('json-raw-bytes')).not.toHaveText('0');
	await expect(page.getByTestId('json-gzip-bytes')).not.toHaveText('0');
	await expect(page.getByText(/Original drawing preview/)).toBeVisible();
	await expect(page.getByLabel('Compressed drawing payload')).toHaveValue(compressedArtworkPayload);
});
