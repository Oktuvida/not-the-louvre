<script lang="ts">
	import ArtworkFrame from '#lib/features/artwork-presentation/components/ArtworkFrame.svelte';
	import { resolveArtworkFrame } from '#lib/features/artwork-presentation/model/frame.js';

	let {
		artworkId,
		count = 1,
		size = 120
	}: {
		artworkId: string;
		count?: number;
		size?: number;
	} = $props();

	const indexes = $derived(Array.from({ length: count }, (_, index) => index));
</script>

<!-- The vitest client project loads no Tailwind, so the frame boxes are sized
     here: `container-type: size` needs a determinate box in both axes. -->
{#each indexes as index (index)}
	<div class="frame-box" style={`width:${size}px;height:${size}px;`}>
		<ArtworkFrame
			frame={resolveArtworkFrame({ artworkId })}
			className="frame-fill"
			testId={`harness-frame-${index}`}
		/>
	</div>
{/each}

<style>
	.frame-box :global(.frame-fill) {
		height: 100%;
		width: 100%;
	}
</style>
