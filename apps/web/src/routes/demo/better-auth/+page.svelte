<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageServerData } from './$types';

	let { data }: { data: PageServerData } = $props();
</script>

<svelte:head>
	<title>Nickname Auth Demo Session</title>
</svelte:head>

<nav>
	<a href={resolve('/demo')}>Back to demo index</a>
	<a href={resolve('/demo/artwork-publish')}>Open artwork publish demo</a>
</nav>

<h1>Nickname Auth Demo Session</h1>
<p>Authentication demo state: signed in</p>
<p>Signed in as: {data.user.nickname}</p>

{#if data.recoveryKey}
	<p class="text-emerald-700">New recovery key: {data.recoveryKey}</p>
{/if}
<p>Product user ID: {data.user.id}</p>
<p>Auth user ID: {data.user.authUserId}</p>
<p>Role: {data.user.role}</p>
<p>Backing email: {data.user.email}</p>
<form method="post" action="?/signOut">
	<button class="rounded-md bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700"
		>Sign out</button
	>
</form>
