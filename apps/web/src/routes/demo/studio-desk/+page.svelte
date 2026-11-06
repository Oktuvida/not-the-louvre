<script lang="ts">
	import StudioScene from '#lib/features/home-entry-scene/scene/StudioScene.svelte';
	import { page } from '$app/state';

	/*
	 * The side table seen from where the Studio move ends, without its book:
	 * what scripts/render-studio-desk.ts photographs for the studio's desk.
	 * `?dpr=` sets how many pixels the photograph has per CSS pixel.
	 */
	const dpr = Number(page.url.searchParams.get('dpr') ?? 2);
	let mediaState = $state<'error' | 'loaded' | 'pending'>('pending');
</script>

<div class="fixed inset-0" data-desk-state={mediaState}>
	<StudioScene
		deskSnapshot
		entryState="inside"
		{dpr}
		onMediaStateChange={(state) => {
			mediaState = state;
		}}
	/>
</div>
