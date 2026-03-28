<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Not the Louvre</title>
	<meta
		name="description"
		content="A playful studio-world where sketchy masterpieces, strange rankings, and a 3D room all collide."
	/>
</svelte:head>

{@render children()}
