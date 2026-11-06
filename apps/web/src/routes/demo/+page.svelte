<script lang="ts">
	import { resolve } from '$app/paths';

	const demos = [
		{
			description: 'Nickname signup, login, logout, availability, and recovery journey.',
			href: '/demo/better-auth',
			name: 'Nickname auth demo'
		}
	] as const;
</script>

<h1>Backend Journey Demos</h1>
<p>Minimal browser surfaces for backend end-to-end journeys.</p>

<ul>
	{#each demos as demo (demo.href)}
		<li>
			<a href={resolve(demo.href)}>{demo.name}</a>
			<p>{demo.description}</p>
		</li>
	{/each}
</ul>
