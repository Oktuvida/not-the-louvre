<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageServerData } from './$types';

	let { data }: { data: PageServerData } = $props();
</script>

<h1>Hi, {data.user.nickname}!</h1>
{#if data.recoveryKey}
	<p class="text-emerald-700">New recovery key: {data.recoveryKey}</p>
{/if}
<p>Product user ID: {data.user.id}</p>
<p>Auth user ID: {data.user.authUserId}</p>
<p>Role: {data.user.role}</p>
<p>Backing email: {data.user.email}</p>
<form method="post" action="?/signOut" use:enhance>
	<button class="rounded-md bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700"
		>Sign out</button
	>
</form>
