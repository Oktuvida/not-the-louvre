import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';

import AmbientAudioController from './AmbientAudioController.svelte';

const AMBIENT_AUDIO_ENABLED_STORAGE_KEY = 'not-the-louvre:ambient-audio-enabled';
const AMBIENT_AUDIO_TRACK_STORAGE_KEY = 'not-the-louvre:ambient-audio-track-id';

type FakeAudioElement = HTMLAudioElement & {
	__currentTimeWrites: () => number[];
	__endedHandler: () => (() => void) | null;
	__errorHandler: () => (() => void) | null;
};

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
	} as unknown as FakeAudioElement;
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
		expect(window.localStorage.getItem(AMBIENT_AUDIO_ENABLED_STORAGE_KEY)).toBe('true');
		expect(fetchSpy).toHaveBeenCalledWith('/api/viewer/content-preferences', {
			body: JSON.stringify({ ambientAudioEnabled: true }),
			headers: { 'content-type': 'application/json' },
			method: 'PATCH'
		});
	});

	it('stays off on first visit when no local or bootstrapped preference exists', async () => {
		const fakeAudio = createFakeAudio();

		render(AmbientAudioController, {
			audioFactory: () => fakeAudio,
			bootstrappedPreference: null,
			playlist: [{ id: 'track-1', src: '/audio/ambient/test.wav', title: 'Gallery Rain' }],
			viewerId: null
		});

		await expect.element(page.getByRole('button', { name: 'Enable ambient audio' })).toBeVisible();
		await vi.waitFor(() => {
			expect(fakeAudio.play).not.toHaveBeenCalled();
		});
	});

	it('restores the saved track before playback starts', async () => {
		const fakeAudio = createFakeAudio();
		window.localStorage.setItem(AMBIENT_AUDIO_TRACK_STORAGE_KEY, 'track-2');

		render(AmbientAudioController, {
			audioFactory: () => fakeAudio,
			bootstrappedPreference: true,
			playlist: [
				{ id: 'track-1', src: '/audio/ambient/one.wav', title: 'Gallery Rain' },
				{ id: 'track-2', src: '/audio/ambient/two.wav', title: 'Night Hall' }
			],
			viewerId: null
		});

		await expect.element(page.getByText('Night Hall')).toBeInTheDocument();
		await vi.waitFor(() => {
			expect(window.localStorage.getItem(AMBIENT_AUDIO_TRACK_STORAGE_KEY)).toBe('track-2');
			expect(fakeAudio.load).toHaveBeenCalledTimes(1);
			expect(fakeAudio.play).toHaveBeenCalledTimes(1);
		});
	});

	it('keeps authenticated remote sync working when a local track is restored', async () => {
		const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ ambientAudioEnabled: true })));
		const fakeAudio = createFakeAudio();
		vi.stubGlobal('fetch', fetchSpy);
		window.localStorage.setItem(AMBIENT_AUDIO_TRACK_STORAGE_KEY, 'track-2');

		render(AmbientAudioController, {
			audioFactory: () => fakeAudio,
			bootstrappedPreference: false,
			playlist: [
				{ id: 'track-1', src: '/audio/ambient/one.wav', title: 'Gallery Rain' },
				{ id: 'track-2', src: '/audio/ambient/two.wav', title: 'Night Hall' }
			],
			viewerId: 'user-1'
		});

		await expect.element(page.getByText('Night Hall')).toBeInTheDocument();
		await page.getByRole('button', { name: 'Enable ambient audio' }).click();

		await expect.element(page.getByRole('button', { name: 'Mute ambient audio' })).toBeVisible();
		expect(window.localStorage.getItem(AMBIENT_AUDIO_ENABLED_STORAGE_KEY)).toBe('true');
		expect(window.localStorage.getItem(AMBIENT_AUDIO_TRACK_STORAGE_KEY)).toBe('track-2');
		expect(fakeAudio.load).toHaveBeenCalledTimes(1);
		expect(fakeAudio.play).toHaveBeenCalledTimes(1);
		expect(fetchSpy).toHaveBeenCalledWith('/api/viewer/content-preferences', {
			body: JSON.stringify({ ambientAudioEnabled: true }),
			headers: { 'content-type': 'application/json' },
			method: 'PATCH'
		});
	});

	it('persists the next track identifier when the playlist advances', async () => {
		const fakeAudio = createFakeAudio();

		render(AmbientAudioController, {
			audioFactory: () => fakeAudio,
			bootstrappedPreference: true,
			playlist: [
				{ id: 'track-1', src: '/audio/ambient/one.wav', title: 'Gallery Rain' },
				{ id: 'track-2', src: '/audio/ambient/two.wav', title: 'Night Hall' }
			],
			viewerId: null
		});

		await vi.waitFor(() => {
			expect(fakeAudio.play).toHaveBeenCalledTimes(1);
		});

		await fakeAudio.__endedHandler()?.();

		await vi.waitFor(() => {
			expect(window.localStorage.getItem(AMBIENT_AUDIO_TRACK_STORAGE_KEY)).toBe('track-2');
			expect(fakeAudio.load).toHaveBeenCalledTimes(2);
			expect(fakeAudio.play).toHaveBeenCalledTimes(2);
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
