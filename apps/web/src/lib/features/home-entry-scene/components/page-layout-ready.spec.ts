import { describe, expect, it } from 'vitest';
import { waitForPageLayoutReady } from './page-layout-ready';

describe('waitForPageLayoutReady', () => {
	it('waits for the load event when the document is not fully loaded yet', async () => {
		let resolveLoad: (() => void) | null = null;
		let resolveFonts: (() => void) | null = null;
		let fontsResolved = false;
		const result = waitForPageLayoutReady({
			document: {
				fonts: {
					ready: new Promise<void>((resolve) => {
						resolveFonts = () => {
							fontsResolved = true;
							resolve();
						};
					})
				},
				readyState: 'interactive'
			},
			window: {
				addEventListener: (_type, listener) => {
					resolveLoad = () => {
						if (typeof listener === 'function') {
							listener(new Event('load'));
						} else {
							listener.handleEvent(new Event('load'));
						}
					};
				}
			}
		});

		expect(resolveLoad).not.toBeNull();
		await Promise.resolve();
		expect(fontsResolved).toBe(false);

		if (!resolveLoad) {
			throw new Error('Expected the load listener to be registered');
		}

		const triggerLoad = resolveLoad as () => void;
		triggerLoad();
		await Promise.resolve();
		expect(fontsResolved).toBe(false);

		if (!resolveFonts) {
			throw new Error('Expected the fonts promise to be registered');
		}

		const triggerFontsReady = resolveFonts as () => void;
		triggerFontsReady();
		await result;
		expect(fontsResolved).toBe(true);
	});

	it('resolves immediately when the document is already complete', async () => {
		let addEventListenerCalled = false;
		await waitForPageLayoutReady({
			document: {
				fonts: { ready: Promise.resolve() },
				readyState: 'complete'
			},
			window: {
				addEventListener: () => {
					addEventListenerCalled = true;
				}
			}
		});

		expect(addEventListenerCalled).toBe(false);
	});
});
