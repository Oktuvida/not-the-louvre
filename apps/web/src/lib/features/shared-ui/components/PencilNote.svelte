<script lang="ts">
	/*
	 * What is wrong with a field, marked the way a teacher marks it: a wavy
	 * line of red pencil under the field and a few words in the margin, with
	 * what to try instead when there is something to try.
	 *
	 * The note goes straight after the field it marks. The field points at it
	 * with `aria-describedby` and says `aria-invalid`, so a screen reader hears
	 * the note as the field's description; the note announces nothing itself.
	 *
	 * Without `underline` it is a margin note on its own, for a word about the
	 * whole form (wait before trying again, the connection dropped), and then
	 * it is the alert, because no field is there to carry it.
	 */
	let {
		id,
		message,
		suggestion,
		underline = true
	}: {
		id?: string;
		message: string;
		suggestion?: string;
		underline?: boolean;
	} = $props();
</script>

<div class="pencil-note" class:pencil-note-alone={!underline}>
	{#if underline}
		<span class="pencil-wave" aria-hidden="true"></span>
	{/if}
	<p {id} class="pencil-words" role={underline ? undefined : 'alert'}>
		{message}
		{#if suggestion}
			<span class="pencil-suggestion">{suggestion}</span>
		{/if}
	</p>
</div>

<style>
	.pencil-note {
		position: relative;
		margin-top: 0.15rem;
	}

	/* One stroke of red pencil, wobbling along under the field: drawn as a
	 * repeating wave so it runs the field's whole width at any size. */
	.pencil-wave {
		display: block;
		height: 0.5rem;
		margin: -0.3rem 0.25rem 0;
		background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='8' viewBox='0 0 24 8'%3E%3Cpath d='M0 4.5 C 3 1.2, 6 1.4, 9 4.2 S 15 7.4, 18 4.4 S 22 1.6, 24 4' fill='none' stroke='%23b8362a' stroke-width='1.7' stroke-linecap='round'/%3E%3C/svg%3E")
			repeat-x left center / 1.5rem 0.5rem;
		opacity: 0.9;
	}

	.pencil-words {
		margin: 0.1rem 0 0;
		padding: 0 0.25rem;
		font-family: var(--font-hand);
		font-size: 1.15rem;
		font-weight: 700;
		line-height: 1.1;
		color: var(--color-pencil);
		rotate: -0.6deg;
		text-wrap: pretty;
	}

	.pencil-suggestion {
		font-weight: 600;
		opacity: 0.85;
	}

	.pencil-note-alone .pencil-words {
		rotate: -1deg;
	}
</style>
