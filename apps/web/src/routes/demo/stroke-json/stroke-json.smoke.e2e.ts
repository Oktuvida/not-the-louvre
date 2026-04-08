import { expect, test } from '@playwright/test';

const compressedArtworkPayload =
	'H4sIALTX0WkAA02N0QqDMAxF/yV7zUPNipb+ivShWqtFsaPtJkz898Uxhg+Bm3DuyQ6vIeUQV9CEMIfVgQabyhbTDAhbcGUC3dQKYRrCOJXf0tl+HlN8fvmbd77zDfOdzQPo1iAUGxZOO/RxiemEyJEkwVAOb4ZqhEcMa8lMtVKhVAbbigTycKIzKWHMgRdHr6SX/u+oxFVCiiv1Wb7XAlnAiT8i8c0c5vgAmIUvjewAAAA=';

test('initializes the browser worker-backed stroke-json runtime from the built demo route', async ({
	page
}) => {
	await page.goto('/demo/stroke-json');
	await expect(page.getByRole('heading', { name: 'Stroke JSON Lab' })).toBeVisible();

	const workerPromise = page.waitForEvent('worker');

	await page.getByLabel('Compressed drawing payload').fill(compressedArtworkPayload);
	await page.getByRole('button', { name: 'Load compressed payload' }).click();

	const worker = await workerPromise;
	expect(worker.url()).toContain('runtime.worker');
	await expect(page.getByTestId('document-version')).toHaveText('2');
	await expect(page.getByTestId('stroke-count')).toHaveText('2');
	await expect(page.getByTestId('json-gzip-bytes')).not.toHaveText('0');
	await expect(page.getByText(/Original drawing preview/)).toBeVisible();
	await expect(page.getByText(/Exact raster oracle/)).toBeVisible();
	await expect(
		page.getByText(/Run the prod-like pipeline to inspect all chained passes\./)
	).toBeVisible();
});
