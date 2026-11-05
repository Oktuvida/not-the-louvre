import { page } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import '../../../../routes/layout.css';
import VisitorPass from './VisitorPass.svelte';

const pass = { nickname: 'test1234', onEdit: () => {}, userId: 'user-1' };

const stub = () => page.getByRole('button', { name: 'Leave' });

const settle = () => {
	for (const motion of document.getAnimations()) motion.finish();
};

/*
 * A tilted box has a wider bounding box, so a shadow at another angle than its
 * stub shows up here as another size. Each shadow only sits lower on the wall.
 */
const expectShadowsUnderTheStub = () => {
	const paper = stub().element().getBoundingClientRect();
	const shadows = page.getByTestId('pass-stub-shadow').elements();

	expect(shadows).toHaveLength(2);
	for (const shadow of shadows) {
		const rect = shadow.getBoundingClientRect();
		expect(rect.left).toBeCloseTo(paper.left, 0);
		expect(rect.width).toBeCloseTo(paper.width, 0);
		expect(rect.height).toBeCloseTo(paper.height, 0);
	}
};

describe('VisitorPass', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('keeps the shadow under the stub as the stub tilts away from the pass', async () => {
		render(VisitorPass, pass);
		const atRest = stub().element().getBoundingClientRect().width;

		await stub().hover();
		settle();

		expect(stub().element().getBoundingClientRect().width).toBeGreaterThan(atRest);
		expectShadowsUnderTheStub();
	});

	it('takes the shadow with a stub torn off', async () => {
		vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => {});
		render(VisitorPass, pass);

		await stub().click();
		await vi.waitFor(() => expect(document.getAnimations().length).toBeGreaterThan(0));
		settle();

		expectShadowsUnderTheStub();
	});
});
