<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import GalleryLayoutFrame from './GalleryLayoutFrame.svelte';
	import GalleryExplorationPage from './GalleryExplorationPage.svelte';

	// The page's props are taken straight from the component instead of being
	// restated here, so a prop that changes shape cannot quietly drift out of
	// the harness that stands in for the route.
	let props: ComponentProps<typeof GalleryExplorationPage> = $props();
</script>

<GalleryLayoutFrame roomId={props.roomId} viewer={props.viewer ?? null}>
	<GalleryExplorationPage {...props} />
</GalleryLayoutFrame>
