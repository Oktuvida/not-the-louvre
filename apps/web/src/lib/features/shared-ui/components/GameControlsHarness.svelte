<script lang="ts">
	import GameButton from './GameButton.svelte';
	import GameLink from './GameLink.svelte';
</script>

<div>
	<GameButton variant="accent" size="lg">
		<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 2v20" /></svg>
		<span>Create Art</span>
	</GameButton>

	<GameButton variant="ghost" size="sm" disabled>
		<span>Cancel</span>
	</GameButton>

	<GameLink href="/gallery" variant="secondary" size="md">
		<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 2v20" /></svg>
		<span>Gallery</span>
	</GameLink>

	<GameLink href="/draw" variant="ghost" size="sm">
		<span>Back</span>
	</GameLink>
</div>
