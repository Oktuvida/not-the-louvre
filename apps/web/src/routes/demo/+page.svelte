<script lang="ts">
	import { resolve } from '$app/paths';

	const demos = [
		{
			description: 'Nickname signup, login, logout, availability, and recovery journey.',
			href: '/demo/better-auth',
			name: 'Nickname auth demo'
		},
		{
			description: 'Authenticated artwork publish flow with visible read-back results.',
			href: '/demo/artwork-publish',
			name: 'Artwork publish demo'
		},
		{
			description:
				'Publishes one artwork and watches live vote updates arrive in another browser context.',
			href: '/demo/artwork-realtime-votes',
			name: 'Artwork realtime vote demo'
		},
		{
			description:
				'Compares 20x bitmap reload degradation against replaying a compact stroke JSON document.',
			href: '/demo/stroke-json',
			name: 'Stroke JSON lab'
		},
		{
			description: 'Minimal smoke route for Playwright server wiring.',
			href: '/demo/playwright',
			name: 'Playwright smoke demo'
		}
	] as const;
</script>

<svelte:head>
	<title>Backend Journey Demos</title>
</svelte:head>

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
