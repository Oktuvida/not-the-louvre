<script lang="ts">
	let {
		color = '#6e6e6e',
		opacity = 0,
		visible = false
	}: {
		color?: string;
		opacity?: number;
		visible?: boolean;
	} = $props();
</script>

{#if visible}
	<div
		class="pointer-events-none fixed inset-0 z-[100]"
		style={`background-color: ${color}; opacity: ${opacity};`}
	></div>
{/if}
