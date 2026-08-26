import { tick } from 'svelte';
import { writable } from 'svelte/store';

export const ARTWORK_VIEW_TRANSITION_NAME = 'gallery-artwork-media';

// The artwork id whose room card should carry the shared view-transition-name.
// It is set only around open/close so the name never exists on the card and
// the detail panel inside the same snapshot (duplicates void the transition).
export const artworkTransitionSourceId = writable<string | null>(null);

type DocumentWithViewTransition = Document & {
	startViewTransition(update: () => Promise<void>): { finished: Promise<void> };
};

const supportsArtworkViewTransition = () =>
	typeof document !== 'undefined' &&
	'startViewTransition' in document &&
	typeof window !== 'undefined' &&
	!window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let transitionPending = false;

// Opening: the clicked card owns the name in the old snapshot, the panel
// image takes it over in the new one, so the artwork morphs into the detail.
export const openWithArtworkTransition = async (artworkId: string, apply: () => void) => {
	if (!supportsArtworkViewTransition() || transitionPending) {
		apply();
		return;
	}

	transitionPending = true;
	artworkTransitionSourceId.set(artworkId);
	await tick();

	const transition = (document as DocumentWithViewTransition).startViewTransition(async () => {
		transitionPending = false;
		artworkTransitionSourceId.set(null);
		apply();
		await tick();
	});

	void transition.finished.catch(() => {});
};

// Closing: the panel owns the name in the old snapshot, the card (when it is
// still mounted) receives it in the new one so the artwork flies back home.
export const closeWithArtworkTransition = (artworkId: string | null, apply: () => void) => {
	if (!supportsArtworkViewTransition() || transitionPending) {
		apply();
		return;
	}

	transitionPending = true;

	const transition = (document as DocumentWithViewTransition).startViewTransition(async () => {
		transitionPending = false;
		artworkTransitionSourceId.set(artworkId);
		apply();
		await tick();
	});

	const clearSource = () => artworkTransitionSourceId.set(null);
	transition.finished.then(clearSource, clearSource);
};
