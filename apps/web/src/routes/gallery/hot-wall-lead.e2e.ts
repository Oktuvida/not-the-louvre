import { expect, test } from '@playwright/test';
import { resetDemoState } from '../demo/e2e-helpers';

// The Hot Wall's lead hangs like the rest of the wall, as a polaroid: its
// drawing whole and uncovered, and its title, artist and stars written on the
// paper under it, not laid over the picture.

test('the Hot Wall’s lead shows its drawing uncovered, its caption written under it', async ({
	page,
	request
}) => {
	await resetDemoState(request);
	const seeded = await request.post('/demo/test-support/gallery', { data: { count: 6 } });
	expect(seeded.ok()).toBe(true);

	await page.goto('/gallery/hot-wall');
	const lead = page.getByRole('button', { name: /Hottest right now/ });
	await expect(lead).toBeVisible();

	const picture = await lead.getByRole('img').first().boundingBox();
	const title = await lead.getByRole('heading').boundingBox();
	expect(picture).not.toBeNull();
	expect(title).not.toBeNull();
	// By the title's middle: the polaroid hangs a little askew, which tilts both boxes.
	expect(title!.y + title!.height / 2).toBeGreaterThan(picture!.y + picture!.height);
	await expect(lead.getByText(/★\s*\d+/)).toBeVisible();
});
