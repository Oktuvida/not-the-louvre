import { afterEach, describe, expect, it, vi } from 'vitest';
import { scheduleStudioBackgroundWarmup, warmStudioBackground } from './studio-background-warmup';

/*
 * Lives in the client project because the warm-up only exists in a browser:
 * it constructs an Image and rides requestIdleCallback.
 */

const idleCallbacks: IdleRequestCallback[] = [];
const imageInstances: Array<{ decoding: string; src: string }> = [];

const TrackingImage = class {
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

vi.stubGlobal('Image', TrackingImage);
vi.stubGlobal(
	'requestIdleCallback',
	vi.fn((callback: IdleRequestCallback) => {
		idleCallbacks.push(callback);
		return idleCallbacks.length;
	})
);
const cancelIdleCallback = vi.fn();
vi.stubGlobal('cancelIdleCallback', cancelIdleCallback);

afterEach(() => {
	cancelIdleCallback.mockClear();
});

describe('studio background warm-up', () => {
	it('fetches the table background once the page goes idle', () => {
		const cancel = scheduleStudioBackgroundWarmup();

		expect(imageInstances).toHaveLength(0);

		idleCallbacks[0]?.({ didTimeout: false, timeRemaining: () => 1 } as IdleDeadline);

		expect(imageInstances).toHaveLength(1);
		expect(imageInstances[0]?.src).toBe('/table.avif');
		expect(imageInstances[0]?.decoding).toBe('async');

		cancel();
	});

	// The home page warms it at idle and the gallery's "Create Art" control
	// warms it on hover; the shared guard is what stops them fetching twice.
	it('never fetches the background a second time', () => {
		warmStudioBackground();
		const cancel = scheduleStudioBackgroundWarmup();
		idleCallbacks[1]?.({ didTimeout: false, timeRemaining: () => 1 } as IdleDeadline);

		expect(imageInstances).toHaveLength(1);

		cancel();
	});

	it('cancels a pending idle callback when the caller tears down first', () => {
		const cancel = scheduleStudioBackgroundWarmup();

		cancel();

		expect(cancelIdleCallback).toHaveBeenCalledTimes(1);
	});
});
