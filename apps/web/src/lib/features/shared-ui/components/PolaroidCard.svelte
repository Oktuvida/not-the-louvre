<script lang="ts" module>
	const EMPTY_REVEALED_IDS: ReadonlySet<string> = new Set<string>();
</script>

<script lang="ts">
	import type { Artwork } from '#lib/features/artwork-presentation/model/artwork.js';
	import { hashString } from '#lib/features/artwork-presentation/model/frame.js';
	import { isArtworkBlurred } from '#lib/features/gallery-exploration/model/sensitivity.js';
	import NsfwImage from '#lib/features/gallery-exploration/components/NsfwImage.svelte';

	let {
		artwork,
		className = '',
		onclick,
		onPointerIntent,
		testId,
		viewerId = null,
		adultContentEnabled = false,
		revealed = false,
		onReveal,
		imageLoading = 'lazy'
	}: {
		artwork: Artwork;
		className?: string;
		onclick?: () => void;
		onPointerIntent?: () => void;
		testId?: string;
		viewerId?: string | null;
		adultContentEnabled?: boolean;
		revealed?: boolean;
		onReveal?: () => void;
		imageLoading?: 'eager' | 'lazy';
	} = $props();

	// Fallback for callers that don't own the reveal state; controlled `revealed`
	// survives virtualization unmounts, this one intentionally does not.
	let internalRevealed = $state(false);

	const revealedIds = $derived<ReadonlySet<string>>(
		revealed || internalRevealed ? new Set([artwork.id]) : EMPTY_REVEALED_IDS
	);
	const blurred = $derived(
		isArtworkBlurred(artwork, { adultContentEnabled, id: viewerId, revealedIds })
	);

	// Only signed-in viewers may reveal; signed-out clicks fall through to the
	// details panel, which keeps the blur and shows the sign-in notice.
	const canReveal = $derived(viewerId !== null);

	const handleClick = () => {
		if (blurred && canReveal) {
			internalRevealed = true;
			onReveal?.();
			return;
		}
		onclick?.();
	};

	// Intent, not hover: pointerdown lands 80-150ms before the click on every
	// input type, so the detail request is already in flight when the panel
	// opens — and a pointer sweeping the wall costs nothing. A press that only
	// uncovers a blurred card is not intent to open it.
	const signalIntent = () => {
		if (blurred && canReveal) return;
		onPointerIntent?.();
	};

	// Touch is the exception: `pointerdown` fires the moment a finger lands,
	// before the browser can tell a tap from the start of a scroll, and the
	// `pointercancel` that follows a flick cannot recall a request already sent.
	// A phone scrolling a wall of cards would spend two uncacheable round trips
	// per gesture, so touch waits for the panel's own request.
	const signalPointerIntent = (event: PointerEvent) => {
		if (event.pointerType === 'touch') return;
		signalIntent();
	};

	// The keyboard equivalent. Space activates the button on keyup, so this is
	// the same 80-150ms head start; Enter activates on keydown, where it costs
	// nothing and still beats the panel's own request.
	const handleKeydown = (event: KeyboardEvent) => {
		if (event.key !== 'Enter' && event.key !== ' ') return;
		signalIntent();
	};

	const seed = $derived(hashString(artwork.id));
	const attachment = $derived(seed % 2 === 0 ? 'tape' : 'pin');
	const rotation = $derived((seed % 7) - 3 || 1);
	const tapeVariant = $derived(seed % 3);
	const pinClass = $derived(
		['pin-blue', 'pin-red', 'pin-green', 'pin-yellow'][seed % 4] ?? 'pin-blue'
	);
	const isFork = $derived(Boolean(artwork.lineage?.isFork));
	const forkParentTitle = $derived(
		artwork.lineage?.parentStatus === 'available' ? (artwork.lineage.parent?.title ?? null) : null
	);
	// Paint stain position/color — deterministic per card
	const stainVariant = $derived(seed % 5);
	const stainColor = $derived(
		[
			'rgba(74,127,181,0.07)',
			'rgba(200,79,79,0.07)',
			'rgba(93,186,93,0.06)',
			'rgba(244,196,48,0.08)',
			'rgba(139,106,174,0.07)'
		][seed % 5] ?? 'rgba(74,127,181,0.07)'
	);
</script>

<button
	type="button"
	class={`polaroid-card group relative cursor-pointer text-left ${className}`}
	data-testid={testId}
	style={`--card-rotate: ${rotation}deg;`}
	onclick={handleClick}
	onpointerdown={signalPointerIntent}
	onkeydown={handleKeydown}
>
	<div
		class="polaroid relative bg-paper-card p-[0.5em] pb-0 shadow-sheet transition duration-200 group-hover:z-5 group-hover:scale-[1.06] group-active:scale-[0.97]"
	>
		<!-- Paint stain decoration -->
		<div
			class="pointer-events-none absolute rounded-full opacity-100"
			style={`
				background: ${stainColor};
				width: ${(28 + (seed % 20)) / 16}em;
				height: ${(24 + (seed % 16)) / 16}em;
				${stainVariant === 0 ? 'bottom: 0.75em; right: -0.375em;' : stainVariant === 1 ? 'top: -0.25em; right: 0.625em;' : stainVariant === 2 ? 'bottom: 0.5em; left: -0.25em;' : stainVariant === 3 ? 'top: 50%; left: -0.5em;' : 'bottom: -0.25em; right: 0.875em;'}
				filter: blur(0.25em);
				transform: rotate(${(seed % 40) - 20}deg);
			`}
		></div>

		{#if attachment === 'tape'}
			<div
				class={`pointer-events-none absolute z-3 h-[1em] w-[3em] border border-[rgba(200,190,170,0.3)] bg-[rgba(255,255,240,0.55)] ${tapeVariant === 0 ? 'top-[-0.4375em] left-1/2 -translate-x-1/2 -rotate-3' : tapeVariant === 1 ? 'top-[-0.375em] left-[0.5em] rotate-[12deg]' : 'top-[-0.375em] right-[0.375em] -rotate-[8deg]'}`}
			></div>
		{:else}
			<div
				class={`polaroid-pin pointer-events-none absolute top-[-0.375em] left-1/2 z-4 h-[0.875em] w-[0.875em] -translate-x-1/2 rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.3)] ${pinClass}`}
			></div>
		{/if}

		<!-- Image area -->
		<div class="relative aspect-square overflow-hidden border border-hairline">
			{#if isFork}
				<div
					class="absolute top-[0.75em] left-[0.75em] z-10 rounded-full border-2 border-ink-warm bg-[#f7d58a] px-[0.75em] py-[0.25em] text-[0.65em] font-black tracking-[0.18em] text-ink-warm uppercase shadow-md"
				>
					Forked
				</div>
			{/if}
			{#if artwork.isHidden}
				<!-- Only its author (in their studio) and moderators ever see a
				     hidden artwork: the label says why nobody else does. -->
				<div
					class="absolute bottom-[0.75em] left-[0.75em] z-10 rounded-full border-2 border-ink-warm bg-paper-bright px-[0.75em] py-[0.25em] text-[0.65em] font-black tracking-[0.12em] text-ink-warm uppercase shadow-md"
				>
					Hidden · pending review
				</div>
			{/if}
			<NsfwImage
				src={artwork.imageUrl}
				alt={artwork.title}
				{blurred}
				ariaLabel={blurred
					? canReveal
						? 'Sensitive artwork, click to reveal'
						: 'Sensitive artwork'
					: undefined}
				loading={imageLoading}
				className="h-full w-full object-cover"
			/>
		</div>

		<!-- Caption area -->
		<div class="flex items-start gap-[0.75em] px-[0.375em] pt-[0.5em] pb-[0.625em]">
			<div
				class="flex h-[2em] w-[2em] min-w-[2em] shrink-0 items-center justify-center overflow-hidden rounded-full border-[0.15625em] border-ink-warm bg-sand shadow-[1px_2px_4px_rgba(0,0,0,0.15)]"
			>
				{#if artwork.artistAvatar}
					<!-- The artwork is what the visitor came for: keep the avatar out of
					     its way instead of racing it at the same priority. -->
					<img
						src={artwork.artistAvatar}
						alt={artwork.artist}
						loading="lazy"
						decoding="async"
						fetchpriority="low"
						class="h-full w-full object-cover"
					/>
				{:else}
					<div class="h-full w-full bg-[linear-gradient(135deg,#c4b5a0,#a89680)]"></div>
				{/if}
			</div>

			<div class="min-w-0 flex-1">
				<p
					class="truncate text-[1.05em] leading-[1.2] font-semibold text-ink-warm"
					style="font-family: var(--font-hand);"
				>
					{artwork.title}
				</p>
				<p
					class="truncate text-[max(0.82em,0.75rem)] text-muted-ink"
					style="font-family: var(--font-hand);"
				>
					{artwork.artist}
				</p>
				{#if isFork}
					<p
						class="truncate font-display text-[max(0.7em,0.75rem)] font-semibold tracking-[0.08em] text-[#8a6a42] uppercase"
					>
						{forkParentTitle ? `From ${forkParentTitle}` : 'Forked artwork'}
					</p>
				{/if}
			</div>

			<div
				class="shrink-0 pt-[0.125em] text-right font-display text-[max(0.7em,0.75rem)] leading-[1.2] tracking-[0.04em] text-muted-ink"
			>
				<div data-testid={testId ? `${testId}-score` : undefined}>
					&#11088; {artwork.score}
				</div>
				<div data-testid={testId ? `${testId}-comments` : undefined}>
					&#128172; {artwork.commentCount ?? artwork.comments.length}
				</div>
			</div>
		</div>
	</div>
</button>

<style>
	/* The hand-pinned tilt lives on the element that straightens, expressed as
	 * the standalone `rotate` property: it composes with the global
	 * `button:active { scale }` press instead of being replaced by it, and it
	 * lets the designed "card straightens under the pointer" actually happen —
	 * the old `group-hover:rotate-0` sat on the inner div, which never rotated. */
	.polaroid-card {
		rotate: var(--card-rotate, 0deg);
		transition: rotate var(--duration-ui) ease;
		/* The card is drawn to its own width, like a picture: everything inside
		 * is in em, and the em comes from how wide the card is, so a card on a
		 * big screen is the same polaroid scaled up rather than a bigger photo
		 * with the same small caption. 16px on a 373px card, the laptop size.
		 * The card takes its width from where it is placed (a grid cell), never
		 * from its content, which is what lets it be a size container; that is
		 * load-bearing, so it is set here rather than with utility classes. */
		display: block;
		width: 100%;
		container-type: inline-size;
	}

	.polaroid {
		font-size: clamp(0.8125rem, 4.29cqi, 1.5rem);
	}

	.polaroid-card:hover {
		rotate: 0deg;
	}

	@media (prefers-reduced-motion: reduce) {
		.polaroid-card {
			transition: none;
		}
	}

	.pin-blue {
		background: radial-gradient(circle at 0.25em 0.25em, #4a90d9, #2d6bb5);
	}

	.pin-red {
		background: radial-gradient(circle at 0.25em 0.25em, var(--color-alert), #c0392b);
	}

	.pin-green {
		background: radial-gradient(circle at 0.25em 0.25em, #5dba5d, #3a8f3a);
	}

	.pin-yellow {
		background: radial-gradient(circle at 0.25em 0.25em, var(--color-gold), #d4a017);
	}

	/* Pin highlight dot */
	.polaroid-pin::after {
		content: '';
		position: absolute;
		top: 0.1875em;
		left: 0.25em;
		width: 0.25em;
		height: 0.25em;
		background: rgba(255, 255, 255, 0.35);
		border-radius: 50%;
	}
</style>
