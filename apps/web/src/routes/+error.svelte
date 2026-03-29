<script lang="ts">
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
				<!-- Home SVG -->
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="24"
					height="24"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="mr-3 h-6 w-6"
					><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline
						points="9 22 9 12 15 12 15 22"
					/></svg
				>
				<span class="text-lg">Go Home</span>
			</GameLink>

			<GameLink
				href="/draw"
				variant="secondary"
				className="-rotate-1 border-4 px-8 py-4 shadow-xl [font-family:'Baloo_2',_'Trebuchet_MS',_sans-serif]"
			>
				<!-- Paintbrush SVG -->
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="24"
					height="24"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="mr-3 h-6 w-6"
					><path d="m14.622 17.897-10.68-2.913" /><path
						d="M18.376 2.622a1 1 0 1 1 3.002 3.002L17.36 9.643a.5.5 0 0 0 0 .707l.944.944a2.41 2.41 0 0 1 0 3.408l-.944.944a.5.5 0 0 1-.707 0L8.354 7.348a.5.5 0 0 1 0-.707l.944-.944a2.41 2.41 0 0 1 3.408 0l.944.944a.5.5 0 0 0 .707 0z"
					/><path
						d="M9 8c-1.804 2.71-3.97 3.46-6.583 3.948a.507.507 0 0 0-.302.819l7.32 8.883a1 1 0 0 0 1.185.204C12.735 20.405 16 16.792 16 15"
					/></svg
				>
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
