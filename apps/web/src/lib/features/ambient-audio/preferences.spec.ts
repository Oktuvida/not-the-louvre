import { describe, expect, it } from 'vitest';

import {
	AMBIENT_AUDIO_STORAGE_KEY,
	readStoredAmbientAudioPreference,
	resolveInitialAmbientAudioEnabled
} from './preferences';

describe('ambient audio preferences', () => {
	it('prefers the bootstrapped server value over local storage when present', () => {
		expect(resolveInitialAmbientAudioEnabled(false, true)).toBe(false);
	});

	it('falls back to local storage and then to the first-visit default', () => {
		expect(resolveInitialAmbientAudioEnabled(null, false)).toBe(false);
		expect(resolveInitialAmbientAudioEnabled(null, null)).toBe(true);
	});

	it('parses stored preferences conservatively', () => {
		const storage = {
			getItem: (key: string) => {
				if (key !== AMBIENT_AUDIO_STORAGE_KEY) {
					return null;
				}

				return 'false';
			}
		} as Pick<Storage, 'getItem'> as Storage;

		expect(readStoredAmbientAudioPreference(storage)).toBe(false);
	});
});
