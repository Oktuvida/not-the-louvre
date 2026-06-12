import { getContext, setContext } from 'svelte';
import { writable, type Writable } from 'svelte/store';
import type { Artwork } from '$lib/features/artwork-presentation/model/artwork';

type Viewer = { id: string; role: 'admin' | 'moderator' | 'user' } | null;

export type GalleryPanelBindings = {
	adultContentEnabled: boolean;
	artwork: Artwork | null;
	isHydratingDetail: boolean;
	onAdultContentToggle: (enabled: boolean) => Promise<void> | void;
	onArtworkChange: (artwork: Artwork) => void;
	onArtworkPatch: (artworkId: string, patch: Partial<Pick<Artwork, 'isHidden' | 'isNsfw'>>) => void;
	onClose: () => void;
	revealedArtworkIds: Writable<Set<string>>;
	viewer: Viewer;
};

export type GalleryActionBindings = {
	isRefreshingGallery: boolean;
	onBack: (event: MouseEvent) => void;
	onRefresh: () => Promise<void> | void;
};

export type GalleryLayoutContext = {
	panelBindings: Writable<GalleryPanelBindings | null>;
	actionBindings: Writable<GalleryActionBindings | null>;
	revealedArtworkIds: Writable<Set<string>>;
	previousRoomId: Writable<string | null>;
};

const KEY = Symbol('gallery-layout-context');

export const createGalleryLayoutContext = (): GalleryLayoutContext => ({
	panelBindings: writable<GalleryPanelBindings | null>(null),
	actionBindings: writable<GalleryActionBindings | null>(null),
	revealedArtworkIds: writable<Set<string>>(new Set()),
	previousRoomId: writable<string | null>(null)
});

export const setGalleryLayoutContext = (value: GalleryLayoutContext) => setContext(KEY, value);

export const getGalleryLayoutContext = () => getContext<GalleryLayoutContext | undefined>(KEY);
