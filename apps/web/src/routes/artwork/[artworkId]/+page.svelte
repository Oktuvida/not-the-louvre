<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { writable } from 'svelte/store';
	import { setAdultContentEnabled } from '#lib/client/avatar-upload.js';
	import ArtworkDetailPanel from '#lib/features/artwork-presentation/components/ArtworkDetailPanel.svelte';
	import type { Artwork } from '#lib/features/artwork-presentation/model/artwork.js';
	import { createGalleryLayoutContext } from '#lib/features/gallery-exploration/gallery-layout-context.js';
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

	const patchArtwork = (
		artworkId: string,
		patch: Partial<Pick<Artwork, 'isHidden' | 'isNsfw'>>
	) => {
		if (artwork.id === artworkId) artwork = { ...artwork, ...patch };
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
		onArtworkChange={(next) => (artwork = next)}
		onArtworkPatch={patchArtwork}
		onClose={() => goto(resolve('/gallery/[[room]]', {}))}
		{revealedArtworkIds}
		viewer={data.viewer}
	/>
</GalleryLayoutFrame>
