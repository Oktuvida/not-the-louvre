<script lang="ts">
	import AuthOverlay from '$lib/features/home-entry-scene/components/AuthOverlay.svelte';
	import HomeEntryPage from '$lib/features/home-entry-scene/HomeEntryPage.svelte';
	import MuseumWallOverlay from '$lib/features/home-entry-scene/components/MuseumWallOverlay.svelte';
	import {
		createEntryState,
		type EntryFlowEvent
	} from '$lib/features/home-entry-scene/state/entry-state.svelte';

	const entryState = createEntryState();
	let authOverlayElement = $state<HTMLDivElement | null>(null);
	let nickname = $state<string | null>(null);

	const flowState = $derived(entryState.state);

	const dispatch = (event: EntryFlowEvent) => {
		entryState.dispatch(event);
	};

	const handleLogout = () => {
		nickname = null;
		entryState.dispatch('LOG_OUT');
	};

	const handleAuthResolved = (nextNickname: string) => {
		nickname = nextNickname;
	};
</script>

<HomeEntryPage entryState={flowState} {nickname} onlogout={handleLogout}>
	<MuseumWallOverlay entryState={flowState} {dispatch} {authOverlayElement} />
	<AuthOverlay
		bind:overlayElement={authOverlayElement}
		entryState={flowState}
		{dispatch}
		onAuthResolved={handleAuthResolved}
	/>
</HomeEntryPage>
