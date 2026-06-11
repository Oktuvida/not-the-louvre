import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';

const idleCallbacks: IdleRequestCallback[] = [];

const { imageInstances } = vi.hoisted(() => ({
	imageInstances: [] as Array<{ decoding: string; src: string }>
}));

import RootLayoutHarness from './RootLayoutHarness.svelte';

describe('root layout studio background warmup', () => {
	beforeEach(() => {
		idleCallbacks.length = 0;
		imageInstances.length = 0;
	});

	it('warms the studio background after the page becomes idle', () => {
		const RequestIdleCallbackImage = class {
			decoding = '';
			#src = '';

			constructor() {
				imageInstances.push(this);
			}

			set src(value: string) {
				this.#src = value;
			}

			get src() {
				return this.#src;
			}
		};

		vi.stubGlobal('Image', RequestIdleCallbackImage);
		vi.stubGlobal(
			'requestIdleCallback',
			vi.fn((callback: IdleRequestCallback) => {
				idleCallbacks.push(callback);
				return 1;
			})
		);
		vi.stubGlobal('cancelIdleCallback', vi.fn());

		render(RootLayoutHarness, {
			data: {
				ambientAudioEnabled: false,
				favicon: { href: '/favicon.svg', kind: 'sketch' },
				viewer: null
			}
		});

		expect(imageInstances).toHaveLength(0);
		idleCallbacks[0]?.({
			didTimeout: false,
			timeRemaining: () => 1
		} as IdleDeadline);

		expect(imageInstances).toHaveLength(1);
		expect(imageInstances[0]?.src).toBe('/table.avif');
		expect(imageInstances[0]?.decoding).toBe('async');
	});
});
