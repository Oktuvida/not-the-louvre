<script lang="ts">
	import type { Artwork } from '#lib/features/artwork-presentation/model/artwork.js';
	import GameButton from '#lib/features/shared-ui/components/GameButton.svelte';
	import type { Writable } from 'svelte/store';
	import FilmReel from './FilmReel.svelte';

	let {
		adultContentEnabled = false,
		fetchRandomArtwork,
		onSelect,
		postcardOpen = false,
		revealedArtworkIds,
		viewerId = null
	}: {
		adultContentEnabled?: boolean;
		fetchRandomArtwork?: () => Promise<Artwork>;
		onSelect?: (artwork: Artwork) => void;
		postcardOpen?: boolean;
		revealedArtworkIds?: Writable<Set<string>>;
		viewerId?: string | null;
	} = $props();

	let filmReel: ReturnType<typeof FilmReel> | undefined = $state();
	let isSpinning = $state(false);
	let spinErrorMessage = $state<string | null>(null);
	let openTimer: ReturnType<typeof setTimeout> | null = null;
	let waitingToOpen = $state(false);

	// Long enough to look at what came up before the postcard covers it.
	const OPEN_AFTER_MS = 600;
	// The room's own voice: the visitor does not care that a fetch rejected.
	const SPIN_FAILURE_MESSAGE = 'That spin came up empty — give it another go.';

	const stopWaitingToOpen = () => {
		if (openTimer !== null) clearTimeout(openTimer);
		openTimer = null;
		waitingToOpen = false;
	};

	const handleSpin = async () => {
		if (isSpinning || !fetchRandomArtwork) return;
		stopWaitingToOpen();
		isSpinning = true;
		spinErrorMessage = null;

		/*
		 * The line leaves on the click and the fetch brings it down when it
		 * lands. Waiting for the round trip first left the button disabled over
		 * a completely still line, which reads as a broken control on any
		 * connection slower than localhost.
		 */
		filmReel?.startFreeSpin();

		try {
			const artwork = await fetchRandomArtwork();
			// The line refuses an artwork when no spin is under way; without this
			// the room would sit disabled over a spin that never lands.
			if (filmReel?.spinToArtwork(artwork) === false) {
				throw new Error(SPIN_FAILURE_MESSAGE);
			}
		} catch {
			filmReel?.cancelFreeSpin();
			spinErrorMessage = SPIN_FAILURE_MESSAGE;
			isSpinning = false;
		}
	};

	const handleDeveloped = (artwork: Artwork) => {
		stopWaitingToOpen();
		waitingToOpen = true;
		openTimer = setTimeout(() => {
			onSelect?.(artwork);
			openTimer = null;
			waitingToOpen = false;
		}, OPEN_AFTER_MS);
	};

	const handleOpen = (artwork: Artwork) => {
		stopWaitingToOpen();
		onSelect?.(artwork);
	};

	// Destroy-only: no postcard should open after the room is gone.
	$effect(() => stopWaitingToOpen);
</script>

<div class="relative flex flex-col items-center gap-5 md:gap-6" data-testid="mystery-room">
	<!-- From one edge of the window to the other: the room's padding is the
	     gallery's, so the line takes it back. -->
	<div class="-mx-4 self-stretch md:-mx-8">
		<FilmReel
			bind:this={filmReel}
			{adultContentEnabled}
			held={waitingToOpen || postcardOpen}
			onDeveloped={handleDeveloped}
			onLand={() => (isSpinning = false)}
			onOpen={handleOpen}
			{revealedArtworkIds}
			{viewerId}
		/>
	</div>

	<GameButton
		type="button"
		variant="danger"
		size="hero"
		className="justify-center shadow-2xl"
		disabled={isSpinning}
		onclick={handleSpin}
	>
		<span>{isSpinning ? 'SPINNING…' : 'Spin!'}</span>
	</GameButton>

	{#if spinErrorMessage}
		<p class="spin-error" data-testid="mystery-spin-error" role="alert">
			{spinErrorMessage}
		</p>
	{/if}

	<p class="mystery-slip">Discover a random masterpiece… hopefully</p>
</div>

<style>
	/* Paper-on-wall, like the room's other copy — a failure on the dark museum
	 * wall still has to be readable. */
	.spin-error {
		max-width: 22rem;
		text-align: center;
		font-size: 0.8125rem;
		font-weight: 600;
		color: #f7c8b8;
		text-shadow: 0 1px 2px rgba(45, 36, 32, 0.6);
	}

	/* Pencilled on a slip of paper, as the studio's Tear out is. On a phone it
	 * takes two lines, to stay clear of the record player in the corner. */
	.mystery-slip {
		max-width: min(13rem, 100%);
		margin: 0;
		padding: 0.3rem 0.85rem 0.35rem;
		rotate: -1deg;
		background: #fffdf8;
		box-shadow:
			0 1px 1px rgb(0 0 0 / 0.1),
			0 4px 10px rgb(40 25 10 / 0.25);
		color: #5a4a3c;
		font-family: var(--font-hand);
		font-size: 1.15rem;
		font-weight: 500;
		line-height: 1.2;
		text-align: center;
	}

	@media (min-width: 40rem) {
		.mystery-slip {
			max-width: none;
		}
	}
</style>
