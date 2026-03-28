<script lang="ts">
	import { resolve } from '$app/paths';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head>
	<title>Artwork Publish Demo</title>
</svelte:head>

<nav>
	<a href={resolve('/demo')}>Back to demo index</a>
	<a href={resolve('/demo/better-auth')}>Back to auth demo</a>
</nav>

<h1>Artwork Publish Demo</h1>
<p>Artwork demo state: authenticated</p>
<p>Signed in as: {data.user.nickname}</p>

<form method="post" action="?/publish" enctype="multipart/form-data">
	<label>
		Artwork title
		<input
			name="title"
			class="mt-1 rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
		/>
	</label>
	<label>
		Artwork media
		<input
			accept="image/avif"
			name="media"
			type="file"
			class="mt-1 rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
		/>
	</label>
	<button class="rounded-md bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700"
		>Publish artwork</button
	>
</form>

<p class="text-red-500">{form?.message ?? ''}</p>

{#if data.publishedArtwork}
	<section aria-label="Published artwork outcome">
		<h2>Published artwork outcome</h2>
		<p>Published artwork ID: {data.publishedArtwork.id}</p>
		<p>Published artwork title: {data.publishedArtwork.title}</p>
		<p>Published artwork author: {data.publishedArtwork.author.nickname}</p>
		<p>Published artwork media URL: {data.publishedArtwork.mediaUrl}</p>
		<p>Published artwork score: {data.publishedArtwork.score}</p>
	</section>
{/if}

<section aria-label="Recent artwork feed">
	<h2>Recent artwork feed</h2>

	{#if data.feed.items.length === 0}
		<p>No artworks published yet.</p>
	{:else}
		<ul>
			{#each data.feed.items as artwork (artwork.id)}
				<li>
					<p>Artwork card ID: {artwork.id}</p>
					<p>Artwork card title: {artwork.title}</p>
					<p>Artwork card author: {artwork.author.nickname}</p>
					<p>Artwork card media URL: {artwork.mediaUrl}</p>
				</li>
			{/each}
		</ul>
	{/if}
</section>
