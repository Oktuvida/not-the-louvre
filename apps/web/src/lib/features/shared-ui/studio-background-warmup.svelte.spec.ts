import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	STUDIO_DESK_IMAGE,
	readyStudioBackground,
	scheduleStudioBackgroundWarmup,
	warmStudioBackground
} from './studio-background-warmup';

/*
 * Lives in the client project because the warm-up only exists in a browser:
 * it constructs an Image and rides requestIdleCallback.
 */

const idleCallbacks: IdleRequestCallback[] = [];
const imageInstances: Array<{ decoding: string; sizes: string; srcset: string }> = [];
let finishDecoding = () => {};

const TrackingImage = class {
	decoding = '';
	sizes = '';
	srcset = '';

	constructor() {
		imageInstances.push(this);
	}

	decode() {
		return new Promise<void>((resolve) => {
			finishDecoding = resolve;
		});
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
	it('fetches the desk, at the size the studio will draw it, once the page goes idle', () => {
		const cancel = scheduleStudioBackgroundWarmup();

		expect(imageInstances).toHaveLength(0);

		idleCallbacks[0]?.({ didTimeout: false, timeRemaining: () => 1 } as IdleDeadline);

		expect(imageInstances).toHaveLength(1);
		expect(imageInstances[0]?.srcset).toBe(STUDIO_DESK_IMAGE.avif);
		expect(imageInstances[0]?.sizes).toBe(STUDIO_DESK_IMAGE.sizes);
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

	// The room hands its book to the studio without a veil, so the desk must
	// be ready to paint the moment the studio does.
	it('says when the desk is decoded and ready to paint', async () => {
		let ready = false;
		void readyStudioBackground().then(() => {
			ready = true;
		});
		await Promise.resolve();

		expect(imageInstances).toHaveLength(1);
		expect(ready).toBe(false);

		finishDecoding();
		await vi.waitFor(() => expect(ready).toBe(true));
	});

	it('cancels a pending idle callback when the caller tears down first', () => {
		const cancel = scheduleStudioBackgroundWarmup();

		cancel();

		expect(cancelIdleCallback).toHaveBeenCalledTimes(1);
	});
});
