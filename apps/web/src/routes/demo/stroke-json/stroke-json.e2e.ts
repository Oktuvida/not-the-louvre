import { expect, test } from '@playwright/test';

test('draws on the stroke-json demo and runs bitmap and json clone experiments', async ({
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
	await expect(page.getByTestId('total-points')).not.toHaveText('0');
	await expect(page.getByTestId('json-gzip-bytes')).not.toHaveText('0');
	await expect(page.getByTestId('original-export-bytes')).not.toHaveText('0');

	await page.getByRole('button', { name: 'Run 20x bitmap clone' }).click();
	await page.getByRole('button', { name: 'Run 20x JSON clone' }).click();

	await expect(page.getByText(/Final bitmap clone preview/)).toBeVisible();
	await expect(page.getByText(/Final JSON clone preview/)).toBeVisible();
	await expect(page.getByText(/Original export bytes:/)).toBeVisible();
	await expect(page.getByText(/Original export format:/)).toBeVisible();
	await expect(page.getByText(/JSON raw bytes:/)).toBeVisible();
	await expect(page.getByText(/JSON gzip bytes:/)).toBeVisible();
	await expect(page.getByText(/Bitmap diff pixels:/)).toBeVisible();
	await expect(page.getByText(/JSON diff pixels:/)).toBeVisible();
	await expect(page.getByTestId('bitmap-clone-bytes')).not.toHaveText('Pending');
	await expect(page.getByTestId('json-clone-bytes')).not.toHaveText('Pending');
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
