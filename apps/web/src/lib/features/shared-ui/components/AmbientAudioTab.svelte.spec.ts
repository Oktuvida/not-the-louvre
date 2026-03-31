import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';

import AmbientAudioTab from './AmbientAudioTab.svelte';

describe('AmbientAudioTab', () => {
	it('renders the current track label and emits a toggle click', async () => {
		const onToggle = vi.fn();

		render(AmbientAudioTab, {
			currentTrackLabel: 'Gallery Rain',
			enabled: true,
			onToggle,
			playbackUnavailable: false
		});

		await expect.element(page.getByText('Ambience')).toBeVisible();
		await expect.element(page.getByText('Gallery Rain')).toBeVisible();

		await page.getByRole('button', { name: 'Mute ambient audio' }).click();

		expect(onToggle).toHaveBeenCalledTimes(1);
	});

	it('shows the quiet state when playback is unavailable', async () => {
		render(AmbientAudioTab, {
			currentTrackLabel: null,
			enabled: false,
			onToggle: () => {},
			playbackUnavailable: true
		});

		await expect.element(page.getByText('Quiet for now')).toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Enable ambient audio' })).toBeVisible();
	});
});
