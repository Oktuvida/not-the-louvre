<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { HomeAuthUser } from '$lib/features/home-entry-scene/auth-contract';
	import type { HomePreviewCard } from '$lib/features/home-entry-scene/state/home-entry.svelte';
	import GameButton from '$lib/features/shared-ui/components/GameButton.svelte';
	import GameLink from '$lib/features/shared-ui/components/GameLink.svelte';

	let {
		previewCards = [],
		user = null
	}: {
		previewCards?: HomePreviewCard[];
		user?: HomeAuthUser | null;
	} = $props();
</script>

<div class="pointer-events-none absolute inset-0 z-[30]">
	{#if user}
		<div
			class="pointer-events-auto absolute top-8 left-8 flex items-center gap-3 rounded-[1.2rem] border-4 border-[#2d2420] bg-[rgba(253,251,247,0.92)] px-4 py-3 shadow-xl"
		>
			<div>
				<p class="text-[0.65rem] font-semibold tracking-[0.18em] text-[#8a6c52] uppercase">
					Signed in as
				</p>
				<p class="font-display text-lg tracking-[0.08em] text-[#2d2420] uppercase">
					{user.nickname}
				</p>
			</div>
			<form method="POST" action="?/signOut" use:enhance>
				<GameButton type="submit" variant="danger" className="px-4 py-2 text-xs font-black">
					<span>Logout</span>
				</GameButton>
			</form>
		</div>
	{/if}

	<div class="pointer-events-auto absolute top-8 right-8 space-y-4">
		{#each previewCards as card (card.id)}
			<a
				href={resolve('/gallery')}
				class="group relative block cursor-pointer"
				style={`transform: rotate(${card.rotation}deg);`}
			>
				<div
					class="relative border-4 border-[#2d2420] bg-[#fdfbf7] p-2 shadow-xl transition-all duration-200 group-hover:-translate-x-[10px] group-hover:scale-110 group-hover:rotate-0"
				>
					<img src={card.imageUrl} alt={card.title} class="h-32 w-32 object-cover" />
					<div
						class="absolute -top-3 -right-3 flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#2d2420] bg-[#f4c430] font-bold text-[#2d2420] shadow-lg"
					>
						#{card.rank}
					</div>
					{#if card.artistAvatar}
						<div
							class="absolute -bottom-2 -left-2 h-10 w-10 overflow-hidden rounded-full border-3 border-[#2d2420] bg-white shadow-lg"
						>
							<img src={card.artistAvatar} alt={card.artist} class="h-full w-full" />
						</div>
					{/if}
				</div>
			</a>
		{/each}
	</div>

	<div class="pointer-events-auto absolute bottom-20 left-6 flex flex-col gap-4 md:left-16">
		<GameLink
			href="/gallery"
			variant="secondary"
			className="group gap-3 px-6 py-4 text-lg font-semibold -rotate-1 hover:translate-x-[10px] hover:rotate-2"
		>
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
				class="transition-transform duration-300 group-hover:animate-[wiggle_0.5s_ease-in-out]"
				><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path
					d="M4 22h16"
				/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path
					d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"
				/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" /></svg
			>
			<span>GALLERY</span>
		</GameLink>

		<GameLink
			href="/gallery/mystery"
			variant="accent"
			className="group gap-3 px-6 py-4 text-lg font-semibold rotate-1 hover:translate-x-[10px] hover:rotate-[-2deg]"
		>
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
				class="transition-transform duration-300 group-hover:animate-[wiggle_0.5s_ease-in-out]"
				><path d="m18 14 4 4-4 4" /><path d="m18 2 4 4-4 4" /><path
					d="M2 18h1.973a4 4 0 0 0 3.3-1.7l5.454-8.6a4 4 0 0 1 3.3-1.7H22"
				/><path d="M2 6h1.972a4 4 0 0 1 3.6 2.2" /><path
					d="M22 18h-6.041a4 4 0 0 1-3.3-1.8l-.359-.45"
				/></svg
			>
			<span>MYSTERY</span>
		</GameLink>
	</div>
</div>
