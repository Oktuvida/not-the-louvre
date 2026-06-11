<script lang="ts">
	import Layout from './+layout.svelte';

	let { data } = $props();
</script>

<Layout {data} params={{}}>
	<div data-testid="root-layout-harness-slot">Root layout content</div>
</Layout>
