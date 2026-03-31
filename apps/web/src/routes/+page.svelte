<script lang="ts">
	import type {
		HomeAuthActionForm,
		HomeAuthBootstrap
	} from '$lib/features/home-entry-scene/auth-contract';
	import type {
		HomePreviewCard,
		HomeSceneArtworkSlot
	} from '$lib/features/home-entry-scene/state/home-entry.svelte';
	import EntrySceneController from '$lib/features/home-entry-scene/components/EntrySceneController.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<EntrySceneController
	auth={data.auth as HomeAuthBootstrap}
	adultContentEnabled={data.adultContentEnabled}
	form={form as HomeAuthActionForm}
	studioArtworks={data.studioArtworks as HomeSceneArtworkSlot[]}
	topArtworks={data.topArtworks as HomePreviewCard[]}
/>
