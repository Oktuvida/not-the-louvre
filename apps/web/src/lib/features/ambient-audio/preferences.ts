export const AMBIENT_AUDIO_STORAGE_KEY = 'not-the-louvre:ambient-audio-enabled';
export const AMBIENT_AUDIO_TRACK_STORAGE_KEY = 'not-the-louvre:ambient-audio-track-id';

export const readStoredAmbientAudioPreference = (
	storage: Pick<Storage, 'getItem'> | null | undefined
) => {
	if (!storage) {
		return null;
	}

	try {
		const storedValue = storage.getItem(AMBIENT_AUDIO_STORAGE_KEY);

		if (storedValue === 'true') {
			return true;
		}

		if (storedValue === 'false') {
			return false;
		}
	} catch {
		return null;
	}

	return null;
};

export const writeStoredAmbientAudioPreference = (
	enabled: boolean,
	storage: Pick<Storage, 'setItem'> | null | undefined
) => {
	if (!storage) {
		return;
	}

	try {
		storage.setItem(AMBIENT_AUDIO_STORAGE_KEY, String(enabled));
	} catch {
		// Storage can be unavailable in privacy-restricted environments.
	}
};

export const readStoredAmbientAudioTrackId = (
	storage: Pick<Storage, 'getItem'> | null | undefined
) => {
	if (!storage) {
		return null;
	}

	try {
		const storedValue = storage.getItem(AMBIENT_AUDIO_TRACK_STORAGE_KEY);

		if (typeof storedValue === 'string' && storedValue.length > 0) {
			return storedValue;
		}
	} catch {
		return null;
	}

	return null;
};

export const writeStoredAmbientAudioTrackId = (
	trackId: string,
	storage: Pick<Storage, 'setItem'> | null | undefined
) => {
	if (!storage) {
		return;
	}

	try {
		storage.setItem(AMBIENT_AUDIO_TRACK_STORAGE_KEY, trackId);
	} catch {
		// Storage can be unavailable in privacy-restricted environments.
	}
};

export const resolveInitialAmbientAudioEnabled = (
	bootstrappedPreference: boolean | null,
	storedPreference: boolean | null
) => bootstrappedPreference ?? storedPreference ?? false;
