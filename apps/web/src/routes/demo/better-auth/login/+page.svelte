<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';
	import type { ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<h1>Nickname Auth Demo</h1>

<form method="post" action="?/signIn" use:enhance>
	<label>
		Nickname
		<input
			name="nickname"
			class="mt-1 rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
		/>
	</label>
	<label>
		Password
		<input
			type="password"
			name="password"
			class="mt-1 rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
		/>
	</label>
	<button class="rounded-md bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700"
		>Login with nickname</button
	>
	<button
		formaction="?/signUp"
		class="rounded-md bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700"
		>Register</button
	>
</form>

<form method="post" action="?/checkNickname" use:enhance>
	<label>
		Check nickname availability
		<input
			name="nickname"
			class="mt-1 rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
		/>
	</label>
	<button class="rounded-md bg-slate-700 px-4 py-2 text-white transition hover:bg-slate-800"
		>Check nickname</button
	>
</form>

<form method="post" action="?/recover" use:enhance>
	<label>
		Recovery nickname
		<input
			name="recoveryNickname"
			class="mt-1 rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
		/>
	</label>
	<label>
		Recovery key
		<input
			name="recoveryKey"
			class="mt-1 rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
		/>
	</label>
	<label>
		New password
		<input
			type="password"
			name="newPassword"
			class="mt-1 rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
		/>
	</label>
	<button class="rounded-md bg-emerald-700 px-4 py-2 text-white transition hover:bg-emerald-800"
		>Recover account</button
	>
</form>

{#if form?.recoveryKey ?? data.recoveryKey}
	<p class="text-emerald-700">New recovery key: {form?.recoveryKey ?? data.recoveryKey}</p>
{/if}

{#if form?.rotatedRecoveryKey}
	<p class="text-emerald-700">Rotated recovery key: {form.rotatedRecoveryKey}</p>
{/if}

{#if form?.availability}
	<p>Nickname status: {form.availability}</p>
{/if}

<p class="text-red-500">{form?.message ?? ''}</p>
