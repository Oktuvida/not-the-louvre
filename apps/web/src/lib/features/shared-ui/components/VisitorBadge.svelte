<script lang="ts">
	import { UserRound } from 'lucide-svelte';
	import { hashString } from '#lib/features/artwork-presentation/model/frame.js';

	const BADGE_COLORS = [
		// Each dark enough for the paper-white lettering on it (at least 4.6:1).
		{ fill: '#c04b4b', footer: '#c04b4b' },
		{ fill: '#4476a8', footer: '#4476a8' },
		{ fill: '#497e49', footer: '#497e49' },
		{ fill: '#9e6539', footer: '#9e6539' },
		{ fill: '#8565a7', footer: '#8565a7' }
	] as const;

	let {
		avatarUrl = null,
		className = '',
		nickname,
		onclick,
		userId
	}: {
		avatarUrl?: string | null;
		className?: string;
		nickname: string;
		onclick?: () => void;
		userId: string;
	} = $props();

	const colorIndex = $derived(hashString(userId) % BADGE_COLORS.length);
	const palette = $derived(BADGE_COLORS[colorIndex]!);
	const rotation = $derived((hashString(userId) % 5) - 2);
	let imageFailed = $state(false);

	// Reset failure state whenever the avatar URL changes so a new image can attempt to load
	$effect(() => {
		void avatarUrl;
		imageFailed = false;
	});
</script>

<button
	type="button"
	class={`visitor-badge relative w-[16.875em] overflow-visible text-left ${onclick ? 'cursor-pointer transition-transform duration-200 hover:scale-105 active:scale-[0.98]' : ''} ${className}`}
	style={`--badge-rotate: ${rotation}deg;`}
	{onclick}
	aria-label={onclick ? `Edit avatar for ${nickname}` : undefined}
>
	<!-- Tape on top (sits outside the rounded card) -->
	<span
		class="badge-tape tape pointer-events-none absolute top-[-0.625em] left-1/2 z-3 h-[1.25em] w-[4em] -translate-x-1/2 -rotate-2"
		aria-hidden="true"
	></span>

	<!-- Rounded card container -->
	<div
		class="overflow-hidden rounded-xl border-[2px] border-black/10"
		style="box-shadow: var(--shadow-sheet);"
	>
		<!-- Colored header: the HELLO tag is decoration; the button names itself. -->
		<div style={`background:${palette.fill};`} aria-hidden="true">
			<p
				class="px-[1em] pt-[0.55em] pb-[0.15em] text-center font-display text-[1.15em] font-bold tracking-[0.06em] text-paper-bright uppercase"
			>
				HELLO
			</p>
			<p
				class="px-[1em] pb-[0.5em] text-center font-display text-[0.62em] font-semibold tracking-[0.15em] text-paper-bright uppercase"
			>
				MY NAME IS
			</p>
		</div>

		<!-- White body -->
		<div class="flex items-center gap-[0.75em] bg-paper-bright px-[1.2em] py-[0.9em]">
			<div
				class="flex h-[3.25em] w-[3.25em] min-w-[3.25em] shrink-0 items-center justify-center overflow-hidden rounded-full border-[0.1875em] border-ink-warm bg-sand"
			>
				{#if avatarUrl && !imageFailed}
					<img
						src={avatarUrl}
						alt={nickname}
						class="h-full w-full object-cover"
						onerror={() => {
							imageFailed = true;
						}}
					/>
				{:else}
					<UserRound class="h-[1.75em] w-[1.75em] text-muted-ink" />
				{/if}
			</div>

			<div class="min-w-0 flex-1">
				<p
					class="truncate text-[1.7em] leading-[1.1] font-bold text-ink-warm"
					style="font-family: var(--font-hand);"
				>
					{nickname}
				</p>
			</div>
		</div>

		<!-- Colored footer strip -->
		<div class="h-[0.3em]" style={`background:${palette.footer};`}></div>
	</div>
</button>

<style>
	/* The pinned tilt is the standalone `rotate` property, not a `transform`, so
	 * the global `button:active { scale }` press and the `hover:scale-105` /
	 * `active:scale-[0.98]` utilities all compose with it instead of replacing
	 * it and snapping the badge straight under the pointer. */
	.visitor-badge {
		rotate: var(--badge-rotate, 0deg);
	}

	/* Drawn in em throughout: the badge is as big as the text around it, so a
	 * page can show it smaller where room is short (a phone, a short window)
	 * and it grows with the page on a big screen. */
</style>
