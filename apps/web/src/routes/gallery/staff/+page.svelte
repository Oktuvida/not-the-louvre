<script lang="ts">
	import Bookplate from '#lib/features/shared-ui/components/Bookplate.svelte';
	import { KOFI_HANDLE } from '#lib/features/shared-ui/support.js';

	/*
	 * By the names they go by. The photos are their GitHub profile pictures,
	 * read from GitHub each time, so they stay whatever each of them has there.
	 */
	const staff = [
		{ discord: 'hi__there', github: 'GH-Jaider', kofi: KOFI_HANDLE, name: 'HiThere', tilt: -1.2 },
		{ discord: 'oktuvida', github: 'Oktuvida', name: 'Oktuvida', tilt: 1 }
	];
</script>

<div class="staff">
	<h1 class="staff-title">Museum staff</h1>
	<div class="staff-plates">
		{#each staff as member (member.github)}
			<Bookplate
				heading="Staff"
				label={`${member.name}, museum staff`}
				line="keeps this museum"
				name={member.name}
				photo={`https://github.com/${member.github}.png?size=320`}
				photoAlt={member.name}
				tilt={member.tilt}
			>
				<a
					class="staff-link focus-ring"
					href={`https://github.com/${member.github}`}
					rel="noopener noreferrer"
					target="_blank">GitHub</a
				>
				· Discord: {member.discord}
				{#if member.kofi}
					·
					<a
						class="staff-link focus-ring"
						href={`https://ko-fi.com/${member.kofi}`}
						rel="noopener noreferrer"
						target="_blank">Ko-fi</a
					>
				{/if}
			</Bookplate>
		{/each}
	</div>
</div>

<style>
	.staff {
		position: relative;
		z-index: 10;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2.5rem;
		padding: 2.5rem 1rem 4rem;
	}

	/* Pencilled on a slip of paper, as the Mystery Room's line is. */
	.staff-title {
		margin: 0;
		padding: 0.3rem 1rem 0.35rem;
		rotate: -1deg;
		background: #fffdf8;
		box-shadow:
			0 1px 1px rgb(0 0 0 / 0.1),
			0 4px 10px rgb(40 25 10 / 0.25);
		color: #5a4a3c;
		font-family: var(--font-hand);
		font-size: 1.6rem;
		font-weight: 600;
		line-height: 1.2;
	}

	.staff-plates {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 2.5rem;
		width: min(46rem, 100%);
	}

	.staff-link {
		color: #1f2a44;
		text-decoration: underline dotted currentColor;
		text-underline-offset: 3px;
	}
</style>
