<script lang="ts">
	import type { Snippet } from 'svelte';
	import HomeHeroOverlay from '$lib/features/home-entry-scene/components/HomeHeroOverlay.svelte';
	import PersistentNav from '$lib/features/home-entry-scene/components/PersistentNav.svelte';
	import StudioScene from '$lib/features/home-entry-scene/scene/StudioScene.svelte';
	import type { EntryFlowState } from '$lib/features/home-entry-scene/state/entry-state.svelte';

	let {
		children,
		entryState = 'outside',
		nickname = null,
		onlogout
	}: {
		children?: Snippet;
		entryState?: EntryFlowState;
		nickname?: string | null;
		onlogout?: () => void;
	} = $props();
</script>

<div
	class="relative h-screen w-full overflow-hidden bg-gradient-to-br from-[#f5f0e8] via-[#fdfbf7] to-[#e8e0d5]"
>
	<div class="absolute inset-0 flex items-center justify-center">
		<div class="relative h-full w-full opacity-80">
			<StudioScene {entryState} />
			<div
				class="bg-gradient-radial absolute inset-0 from-transparent via-transparent to-[#f5f0e8]"
			></div>
		</div>
	</div>
	<HomeHeroOverlay />
	<PersistentNav {nickname} {onlogout} />
	{@render children?.()}
</div>
