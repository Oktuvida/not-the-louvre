<script lang="ts">
	import GameButton from '#lib/features/shared-ui/components/GameButton.svelte';
	import type { StaffTextPolicy } from '../model';

	/*
	 * The words the museum will not take, one per line, for each place people
	 * write. "Always allow" lets a harmless word through the list.
	 */
	type PolicyContext = keyof StaffTextPolicy['policies'];
	type Draft = { allowlist: string; blocklist: string };

	let {
		busy = false,
		onSave,
		policy
	}: {
		busy?: boolean;
		onSave: (drafts: Record<PolicyContext, Draft>) => void;
		policy: StaffTextPolicy;
	} = $props();

	const CONTEXTS: { context: PolicyContext; label: string; place: string }[] = [
		{ context: 'nickname', label: 'Names', place: 'What artists call themselves' },
		{ context: 'comment', label: 'Comments', place: 'What people say' },
		{ context: 'artwork_title', label: 'Titles', place: 'What artworks are called' }
	];

	const toDrafts = (snapshot: StaffTextPolicy) =>
		Object.fromEntries(
			CONTEXTS.map(({ context }) => [
				context,
				{
					allowlist: snapshot.policies[context].allowlist.join('\n'),
					blocklist: snapshot.policies[context].blocklist.join('\n')
				}
			])
		) as Record<PolicyContext, Draft>;

	let drafts = $state((() => toDrafts($state.snapshot(policy)))());
</script>

<div class="words-line">
	<p class="desk-line"><b>Words</b> the museum will not take, one per line</p>
	<GameButton variant="accent" size="sm" disabled={busy} onclick={() => onSave(drafts)}>
		Save
	</GameButton>
</div>

<section class="words-sheet">
	{#each CONTEXTS as { context, label, place } (context)}
		<div class="words-group">
			<h3>{label}</h3>
			<p>{place}</p>
			<textarea
				aria-label={`${label}: never allow`}
				placeholder="Never allow"
				rows="6"
				bind:value={drafts[context].blocklist}></textarea>
			<textarea
				aria-label={`${label}: always allow`}
				placeholder="Always allow"
				rows="3"
				bind:value={drafts[context].allowlist}></textarea>
		</div>
	{/each}
</section>

<style>
	.words-line {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.words-sheet {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 1.4rem;
		padding: 1.2rem 1.35rem 1.35rem;
		background-color: #fbf8f2;
		background-image: radial-gradient(rgb(107 90 69 / 0.08) 1px, transparent 1px);
		background-size: 4px 4px;
		box-shadow:
			0 1px 1px rgb(40 25 10 / 0.25),
			0 0.5rem 1.1rem rgb(40 25 10 / 0.26);
	}

	.words-group {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		min-width: 0;
	}

	.words-group h3 {
		margin: 0;
		font-family: var(--font-display);
		font-size: 0.78rem;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: rgb(45 36 32 / 0.68);
	}

	.words-group p {
		margin: 0;
		font-size: 0.9rem;
		color: rgb(45 36 32 / 0.72);
	}

	.words-group textarea {
		width: 100%;
		padding: 0.45rem 0.55rem;
		border: 1.5px solid rgb(107 90 69 / 0.4);
		background: #fff;
		font-family: var(--font-hand);
		font-size: 1.1rem;
		color: var(--color-ink-warm);
		resize: vertical;
	}

	@media (max-width: 39.99rem) {
		.words-sheet {
			grid-template-columns: minmax(0, 1fr);
			padding: 1rem;
		}
	}
</style>
