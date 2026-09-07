<script lang="ts">
	import { House, Paintbrush } from 'lucide-svelte';
	import GameLink from '$lib/features/shared-ui/components/GameLink.svelte';
	import { page } from '$app/state';

	let props = $props<{ error?: App.Error; status?: number }>();

	const status = $derived(props.status ?? page.status ?? 500);
	const message = $derived(
		props.error?.message ??
			page.error?.message ??
			'Something broke behind the velvet rope. Please try again in a moment.'
	);
</script>

<div class="relative flex h-screen w-full items-center justify-center overflow-hidden bg-shell">
	<!-- Paint splotches background -->
	<div class="pointer-events-none absolute inset-0">
		{#each Array.from({ length: 8 }).map((__, i) => i) as index (`splotch-${index}`)}
			<div
				class="splotch absolute rounded-full opacity-10"
				style={`
					width: ${100 + index * 20}px;
					height: ${100 + index * 20}px;
					background: ${['#d4956c', '#8b9d91', '#e8b896', '#c84f4f'][index % 4]};
					left: ${10 + index * 12}%;
					top: ${20 + (index % 3) * 25}%;
					animation-delay: ${index * 0.3}s;
					animation-duration: ${5 + index * 0.5}s;
				`}
			></div>
		{/each}
	</div>

	<div class="z-10 px-8 text-center">
		<!-- Giant 404 -->
		<h1
			class="mb-4 font-display text-[10rem] leading-none font-black text-ink-warm"
			style="text-shadow: 6px 6px 0px #e8b896, 12px 12px 0px rgba(45, 36, 32, 0.2);"
		>
			{status}
		</h1>

		<h2 class="mb-6 font-display text-4xl font-bold text-ink-warm">Oops! This Canvas is Blank</h2>

		<p class="mx-auto mb-8 max-w-md font-body text-xl text-ink-faint italic">
			{message}
		</p>

		<div class="flex flex-wrap justify-center gap-4">
			<GameLink
				href="/"
				variant="primary"
				className="rotate-1 border-4 px-8 py-4 shadow-xl font-body"
			>
				<House class="mr-3 h-6 w-6" />
				<span class="text-lg">Go Home</span>
			</GameLink>

			<GameLink
				href="/draw"
				variant="secondary"
				className="-rotate-1 border-4 px-8 py-4 shadow-xl font-body"
			>
				<Paintbrush class="mr-3 h-6 w-6" />
				<span class="text-lg">Start Drawing</span>
			</GameLink>
		</div>
	</div>

	<!-- Paint drip gradient at bottom -->
	<div
		class="pointer-events-none absolute right-0 bottom-0 left-0 h-32"
		style="background: linear-gradient(to bottom, transparent, #d4956c); opacity: 0.2;"
	></div>
</div>

<style>
	/* Declared in the same scoped block as the keyframes: Svelte renames scoped
	 * keyframes and only rewrites `animation` references inside this stylesheet,
	 * so a Tailwind `animate-[splotchFloat_…]` utility (or an inline style) can
	 * never resolve them. The per-element inline animation-delay/duration above
	 * still wins over this shorthand and keeps the stagger. */
	.splotch {
		animation: splotchFloat 5s ease-in-out infinite;
	}

	@keyframes splotchFloat {
		0%,
		100% {
			transform: translateY(0) scale(1) rotate(0deg);
		}
		33% {
			transform: translateY(-30px) scale(1.15) rotate(15deg);
		}
		66% {
			transform: translateY(0) scale(1) rotate(-15deg);
		}
	}
</style>
