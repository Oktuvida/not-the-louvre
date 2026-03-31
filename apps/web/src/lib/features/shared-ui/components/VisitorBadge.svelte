<script lang="ts">
	import { hashString } from '$lib/features/artwork-presentation/model/frame';

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
	class={`visitor-badge relative w-[270px] overflow-visible text-left ${onclick ? 'cursor-pointer transition-transform duration-200 hover:scale-105' : ''} ${className}`}
	style={`transform: rotate(${rotation}deg);`}
	{onclick}
	aria-label={onclick ? `Edit avatar for ${nickname}` : undefined}
>
	<!-- Tape on top (sits outside the rounded card) -->
	<div
		class="badge-tape pointer-events-none absolute top-[-8px] left-1/2 z-[3] h-[18px] w-[54px] -translate-x-1/2 -rotate-2 border border-[rgba(200,190,170,0.3)] bg-[rgba(255,255,240,0.55)]"
	></div>

	<!-- Rounded card container -->
	<div
		class="overflow-hidden rounded-xl border-[2px] border-black/10"
		style="box-shadow: 3px 4px 12px rgba(0,0,0,0.22), 0 1px 3px rgba(0,0,0,0.1);"
	>
		<!-- Colored header -->
		<div style={`background:${palette.fill};`}>
			<p
				class="px-4 pt-[0.55rem] pb-[0.15rem] text-center font-['Fredoka'] text-[1.15rem] font-bold tracking-[0.06em] text-[#fdfbf7] uppercase"
			>
				HELLO
			</p>
			<p
				class="px-4 pb-[0.5rem] text-center font-['Fredoka'] text-[0.62rem] font-semibold tracking-[0.15em] text-[rgba(253,251,247,0.8)] uppercase"
			>
				MY NAME IS
			</p>
		</div>

		<!-- White body -->
		<div class="flex items-center gap-3 bg-[#fdfbf7] px-[1.2rem] py-[0.9rem]">
			<div
				class="flex h-[52px] w-[52px] min-w-[52px] shrink-0 items-center justify-center overflow-hidden rounded-full border-[3px] border-[#2d2420] bg-[#e8ddd0]"
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
					<!-- SVG person icon fallback matching artifact -->
					<svg
						viewBox="0 0 24 24"
						class="h-7 w-7"
						fill="none"
						stroke="#8a6c52"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<circle cx="12" cy="8" r="4" />
						<path d="M20 21a8 8 0 1 0-16 0" />
					</svg>
				{/if}
			</div>

			<div class="min-w-0 flex-1">
				<p
					class="truncate text-[1.7rem] leading-[1.1] font-bold text-[#2d2420]"
					style="font-family: 'Caveat', cursive;"
				>
					{nickname}
				</p>
			</div>
		</div>

		<!-- Colored footer strip -->
		<div class="h-[0.3rem]" style={`background:${palette.footer};`}></div>
	</div>
</button>
