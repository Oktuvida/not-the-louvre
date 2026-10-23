<script lang="ts">
	// Test stub for the Threlte studio scene.
	//
	// The vitest browser project has no WebGL context, so mounting the real
	// StudioScene throws `Error creating WebGL context` inside Threlte's Canvas.
	// EntrySceneController's specs exercise the auth/onboarding state machine,
	// not the 3D scene, so they mock StudioScene with this stub — which also
	// keeps every render from downloading the 578 KB studio GLB and DRACO.
	import type { EntryFlowState } from '#lib/features/home-entry-scene/state/entry-state.svelte.js';
	import type { HomeSceneArtworkSlot } from '#lib/features/home-entry-scene/state/home-entry.svelte.js';

	let {
		entryState = 'outside',
		initialPose = 'default',
		scenePose = 'default',
		artworkSlots = [],
		avatarUrl = null,
		onMediaStateChange
	}: {
		entryState?: EntryFlowState;
		initialPose?: 'default' | 'left-wall' | 'top-close';
		scenePose?: 'default' | 'left-wall' | 'top-close';
		artworkSlots?: HomeSceneArtworkSlot[];
		avatarUrl?: string | null;
		onMediaStateChange?: (state: 'error' | 'loaded' | 'pending') => void;
	} = $props();

	// Stand in for a scene whose model has landed, so the host's loading card
	// clears exactly as it does in the real thing.
	$effect(() => {
		onMediaStateChange?.('loaded');
	});
</script>

<div
	data-testid="studio-scene-stub"
	data-entry-state={entryState}
	data-initial-pose={initialPose}
	data-scene-pose={scenePose}
	data-artwork-slots={artworkSlots.length}
	data-avatar-url={avatarUrl}
></div>
