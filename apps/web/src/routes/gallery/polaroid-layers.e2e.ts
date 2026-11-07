import { expect, test, type Page } from '@playwright/test';
import { resetDemoState } from '../demo/e2e-helpers';

// The wall moves smoothly in every browser. Each polaroid is painted once,
// onto a layer of its own, and scrolling the wall or sliding a room in moves
// those layers. Safari used to paint the grained paper of every card again on
// every frame, and the long rooms (the Hot Wall, the Hall of Fame) stuttered
// while the short ones did not.

const POLAROIDS = [
	'[data-testid="hot-wall-lead"] button',
	'button[data-testid^="hot-wall-polaroid-"]',
	'button[data-testid^="ranked-polaroid-"]'
].join(', ');

/**
 * Scrolls down to the polaroids below the room's lead, then reads the ones on
 * screen: how many there are, and how many of them share a layer with the wall.
 */
const scrollAndReadPolaroidLayers = async (page: Page) => {
	const cdp = await page.context().newCDPSession(page);
	// The compositor reports its layers after each frame it commits; scrolling
	// commits frames, so the last report is the wall as it stands.
	let layers: { backendNodeId?: number }[] = [];
	cdp.on('LayerTree.layerTreeDidChange', (event) => {
		if (event.layers) layers = event.layers;
	});
	await cdp.send('LayerTree.enable');

	const belowTheLead = page.locator(POLAROIDS).nth(4);
	await belowTheLead.scrollIntoViewIfNeeded();
	await expect(belowTheLead).toBeInViewport();
	await expect.poll(() => layers.length).toBeGreaterThan(0);
	const ownLayers = new Set(layers.map((layer) => layer.backendNodeId));

	const { root } = await cdp.send('DOM.getDocument', { depth: -1 });

	const { nodeIds } = await cdp.send('DOM.querySelectorAll', {
		nodeId: root.nodeId,
		selector: POLAROIDS
	});
	let onScreen = 0;
	let sharingTheWall = 0;
	for (const nodeId of nodeIds) {
		const { model } = await cdp.send('DOM.getBoxModel', { nodeId }).catch(() => ({ model: null }));
		const top = model ? Math.min(...model.border.filter((_, index) => index % 2 === 1)) : Infinity;
		const bottom = model ? Math.max(...model.border.filter((_, index) => index % 2 === 1)) : -1;
		if (bottom < 0 || top > page.viewportSize()!.height) continue;

		onScreen += 1;
		const { node } = await cdp.send('DOM.describeNode', { nodeId });
		if (!ownLayers.has(node.backendNodeId)) sharingTheWall += 1;
	}
	await cdp.detach();
	return { onScreen, sharingTheWall };
};

test.describe('the gallery wall', () => {
	test.use({ viewport: { height: 900, width: 1440 } });

	test.beforeEach(async ({ request }) => {
		await resetDemoState(request);
		const seeded = await request.post('/demo/test-support/gallery', { data: { count: 30 } });
		expect(seeded.ok()).toBe(true);
	});

	for (const room of ['hot-wall', 'hall-of-fame']) {
		test(`paints every polaroid in ${room} onto its own layer`, async ({ page }) => {
			await page.goto(`/gallery/${room}`);
			await expect(page.locator(POLAROIDS).first()).toBeVisible();

			const { onScreen, sharingTheWall } = await scrollAndReadPolaroidLayers(page);
			expect(onScreen).toBeGreaterThan(3);
			expect(sharingTheWall).toBe(0);
		});
	}
});
