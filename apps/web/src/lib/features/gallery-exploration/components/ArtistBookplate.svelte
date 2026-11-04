<script lang="ts">
	import '@fontsource/playfair-display/latin-700.css';
	import '@fontsource/special-elite/latin-400.css';
	import type { ArtistStudio } from '#lib/features/gallery-exploration/model/artist-studio.js';

	let { artist }: { artist: ArtistStudio } = $props();

	const counted = (count: number, one: string) => `${count} ${one}${count === 1 ? '' : 's'}`;

	// In UTC: the server and the browser must print the same month.
	const hungSince = new Intl.DateTimeFormat('en', {
		month: 'short',
		timeZone: 'UTC',
		year: 'numeric'
	});

	const summary = $derived.by(() => {
		const { hangingSince, pieces, stars } = artist.stats;
		if (!hangingSince) return 'nothing on the wall yet';
		const since = hungSince.format(new Date(hangingSince));
		return `${counted(pieces, 'piece')} · ${counted(stars, 'star')} · hanging since ${since}`;
	});
</script>

<!-- The label inside the sketchbook's cover, glued to the wall of the studio it
     names: printed heading and border, the owner's name in ink. -->
<aside class="artist-plate" aria-label={`The studio of ${artist.nickname}`}>
	<span class="artist-plate-tape tape" aria-hidden="true"></span>
	<p class="artist-plate-heading">Ex libris</p>
	{#if artist.avatarUrl}
		<img
			class="artist-plate-face"
			src={artist.avatarUrl}
			alt={`Portrait of ${artist.nickname}`}
			width="340"
			height="340"
			decoding="async"
		/>
	{/if}
	<p class="artist-plate-owner">this studio belongs to</p>
	<p class="artist-plate-name">{artist.nickname}</p>
	<p class="artist-plate-summary">{summary}</p>
</aside>

<style>
	.artist-plate {
		position: relative;
		width: min(21rem, 100%);
		padding: 1.15rem 1.25rem 1.1rem;
		rotate: -1.2deg;
		background: #fbf6ea;
		box-shadow:
			0 1px 1px rgb(0 0 0 / 0.1),
			0 10px 22px rgb(40 25 10 / 0.34);
		color: #4a3524;
		text-align: center;
	}

	.artist-plate::before {
		content: '';
		position: absolute;
		inset: 0.35rem;
		border: 1.5px solid #8c6a46;
		outline: 1px solid #8c6a46;
		outline-offset: -0.3rem;
		pointer-events: none;
	}

	.artist-plate-tape {
		position: absolute;
		top: -0.7rem;
		left: 50%;
		width: 5rem;
		height: 1.4rem;
		translate: -50% 0;
		rotate: 2deg;
	}

	.artist-plate-heading {
		margin: 0.2rem 0 0.4rem;
		font-family: 'Playfair Display', serif;
		font-size: 0.9rem;
		font-weight: 700;
		letter-spacing: 0.3em;
		text-transform: uppercase;
	}

	/* The artist's face, in the label's own printed rule: it leads the plate. */
	.artist-plate-face {
		display: block;
		width: 8rem;
		height: 8rem;
		margin: 0.5rem auto 0.6rem;
		border: 1.5px solid #8c6a46;
		border-radius: 50%;
		outline: 1px solid #8c6a46;
		outline-offset: 3px;
		background: #fffdf9;
	}

	.artist-plate-owner {
		margin: 0;
		font-family: 'Special Elite', 'Courier New', monospace;
		font-size: 0.8rem;
		line-height: 1.3;
	}

	.artist-plate-name {
		margin: 0.15rem 0 0;
		overflow-wrap: anywhere;
		color: #1f2a44;
		font-family: var(--font-hand);
		font-size: 2rem;
		font-weight: 700;
		line-height: 1.05;
	}

	.artist-plate-summary {
		margin: 0.45rem 0 0;
		padding-top: 0.4rem;
		border-top: 1px dotted rgb(74 53 36 / 0.5);
		font-family: 'Special Elite', 'Courier New', monospace;
		font-size: 0.75rem;
		line-height: 1.35;
	}
</style>
