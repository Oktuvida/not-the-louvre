<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { HomeAuthUser } from '$lib/features/home-entry-scene/auth-contract';
	import type { HomePreviewCard } from '$lib/features/home-entry-scene/state/home-entry.svelte';
	import ArtworkFrame from '$lib/features/artwork-presentation/components/ArtworkFrame.svelte';
	import { resolveArtworkFrame } from '$lib/features/artwork-presentation/model/frame';
	import GameButton from '$lib/features/shared-ui/components/GameButton.svelte';
	import GameLink from '$lib/features/shared-ui/components/GameLink.svelte';
	import VisitorBadge from '$lib/features/shared-ui/components/VisitorBadge.svelte';

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
		<div class="pointer-events-auto absolute top-8 left-8 max-w-[22rem]">
			<VisitorBadge
				avatarUrl={user.avatarUrl ?? user.image ?? null}
				nickname={user.nickname}
				userId={user.id}
			/>
		</div>
	{/if}

	<div class="pointer-events-auto absolute top-8 right-8 space-y-4">
		{#each previewCards as card (card.id)}
			{@const frame = resolveArtworkFrame({ artworkId: card.id, podiumPosition: card.rank })}
			<a
				href={resolve('/gallery')}
				class="group relative block cursor-pointer"
				style={`transform: rotate(${card.rotation}deg);`}
			>
				<div
					class="relative transition-all duration-200 group-hover:-translate-x-[10px] group-hover:scale-110 group-hover:rotate-0"
				>
					<ArtworkFrame {frame} className="h-32 w-32" testId={`home-preview-frame-${card.rank}`}>
						<img src={card.imageUrl} alt={card.title} class="h-full w-full object-cover" />
					</ArtworkFrame>
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
			size="lg"
			className="group -rotate-1 hover:translate-x-[10px] hover:rotate-2"
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

		{#if user}
			<form method="POST" action="?/signOut" use:enhance class="w-fit">
				<GameButton
					type="submit"
					variant="danger"
					size="lg"
					className="group rotate-1 hover:translate-x-[10px] hover:rotate-[-2deg]"
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
						><path d="m9 21 6-6-6-6" /><path d="M15 15H3" /><path
							d="M18 3h-7a2 2 0 0 0-2 2v4"
						/><path d="M18 3a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3h-7" /></svg
					>
					<span>LOGOUT</span>
				</GameButton>
			</form>
		{/if}
	</div>
</div>
