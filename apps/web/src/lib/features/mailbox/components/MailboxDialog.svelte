<script lang="ts">
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { ApiError, requestJson } from '#lib/client/api.js';
	import MailboxDrawing from '#lib/features/mailbox/components/MailboxDrawing.svelte';
	import { focusTrap } from '#lib/features/shared-ui/actions/focus-trap.js';
	import GameButton from '#lib/features/shared-ui/components/GameButton.svelte';
	import PencilNote from '#lib/features/shared-ui/components/PencilNote.svelte';
	import WishSlip from '#lib/features/shared-ui/components/WishSlip.svelte';
	import { WISHES_IN_HAND, WISH_MAX_LENGTH, type Wish } from '#lib/shared/content/wishes.js';

	/** Enough to go through "show me others" a few times without repeats. */
	const SLIPS_REMEMBERED = 30;

	let {
		onClose,
		onTake,
		request = fetch
	}: {
		onClose: () => void;
		onTake: (wish: Wish) => void;
		request?: typeof fetch;
	} = $props();

	let slips = $state<Wish[]>([]);
	let box = $state<'empty' | 'opening' | 'open' | 'stuck'>('opening');
	let seen: string[] = [];

	let wishText = $state('');
	let refusal = $state('');
	let isLeaving = $state(false);
	let hasLeftOne = $state(false);

	const takeOutSlips = async () => {
		try {
			const query = seen.length > 0 ? `?seen=${seen.map(encodeURIComponent).join(',')}` : '';
			const { wishes } = await requestJson<{ wishes: Wish[] }>(`/api/wishes${query}`, {
				fetch: request
			});
			slips = wishes;
			seen = [...seen, ...wishes.map((wish) => wish.id)].slice(-SLIPS_REMEMBERED);
			box = wishes.length > 0 ? 'open' : 'empty';
		} catch {
			box = 'stuck';
		}
	};

	const leaveSlip = async (event: SubmitEvent) => {
		event.preventDefault();
		if (isLeaving || !wishText.trim()) return;

		isLeaving = true;
		refusal = '';
		hasLeftOne = false;

		try {
			await requestJson('/api/wishes', {
				fetch: request,
				json: { text: wishText },
				method: 'POST'
			});
			wishText = '';
			hasLeftOne = true;
		} catch (error) {
			refusal =
				error instanceof ApiError ? error.message : 'It did not reach the box. Please try again.';
		} finally {
			isLeaving = false;
		}
	};

	onMount(() => {
		void takeOutSlips();
	});
</script>

<div
	class="mailbox-dialog"
	role="dialog"
	aria-modal="true"
	aria-label="The Mailbox"
	tabindex="-1"
	use:focusTrap={{ autoFocus: true, restoreFocus: true }}
	transition:fade={{ duration: 180 }}
	onkeydown={(event) => {
		if (event.key === 'Escape') onClose();
	}}
>
	<div class="mailbox-back">
		<GameButton type="button" variant="secondary" onclick={onClose}>
			<span>Back to the room</span>
		</GameButton>
	</div>

	<div class="mailbox-room">
		<div class="mailbox-picture"><MailboxDrawing /></div>

		<div class="mailbox-papers">
			<section class="mailbox-take" aria-labelledby="mailbox-take-heading">
				<h2 id="mailbox-take-heading" class="mailbox-words">Take one and draw it</h2>

				{#if box === 'opening'}
					<p class="mailbox-words mailbox-note">Opening the box…</p>
				{:else if box === 'empty'}
					<p class="mailbox-words mailbox-note">No slips from other artists yet.</p>
				{:else if box === 'stuck'}
					<p class="mailbox-words mailbox-note">The box is stuck.</p>
					<button type="button" class="mailbox-more focus-ring" onclick={takeOutSlips}>
						try again
					</button>
				{:else}
					<ul class="mailbox-slips-list" aria-label="Slips">
						{#each slips as wish, index (wish.id)}
							<li>
								<button
									type="button"
									class="mailbox-slip focus-ring"
									aria-label={`Draw this: ${wish.text}, left by ${wish.author}`}
									onclick={() => onTake(wish)}
								>
									<WishSlip text={wish.text} byline={wish.author} tilt={[-1.4, 1.2, -0.8][index]} />
								</button>
							</li>
						{/each}
					</ul>
					{#if slips.length >= WISHES_IN_HAND}
						<button type="button" class="mailbox-more focus-ring" onclick={takeOutSlips}>
							show me others
						</button>
					{/if}
				{/if}
			</section>

			<form class="mailbox-leave" onsubmit={leaveSlip}>
				<label for="mailbox-wish" class="mailbox-words">or leave one</label>
				<WishSlip tilt={0.8}>
					<input
						id="mailbox-wish"
						class="mailbox-input"
						type="text"
						bind:value={wishText}
						maxlength={WISH_MAX_LENGTH}
						placeholder="I'd love to see…"
						autocomplete="off"
						aria-describedby={refusal ? 'mailbox-wish-note' : undefined}
						aria-invalid={refusal ? 'true' : undefined}
						oninput={() => {
							refusal = '';
							hasLeftOne = false;
						}}
					/>
					{#if refusal}
						<PencilNote id="mailbox-wish-note" message={refusal} />
					{/if}
				</WishSlip>
				<div class="mailbox-foot">
					{#if hasLeftOne}
						<p class="mailbox-words mailbox-left" role="status">
							In the box. Somebody may draw it.
						</p>
					{/if}
					<span class="mailbox-count">{wishText.length} / {WISH_MAX_LENGTH}</span>
					<GameButton type="submit" variant="primary" disabled={isLeaving}>
						<span>Into the box</span>
					</GameButton>
				</div>
			</form>
		</div>
	</div>
</div>

<style>
	.mailbox-dialog {
		position: fixed;
		inset: 0;
		z-index: 50;
		overflow-y: auto;
		overscroll-behavior: contain;
		background: rgb(0 0 0 / 0.65);
		backdrop-filter: blur(4px);
	}

	.mailbox-back {
		position: absolute;
		top: 1.5rem;
		left: 2rem;
		z-index: 1;
	}

	/* The box on one side and the paper on the other; upright, one over the
	 * other. */
	.mailbox-room {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 36rem);
		gap: clamp(1.5rem, 4vw, 4rem);
		align-items: center;
		min-height: 100%;
		padding: 5.5rem clamp(1.5rem, 6vw, 6rem) 2.5rem;
	}

	.mailbox-picture {
		justify-self: center;
		width: min(100%, 30rem);
	}

	.mailbox-papers {
		display: flex;
		flex-direction: column;
		gap: 1.75rem;
		min-width: 0;
	}

	.mailbox-take,
	.mailbox-leave {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.85rem;
	}

	.mailbox-words {
		margin: 0;
		font-family: var(--font-hand);
		font-size: 1.7rem;
		font-weight: 600;
		line-height: 1;
		color: #fbf3e4;
		text-shadow: 0 1px 3px rgb(20 12 6 / 0.7);
	}

	.mailbox-note {
		font-size: 1.35rem;
		font-weight: 500;
	}

	.mailbox-slips-list {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.9rem;
		width: 100%;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.mailbox-slips-list li {
		max-width: 100%;
	}

	.mailbox-slips-list li:nth-child(2) {
		margin-left: 2.2rem;
	}

	.mailbox-slips-list li:nth-child(3) {
		margin-left: 0.8rem;
	}

	.mailbox-slip {
		display: block;
		max-width: 100%;
		padding: 0;
		border: 0;
		background: none;
		text-align: left;
		cursor: pointer;
		transition: transform var(--duration-fast) ease;
	}

	.mailbox-slip:hover {
		transform: translateY(-3px) rotate(-0.6deg);
	}

	.mailbox-slip:active {
		transform: translateY(1px);
	}

	.mailbox-more {
		padding: 0.25rem 0;
		border: 0;
		background: none;
		font-family: var(--font-hand);
		font-size: 1.3rem;
		color: #fbf3e4;
		text-decoration: underline dotted;
		text-underline-offset: 4px;
		text-shadow: 0 1px 3px rgb(20 12 6 / 0.7);
		cursor: pointer;
	}

	.mailbox-leave :global(.wish-slip) {
		width: 100%;
	}

	.mailbox-input {
		display: block;
		width: 100%;
		padding: 0.2rem 0 0.1rem;
		border: 0;
		outline: none;
		background: none;
		font-family: var(--font-hand);
		font-size: 1.5rem;
		font-weight: 600;
		color: var(--color-ink-warm);
	}

	.mailbox-input::placeholder {
		color: rgb(45 36 32 / 0.6);
	}

	.mailbox-foot {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem 1.1rem;
		align-items: center;
		justify-content: flex-end;
		width: 100%;
	}

	.mailbox-left {
		flex: 1 1 100%;
		font-size: 1.35rem;
		font-weight: 500;
	}

	.mailbox-count {
		font-family: var(--font-hand);
		font-size: 1.1rem;
		color: #fbf3e4;
		text-shadow: 0 1px 3px rgb(20 12 6 / 0.7);
	}

	@media (orientation: portrait), (max-width: 56rem) {
		.mailbox-back {
			top: 1rem;
			left: 1rem;
		}

		.mailbox-room {
			grid-template-columns: minmax(0, 1fr);
			gap: 1rem;
			align-content: start;
			padding: 5rem 1rem 1.25rem;
		}

		.mailbox-picture {
			width: min(62vw, 15.5rem);
		}

		.mailbox-papers {
			gap: 1.1rem;
		}

		.mailbox-take,
		.mailbox-leave {
			gap: 0.6rem;
		}

		.mailbox-words {
			font-size: 1.45rem;
		}

		.mailbox-slips-list {
			gap: 0.55rem;
		}

		.mailbox-slips-list li:nth-child(2) {
			margin-left: 0.8rem;
		}

		.mailbox-slips-list li:nth-child(3) {
			margin-left: 0.2rem;
		}

		.mailbox-slip {
			--slip-padding: 0.45rem 1rem 0.35rem 1.1rem;
			--slip-text: 1.28rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.mailbox-slip {
			transition: none;
		}
	}
</style>
