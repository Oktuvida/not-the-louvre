<script lang="ts">
	import { UserRound } from 'lucide-svelte';
	import { hashString } from '#lib/features/artwork-presentation/model/frame.js';

	const BADGE_COLORS = [
		{ fill: '#c84f4f', footer: '#c84f4f' },
		{ fill: '#4a7fb5', footer: '#4a7fb5' },
		{ fill: '#5a9a5a', footer: '#5a9a5a' },
		{ fill: '#d4874d', footer: '#d4874d' },
		{ fill: '#8b6aae', footer: '#8b6aae' }
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
	<div
		class="badge-tape pointer-events-none absolute top-[-0.5em] left-1/2 z-3 h-[1.125em] w-[3.375em] -translate-x-1/2 -rotate-2 border border-[rgba(200,190,170,0.3)] bg-[rgba(255,255,240,0.55)]"
	></div>

	<!-- Rounded card container -->
	<div
		class="overflow-hidden rounded-xl border-[2px] border-black/10"
		style="box-shadow: var(--shadow-sheet);"
	>
		<!-- Colored header -->
		<div style={`background:${palette.fill};`}>
			<p
				class="px-[1em] pt-[0.55em] pb-[0.15em] text-center font-display text-[1.15em] font-bold tracking-[0.06em] text-paper-bright uppercase"
			>
				HELLO
			</p>
			<p
				class="px-[1em] pb-[0.5em] text-center font-display text-[0.62em] font-semibold tracking-[0.15em] text-[rgba(253,251,247,0.8)] uppercase"
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
