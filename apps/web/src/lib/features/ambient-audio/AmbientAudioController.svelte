<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import AmbientAudioTab from '$lib/features/shared-ui/components/AmbientAudioTab.svelte';
	import { ambientPlaylist, type AmbientTrack } from './playlist';
	import {
		readStoredAmbientAudioPreference,
		readStoredAmbientAudioTrackId,
		resolveInitialAmbientAudioEnabled,
		writeStoredAmbientAudioPreference,
		writeStoredAmbientAudioTrackId
	} from './preferences';

	let {
		audioFactory = () => new Audio(),
		bootstrappedPreference = null,
		playlist = ambientPlaylist,
		viewerId = null
	}: {
		audioFactory?: () => HTMLAudioElement;
		bootstrappedPreference?: boolean | null;
		playlist?: AmbientTrack[];
		viewerId?: string | null;
	} = $props();

	let audio = $state<HTMLAudioElement | null>(null);
	let currentTrackIndex = $state(0);
	let currentTrackLabel = $state<string | null>(null);
	let enabled = $state(false);
	let initializing = $state(false);
	let playbackUnavailable = $state(false);
	let hasUserInteractedSinceMount = $state(false);
	let fadeToken = 0;

	const AMBIENT_AUDIO_VOLUME = 0.2;
	const AMBIENT_AUDIO_FADE_IN_MS = 900;
	const AMBIENT_AUDIO_FADE_OUT_MS = 260;

	const persistRemotePreference = async (nextEnabled: boolean) => {
		if (!viewerId) {
			return;
		}

		try {
			await fetch('/api/viewer/content-preferences', {
				body: JSON.stringify({ ambientAudioEnabled: nextEnabled }),
				headers: { 'content-type': 'application/json' },
				method: 'PATCH'
			});
		} catch {
			// Keep the local preference even if remote persistence is temporarily unavailable.
		}
	};

	const persistTrackPreference = (trackId: string) => {
		writeStoredAmbientAudioTrackId(trackId, browser ? window.localStorage : null);
	};

	const selectTrack = (index: number) => {
		const track = playlist[index];

		if (!track) {
			return false;
		}

		currentTrackIndex = index;
		currentTrackLabel = track.title;
		persistTrackPreference(track.id);
		return true;
	};

	const resolveStoredTrackIndex = (storedTrackId: string | null) => {
		if (!storedTrackId) {
			return 0;
		}

		const restoredIndex = playlist.findIndex((track) => track.id === storedTrackId);

		return restoredIndex >= 0 ? restoredIndex : 0;
	};

	const applyTrack = (index: number) => {
		if (!selectTrack(index) || !audio) {
			return false;
		}

		audio.src = playlist[index]!.src;
		audio.load();
		return true;
	};

	const fadeVolumeTo = (
		targetVolume: number,
		{
			duration,
			onComplete
		}: {
			duration: number;
			onComplete?: () => void;
		}
	) => {
		if (!audio) {
			return;
		}

		fadeToken += 1;
		const activeToken = fadeToken;
		const startingVolume = audio.volume;
		const startedAt = performance.now();

		const step = (now: number) => {
			if (!audio || activeToken !== fadeToken) {
				return;
			}

			const progress = Math.min(1, (now - startedAt) / duration);
			audio.volume = startingVolume + (targetVolume - startingVolume) * progress;

			if (progress < 1) {
				requestAnimationFrame(step);
				return;
			}

			onComplete?.();
		};

		requestAnimationFrame(step);
	};

	const fadeIn = () => {
		if (!audio) {
			return;
		}

		audio.volume = 0;
		fadeVolumeTo(AMBIENT_AUDIO_VOLUME, { duration: AMBIENT_AUDIO_FADE_IN_MS });
	};

	const fadeOutAndPause = () => {
		if (!audio) {
			return;
		}

		fadeVolumeTo(0, {
			duration: AMBIENT_AUDIO_FADE_OUT_MS,
			onComplete: () => {
				if (!audio) {
					return;
				}

				audio.pause();
				audio.volume = AMBIENT_AUDIO_VOLUME;
			}
		});
	};

	const tryPlayCurrentTrack = async ({ useFadeIn = false }: { useFadeIn?: boolean } = {}) => {
		if (!audio || playlist.length === 0) {
			playbackUnavailable = true;
			return false;
		}

		initializing = true;
		playbackUnavailable = false;

		try {
			await audio.play();
			if (useFadeIn) {
				fadeIn();
			} else {
				audio.volume = AMBIENT_AUDIO_VOLUME;
			}
			return true;
		} catch {
			audio.pause();
			audio.currentTime = 0;
			return false;
		} finally {
			initializing = false;
		}
	};

	const moveToNextTrack = async () => {
		if (!audio || playlist.length === 0) {
			playbackUnavailable = true;
			return;
		}

		for (let offset = 1; offset <= playlist.length; offset += 1) {
			const nextIndex = (currentTrackIndex + offset) % playlist.length;
			if (!applyTrack(nextIndex)) {
				continue;
			}

			if (!enabled) {
				return;
			}

			const didPlay = await tryPlayCurrentTrack();
			if (didPlay) {
				return;
			}
		}

		playbackUnavailable = true;
		enabled = false;
	};

	const handleToggle = async () => {
		hasUserInteractedSinceMount = true;
		const nextEnabled = !enabled;
		enabled = nextEnabled;
		writeStoredAmbientAudioPreference(nextEnabled, browser ? window.localStorage : null);
		void persistRemotePreference(nextEnabled);

		if (!nextEnabled) {
			if (audio) {
				fadeOutAndPause();
			}
			return;
		}

		if (!audio) {
			await initializeAudio();
			return;
		}

		const didPlay = await tryPlayCurrentTrack({ useFadeIn: true });
		if (!didPlay) {
			enabled = false;
		}
	};

	async function initializeAudio() {
		if (!browser || audio || playlist.length === 0) {
			playbackUnavailable = playlist.length === 0;
			return;
		}

		audio = audioFactory();
		audio.preload = 'none';
		audio.loop = false;
		audio.addEventListener('ended', () => {
			void moveToNextTrack();
		});
		audio.addEventListener('error', () => {
			void moveToNextTrack();
		});

		if (!applyTrack(currentTrackIndex)) {
			playbackUnavailable = true;
			return;
		}

		if (!enabled) {
			return;
		}

		const didPlay = await tryPlayCurrentTrack({ useFadeIn: true });
		if (!didPlay && !hasUserInteractedSinceMount) {
			enabled = false;
		}
	}

	onMount(() => {
		const storedPreference = readStoredAmbientAudioPreference(window.localStorage);
		const storedTrackId = readStoredAmbientAudioTrackId(window.localStorage);
		enabled = resolveInitialAmbientAudioEnabled(bootstrappedPreference, storedPreference);
		if (!selectTrack(resolveStoredTrackIndex(storedTrackId))) {
			currentTrackLabel = null;
		}

		const initHandle = window.setTimeout(() => {
			void initializeAudio();
		}, 0);

		return () => {
			window.clearTimeout(initHandle);
			fadeToken += 1;
			if (audio) {
				audio.pause();
				audio.src = '';
			}
		};
	});
</script>

<AmbientAudioTab
	{currentTrackLabel}
	{enabled}
	onToggle={handleToggle}
	playbackUnavailable={playbackUnavailable && !initializing}
/>
