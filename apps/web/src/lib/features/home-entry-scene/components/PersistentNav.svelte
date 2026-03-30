<script lang="ts">
	import { resolve } from '$app/paths';
	import ArtworkFrame from '$lib/features/artwork-presentation/components/ArtworkFrame.svelte';
	import { resolveArtworkFrame } from '$lib/features/artwork-presentation/model/frame';
	import type { HomeAuthUser } from '$lib/features/home-entry-scene/auth-contract';
	import type { HomePreviewCard } from '$lib/features/home-entry-scene/state/home-entry.svelte';
	import GameButton from '$lib/features/shared-ui/components/GameButton.svelte';
	import GameLink from '$lib/features/shared-ui/components/GameLink.svelte';
	import PostItNote from '$lib/features/shared-ui/components/PostItNote.svelte';
	import VisitorBadge from '$lib/features/shared-ui/components/VisitorBadge.svelte';
	import WaxSealAvatar from '$lib/features/shared-ui/components/WaxSealAvatar.svelte';

	let {
		adultContentEnabled = false,
		isExiting = false,
		onGalleryNavigate,
		previewCards = [],
		user = null
	}: {
		adultContentEnabled?: boolean;
		isExiting?: boolean;
		onGalleryNavigate?: () => void;
		previewCards?: HomePreviewCard[];
		user?: HomeAuthUser | null;
	} = $props();

	let adultContentPreferenceOverride = $state<boolean | null>(null);
	let adultContentError = $state<string | null>(null);
	let isSavingAdultContentPreference = $state(false);

	const adultContentAllowed = $derived(adultContentPreferenceOverride ?? adultContentEnabled);
	const hasSensitivePreview = $derived(previewCards.some((card) => card.isNsfw));
	const galleryHref = $derived(user ? ('/gallery/your-studio' as const) : ('/gallery' as const));

	const updateAdultContentPreference = async (enabled: boolean) => {
		if (!user || isSavingAdultContentPreference) {
			adultContentError = 'Sign in to manage 18+ artwork visibility.';
			return;
		}

		isSavingAdultContentPreference = true;
		adultContentError = null;

		try {
			const response = await fetch('/api/viewer/content-preferences', {
				body: JSON.stringify({ adultContentEnabled: enabled }),
				headers: { 'content-type': 'application/json' },
				method: 'PATCH'
			});

			if (!response.ok) {
				throw new Error('18+ artwork preference could not be updated.');
			}

			adultContentPreferenceOverride = enabled;
		} catch (error) {
			adultContentError =
				error instanceof Error ? error.message : '18+ artwork preference could not be updated.';
		} finally {
			isSavingAdultContentPreference = false;
		}
	};

	const handleGalleryClick = () => {
		onGalleryNavigate?.();
	};
</script>

<div class="pointer-events-none absolute inset-0 z-[30]">
	{#if user}
		<div
			class="pointer-events-auto absolute top-8 left-8 max-w-[22rem] transition-all duration-700 ease-[cubic-bezier(0.4,0,1,1)]"
			class:-translate-x-[calc(100%+3rem)]={isExiting}
			class:opacity-0={isExiting}
		>
			<VisitorBadge
				avatarUrl={user.avatarUrl ?? user.image ?? null}
				nickname={user.nickname}
				userId={user.id}
			/>
			<p
				class="mt-3 text-sm font-semibold text-[#2d2420] drop-shadow-[0_1px_0_rgba(255,255,255,0.55)]"
			>
				Signed in as <span class="font-black">{user.nickname}</span>
			</p>
		</div>
	{/if}

	<div
		class="pointer-events-auto absolute top-8 right-6 transition-all duration-700 ease-[cubic-bezier(0.4,0,1,1)] md:right-8"
		class:translate-x-[calc(100%+3rem)]={isExiting}
		class:opacity-0={isExiting}
	>
		<div class="relative flex flex-col items-end gap-7 pb-[13.5rem]">
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
						<ArtworkFrame
							{frame}
							className="h-36 w-36 md:h-40 md:w-40"
							testId={`home-preview-frame-${card.rank}`}
						>
							<div class="relative h-full w-full">
								<img
									src={card.imageUrl}
									alt={card.title}
									class={`h-full w-full object-cover transition duration-200 ${card.isNsfw && !adultContentAllowed ? 'scale-[1.08] blur-xl saturate-0' : ''}`}
								/>
								{#if card.isNsfw && !adultContentAllowed}
									<div
										class="absolute inset-0 flex flex-col items-center justify-center border-2 border-dashed border-[#2d2420] bg-[rgba(45,36,32,0.68)] px-2 text-center text-[#fdfbf7]"
									>
										<span
											class="rounded-full border-2 border-[#fdfbf7] px-2 py-0.5 text-xs font-black"
											>18+</span
										>
										<span class="mt-2 max-w-[5rem] text-[0.7rem] font-semibold uppercase"
											>Sensitive preview</span
										>
									</div>
								{/if}
							</div>
						</ArtworkFrame>
						{#if card.artistAvatar}
							<div class="absolute -bottom-3 -left-3">
								<WaxSealAvatar alt={card.artist} seed={card.id} size="lg" src={card.artistAvatar} />
							</div>
						{/if}
					</div>
				</a>
			{/each}

			{#if hasSensitivePreview}
				<div class="absolute right-[-0.5rem] bottom-0 z-10 w-[17.5rem] max-w-[calc(100vw-3rem)]">
					<PostItNote
						attachment="tape"
						className="pointer-events-auto"
						color="linear-gradient(160deg, #fef49c 0%, #f1df77 100%)"
						label="18+ artworks"
						seedKey="home-sensitive-preview"
						text={adultContentAllowed
							? 'Sensitive previews are visible on this account.'
							: 'Sensitive previews stay blurred until you opt in.'}
					>
						{#if user}
							<button
								type="button"
								class="w-full rounded-[0.95rem] border-3 border-[#2d2420] bg-[#fff7d4] px-4 py-2 text-sm font-black text-[#2d2420] shadow-[2px_3px_0_rgba(45,36,32,0.18)] transition duration-200 hover:-translate-y-0.5 disabled:opacity-60"
								disabled={isSavingAdultContentPreference}
								onclick={() => updateAdultContentPreference(!adultContentAllowed)}
							>
								{adultContentAllowed ? 'Hide 18+ artworks' : 'Reveal 18+ artworks'}
							</button>
						{:else}
							<p class="text-xs font-semibold text-[#8f3720]">Sign in to reveal 18+ artworks.</p>
						{/if}
						{#if adultContentError}
							<p class="mt-2 text-xs font-semibold text-[#8f3720]">{adultContentError}</p>
						{/if}
					</PostItNote>
				</div>
			{/if}
		</div>
	</div>

	<div
		class="pointer-events-auto absolute bottom-20 left-6 flex flex-col gap-4 transition-all duration-700 ease-[cubic-bezier(0.4,0,1,1)] md:left-16"
		class:translate-y-[calc(100%+6rem)]={isExiting}
		class:opacity-0={isExiting}
	>
		{#if user}
			<GameButton
				type="button"
				variant="secondary"
				size="lg"
				className="group -rotate-1 hover:translate-x-[10px] hover:rotate-2"
				onclick={handleGalleryClick}
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
			</GameButton>
		{:else}
			<GameLink
				href={galleryHref}
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
		{/if}

		<!-- <GameLink
			href="/gallery/mystery"
			variant="accent"
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
			>
				<circle cx="12" cy="12" r="9" />
				<path d="M9.09 9a3 3 0 1 1 5.82 1c0 2-3 3-3 3" />
				<path d="M12 17h.01" />
			</svg>
			<span>MYSTERY</span>
		</GameLink> -->

		{#if user}
			<form method="POST" action="?/signOut" class="w-fit">
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
