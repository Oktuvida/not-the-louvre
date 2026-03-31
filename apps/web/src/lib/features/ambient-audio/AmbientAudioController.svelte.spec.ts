import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';

import AmbientAudioController from './AmbientAudioController.svelte';

const createFakeAudio = () => {
	let endedHandler: (() => void) | null = null;
	let errorHandler: (() => void) | null = null;
	let currentTimeValue = 0;
	const currentTimeWrites: number[] = [];

	return {
		addEventListener: (type: string, handler: () => void) => {
			if (type === 'ended') endedHandler = handler;
			if (type === 'error') errorHandler = handler;
		},
		get currentTime() {
			return currentTimeValue;
		},
		set currentTime(value: number) {
			currentTimeWrites.push(value);
			currentTimeValue = value;
		},
		load: vi.fn(),
		loop: false,
		pause: vi.fn(),
		play: vi.fn(async () => undefined),
		playsInline: true,
		preload: 'none',
		src: '',
		volume: 1,
		__currentTimeWrites: () => currentTimeWrites,
		__endedHandler: () => endedHandler,
		__errorHandler: () => errorHandler
	} as unknown as HTMLAudioElement;
};

describe('AmbientAudioController', () => {
	beforeEach(() => {
		window.localStorage.clear();
	});

	it('uses the bootstrapped off preference and persists a manual enable', async () => {
		const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ ambientAudioEnabled: true })));
		const fakeAudio = createFakeAudio();
		vi.stubGlobal('fetch', fetchSpy);

		render(AmbientAudioController, {
			audioFactory: () => fakeAudio,
			bootstrappedPreference: false,
			playlist: [{ id: 'track-1', src: '/audio/ambient/test.wav', title: 'Gallery Rain' }],
			viewerId: 'user-1'
		});

		await expect.element(page.getByRole('button', { name: 'Enable ambient audio' })).toBeVisible();

		await page.getByRole('button', { name: 'Enable ambient audio' }).click();

		await expect.element(page.getByRole('button', { name: 'Mute ambient audio' })).toBeVisible();
		expect(window.localStorage.getItem('not-the-louvre:ambient-audio-enabled')).toBe('true');
		expect(fetchSpy).toHaveBeenCalledWith('/api/viewer/content-preferences', {
			body: JSON.stringify({ ambientAudioEnabled: true }),
			headers: { 'content-type': 'application/json' },
			method: 'PATCH'
		});
	});

	it('pauses and resumes the current stream position when toggled off and on', async () => {
		const fakeAudio = createFakeAudio();

		render(AmbientAudioController, {
			audioFactory: () => fakeAudio,
			bootstrappedPreference: true,
			playlist: [{ id: 'track-1', src: '/audio/ambient/test.wav', title: 'Gallery Rain' }],
			viewerId: null
		});

		await expect.element(page.getByRole('button', { name: 'Mute ambient audio' })).toBeVisible();
		await vi.waitFor(() => {
			expect(fakeAudio.play).toHaveBeenCalledTimes(1);
		});
		fakeAudio.currentTime = 42;

		await page.getByRole('button', { name: 'Mute ambient audio' }).click();

		await vi.waitFor(() => {
			expect(fakeAudio.pause).toHaveBeenCalled();
		});
		expect(fakeAudio.currentTime).toBe(42);
		expect(fakeAudio.__currentTimeWrites()).not.toContain(0);

		await page.getByRole('button', { name: 'Enable ambient audio' }).click();

		expect(fakeAudio.currentTime).toBe(42);
		expect(fakeAudio.play).toHaveBeenCalledTimes(2);
	});
});
