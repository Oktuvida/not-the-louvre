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

<svelte:head>
	<title>{status} | Not the Louvre</title>
</svelte:head>

<div class="relative flex h-screen w-full items-center justify-center overflow-hidden bg-[#f5f0e8]">
	<!-- Paint splotches background -->
	<div class="pointer-events-none absolute inset-0">
		{#each Array.from({ length: 8 }).map((__, i) => i) as index (`splotch-${index}`)}
			<div
				class="absolute animate-[splotchFloat_5s_ease-in-out_infinite] rounded-full opacity-10"
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
			class="font-display mb-4 text-[10rem] leading-none font-black text-[#2d2420]"
			style="text-shadow: 6px 6px 0px #e8b896, 12px 12px 0px rgba(45, 36, 32, 0.2);"
		>
			{status}
		</h1>

		<h2 class="font-display mb-6 text-4xl font-bold text-[#2d2420]">Oops! This Canvas is Blank</h2>

		<p
			class="mx-auto mb-8 max-w-md [font-family:'Baloo_2',_'Trebuchet_MS',_sans-serif] text-xl text-[#6b625a] italic"
		>
			{message}
		</p>

		<div class="flex flex-wrap justify-center gap-4">
			<GameLink
				href="/"
				variant="primary"
				className="rotate-1 border-4 px-8 py-4 shadow-xl [font-family:'Baloo_2',_'Trebuchet_MS',_sans-serif]"
			>
				<House class="mr-3 h-6 w-6" />
				<span class="text-lg">Go Home</span>
			</GameLink>

			<GameLink
				href="/draw"
				variant="secondary"
				className="-rotate-1 border-4 px-8 py-4 shadow-xl [font-family:'Baloo_2',_'Trebuchet_MS',_sans-serif]"
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
