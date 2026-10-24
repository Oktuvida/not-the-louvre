<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { writable } from 'svelte/store';
	import { setAdultContentEnabled } from '#lib/client/avatar-upload.js';
	import ArtworkDetailPanel from '#lib/features/artwork-presentation/components/ArtworkDetailPanel.svelte';
	import {
		artworkEngagement,
		type Artwork
	} from '#lib/features/artwork-presentation/model/artwork.js';
	import { applyArtworkLiveChange } from '#lib/features/gallery-exploration/artwork-live-change.js';
	import { createArtworkLiveUpdates } from '#lib/features/gallery-exploration/artwork-live-updates.js';
	import { createGalleryLayoutContext } from '#lib/features/gallery-exploration/gallery-layout-context.js';
	import { patchCachedArtwork } from '#lib/features/gallery-exploration/model/feed-cache.js';
	import GalleryLayoutFrame from '#lib/features/gallery-exploration/GalleryLayoutFrame.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Reseeded whenever the page reloads; votes, comments and moderation patch
	// it in between, exactly as they patch the gallery's copy.
	let artwork = $derived<Artwork>(data.artwork);
	let adultContentEnabled = $derived(data.adultContentEnabled);
	const revealedArtworkIds = writable(new Set<string>());

	const galleryLayout = createGalleryLayoutContext();
	galleryLayout.actionBindings.set({
		isRefreshingGallery: false,
		onBack: () => {},
		onRefresh: () => invalidateAll()
	});

	// The panel only offers the 18+ switch to a signed-in viewer.
	const updateAdultContentPreference = async (enabled: boolean) => {
		await setAdultContentEnabled(enabled);
		adultContentEnabled = enabled;
	};

	// Live, as the gallery's postcard is: a change applies its own data, and one
	// without (a comment taken down, a reconnect) reloads the page's data.
	const artworkId = $derived(data.artwork.id);

	$effect(() => {
		const liveUpdates = createArtworkLiveUpdates({
			onChange: (_, change) => {
				const patched = change ? applyArtworkLiveChange(artwork, change) : null;
				if (patched) updateArtwork(patched);
				else void invalidateAll();
			}
		});
		liveUpdates.start(artworkId);

		return () => liveUpdates.stop();
	});

	// Rooms the visitor walked through earlier keep their copy in sync too.
	const updateArtwork = (next: Artwork) => {
		artwork = next;
		patchCachedArtwork(next.id, artworkEngagement(next));
	};

	const patchArtwork = (
		artworkId: string,
		patch: Partial<Pick<Artwork, 'isHidden' | 'isNsfw'>>
	) => {
		if (artwork.id === artworkId) artwork = { ...artwork, ...patch };
		patchCachedArtwork(artworkId, patch);
	};
</script>

<!-- The same wall and postcard the gallery opens, server rendered, so a shared
     link paints the artwork before any JavaScript arrives. Closing it walks
     into the gallery. -->
<GalleryLayoutFrame context={galleryLayout} roomId={null} viewer={data.viewer}>
	<ArtworkDetailPanel
		{adultContentEnabled}
		{artwork}
		onAdultContentToggle={updateAdultContentPreference}
		onArtworkChange={updateArtwork}
		onArtworkPatch={patchArtwork}
		onClose={() => goto(resolve('/gallery/[[room]]', {}))}
		{revealedArtworkIds}
		viewer={data.viewer}
	/>
</GalleryLayoutFrame>
