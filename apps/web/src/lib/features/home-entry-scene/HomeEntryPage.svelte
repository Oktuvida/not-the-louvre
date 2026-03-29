<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HomeAuthUser } from '$lib/features/home-entry-scene/auth-contract';
	import type { HomePreviewCard } from '$lib/features/home-entry-scene/state/home-entry.svelte';
	import HomeHeroOverlay from '$lib/features/home-entry-scene/components/HomeHeroOverlay.svelte';
	import PersistentNav from '$lib/features/home-entry-scene/components/PersistentNav.svelte';
	import StudioScene from '$lib/features/home-entry-scene/scene/StudioScene.svelte';
	import type { EntryFlowState } from '$lib/features/home-entry-scene/state/entry-state.svelte';
	import GameLink from '$lib/features/shared-ui/components/GameLink.svelte';

	let {
		children,
		adultContentEnabled = false,
		entryState = 'outside',
		previewCards = [],
		user = null
	}: {
		children?: Snippet;
		adultContentEnabled?: boolean;
		entryState?: EntryFlowState;
		previewCards?: HomePreviewCard[];
		user?: HomeAuthUser | null;
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
	<PersistentNav {adultContentEnabled} {previewCards} {user} />
	{#if entryState === 'inside' && user}
		<div class="pointer-events-auto absolute bottom-28 left-1/2 z-[25] -translate-x-1/2">
			<GameLink
				href="/draw"
				variant="primary"
				className="gap-3 bg-[#d68a49] px-10 py-5 text-xl font-black text-[#2d2420] shadow-[0_16px_40px_rgba(0,0,0,0.35)]"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="28"
					height="28"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					><path
						d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"
					/><path d="M20 3v4" /><path d="M22 5h-4" /><path d="M4 17v2" /><path d="M5 18H3" /></svg
				>
				<span>Studio</span>
			</GameLink>
		</div>
	{/if}
	{@render children?.()}
</div>
