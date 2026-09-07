import { beforeEach, describe, expect, it, vi } from 'vitest';

const { preloadCode, preloadData } = vi.hoisted(() => ({
	preloadCode: vi.fn(async () => undefined),
	preloadData: vi.fn(async () => ({ type: 'loaded' as const, status: 200, data: {} }))
}));

vi.mock('$app/navigation', () => ({ preloadCode, preloadData }));

const {
	homeGalleryTarget,
	homeStudioTarget,
	warmNavigationTarget,
	warmNavigationTargetWhenIdle,
	warmOnIntent
} = await import('./navigation-warmup');

describe('navigation warm-up', () => {
	beforeEach(() => {
		preloadCode.mockClear();
		preloadData.mockClear();
	});

	it('targets the exact URL the home handlers navigate to', () => {
		expect(homeGalleryTarget).toBe('/gallery/your-studio?from=home');
		expect(homeStudioTarget).toBe('/draw');
	});

	it('preloads the route module by pathname and the data by full URL', () => {
		warmNavigationTarget('/gallery/hall-of-fame?from=home');

		expect(preloadCode).toHaveBeenCalledWith('/gallery/hall-of-fame');
		expect(preloadData).toHaveBeenCalledWith('/gallery/hall-of-fame?from=home');
	});

	it('warms a target once however many times intent is signalled', () => {
		warmNavigationTarget('/gallery/mystery?from=home');
		warmNavigationTarget('/gallery/mystery?from=home');
		warmNavigationTarget('/gallery/mystery?from=home');

		expect(preloadCode).toHaveBeenCalledTimes(1);
		expect(preloadData).toHaveBeenCalledTimes(1);
	});

	it('defers the idle variant off the current frame', async () => {
		warmNavigationTargetWhenIdle('/gallery/hot-wall?from=home');

		expect(preloadData).not.toHaveBeenCalled();

		await vi.waitFor(() => {
			expect(preloadData).toHaveBeenCalledWith('/gallery/hot-wall?from=home');
		});
	});

	it('warms from hover and from keyboard focus', () => {
		const node = document.createElement('div');
		document.body.append(node);

		const action = warmOnIntent(node, '/gallery/your-studio?warm=hover');
		node.dispatchEvent(new PointerEvent('pointerenter'));
		expect(preloadData).toHaveBeenCalledWith('/gallery/your-studio?warm=hover');

		action.update('/gallery/your-studio?warm=focus');
		node.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
		expect(preloadData).toHaveBeenCalledWith('/gallery/your-studio?warm=focus');

		action.destroy();
		node.dispatchEvent(new PointerEvent('pointerenter'));
		expect(preloadData).toHaveBeenCalledTimes(2);

		node.remove();
	});

	it('does not re-warm from the idle variant once the target is warm', async () => {
		warmNavigationTarget('/gallery/newest?from=home');
		warmNavigationTargetWhenIdle('/gallery/newest?from=home');

		await vi.waitFor(() => {
			expect(preloadCode).toHaveBeenCalledTimes(1);
		});
	});
});
