<script lang="ts">
	import type { ArtistStudio } from '#lib/features/gallery-exploration/model/artist-studio.js';
	import Bookplate from '#lib/features/shared-ui/components/Bookplate.svelte';

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

<Bookplate
	heading="Ex libris"
	label={`The studio of ${artist.nickname}`}
	line="this studio belongs to"
	name={artist.nickname}
	photo={artist.avatarUrl}
	photoAlt={`Portrait of ${artist.nickname}`}
>
	{summary}
</Bookplate>
