import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';

import AmbientAudioTab from './AmbientAudioTab.svelte';

// The music is a little record player in the corner: one toggle, pressed
// while it plays, that says which record is on.

describe('AmbientAudioTab', () => {
	it('is one toggle, pressed while the music plays', async () => {
		const onToggle = vi.fn();
		const { rerender } = await render(AmbientAudioTab, {
			currentTrackLabel: 'Gallery Rain',
			enabled: false,
			onToggle,
			playbackUnavailable: false
		});

		const player = page.getByRole('button', { name: 'Ambient music' });
		await expect.element(player).toHaveAttribute('aria-pressed', 'false');

		await player.click();
		expect(onToggle).toHaveBeenCalledTimes(1);

		await rerender({ currentTrackLabel: 'Gallery Rain', enabled: true, onToggle });
		await expect.element(player).toHaveAttribute('aria-pressed', 'true');
	});

	it('says which record is on', async () => {
		await render(AmbientAudioTab, {
			currentTrackLabel: 'Gallery Rain',
			enabled: true,
			onToggle: () => {},
			playbackUnavailable: false
		});

		await expect
			.element(page.getByRole('button', { name: 'Ambient music' }))
			.toHaveAccessibleDescription('Gallery Rain');
	});

	it('says so when there is nothing it can play', async () => {
		await render(AmbientAudioTab, {
			currentTrackLabel: null,
			enabled: false,
			onToggle: () => {},
			playbackUnavailable: true
		});

		await expect
			.element(page.getByRole('button', { name: 'Ambient music' }))
			.toHaveAccessibleDescription('Quiet for now');
	});
});
