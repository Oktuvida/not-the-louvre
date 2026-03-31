<script lang="ts">
	import StudioDrawingPage from '$lib/features/studio-drawing/StudioDrawingPage.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<StudioDrawingPage forkParent={data.forkParent} />
