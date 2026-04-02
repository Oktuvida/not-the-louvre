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

		const button = page.getByRole('button', { name: 'Mute ambient audio' });
		await expect.element(button).toBeVisible();

		await button.click();

		expect(onToggle).toHaveBeenCalledTimes(1);
	});

	it('shows the quiet state when playback is unavailable', async () => {
		render(AmbientAudioTab, {
			currentTrackLabel: null,
			enabled: false,
			onToggle: () => {},
			playbackUnavailable: true
		});

		await expect.element(page.getByRole('button', { name: 'Enable ambient audio' })).toBeVisible();
		const icon = document.querySelector('.ambient-tab-icon');
		expect(icon?.getAttribute('data-muted')).toBe('true');
	});

	it('renders a muted-state audio icon affordance', async () => {
		render(AmbientAudioTab, {
			currentTrackLabel: null,
			enabled: false,
			onToggle: () => {},
			playbackUnavailable: false
		});

		const icon = document.querySelector('.ambient-tab-icon');
		expect(icon).not.toBeNull();
		expect(icon?.getAttribute('data-muted')).toBe('true');
	});
});
