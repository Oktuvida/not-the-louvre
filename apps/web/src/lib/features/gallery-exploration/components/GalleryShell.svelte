<script lang="ts">
	import { ArrowLeft, Paintbrush, RefreshCw } from 'lucide-svelte';
	import { browser } from '$app/environment';
	import type { GalleryRoomId } from '$lib/features/gallery-exploration/model/rooms';
	import AmbientParticleOverlay from '$lib/features/shared-ui/components/AmbientParticleOverlay.svelte';
	import GameButton from '$lib/features/shared-ui/components/GameButton.svelte';
	import GameLink from '$lib/features/shared-ui/components/GameLink.svelte';
	import GalleryRoomNav from '$lib/features/gallery-exploration/components/GalleryRoomNav.svelte';
	import { createMuseumWallPatternUrl } from '$lib/features/home-entry-scene/canvas/museum-canvas';
	import type { Snippet } from 'svelte';

	interface Props {
		roomId: GalleryRoomId;
		viewer: { id: string; role: 'admin' | 'moderator' | 'user' } | null;
		isRefreshingGallery?: boolean;
		onBack?: (event: MouseEvent) => void;
		onRefresh?: () => void;
		children: Snippet;
	}

	let {
		roomId,
		viewer,
		isRefreshingGallery = false,
		onBack,
		onRefresh,
		children
	}: Props = $props();

	let museumWallPatternUrl = $state<string | undefined>(undefined);

	$effect(() => {
		if (!browser || museumWallPatternUrl) return;
		museumWallPatternUrl = createMuseumWallPatternUrl();
	});
</script>

<div
	class="relative min-h-screen bg-cover bg-fixed bg-center bg-no-repeat"
	data-testid="gallery-room-shell"
	style="background-color: #252018;"
>
	<div
		class="absolute inset-0 z-0 bg-[#252018]"
		data-testid="gallery-wall-bricks"
		style={`background-image: url('${museumWallPatternUrl}'); background-size: 512px 512px; background-repeat: repeat;`}
	></div>
	<div
		class="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(circle_at_86%_12%,rgba(255,247,214,0.34)_0%,rgba(255,243,201,0.18)_18%,rgba(255,241,196,0.06)_36%,transparent_58%)]"
	></div>
	<div
		class="pointer-events-none absolute inset-0 z-[1] bg-[linear-gradient(180deg,transparent_0%,transparent_58%,rgba(46,28,11,0.14)_78%,rgba(20,12,6,0.28)_100%)]"
	></div>
	<div
		class="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(circle_at_12%_92%,rgba(18,10,4,0.34)_0%,rgba(18,10,4,0.22)_26%,rgba(18,10,4,0.08)_46%,transparent_66%)]"
	></div>
	<div
		class="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(circle_at_center,transparent_0%,transparent_42%,rgba(12,9,7,0.08)_66%,rgba(12,9,7,0.2)_100%)]"
	></div>

	<AmbientParticleOverlay className="z-[5] opacity-90" />

	<div
		class="pointer-events-none sticky top-0 z-40 px-3 pt-3 md:px-8 md:pt-6"
		data-testid="gallery-room-header"
	>
		<div class="pointer-events-auto absolute top-3 left-3 md:top-6 md:left-8">
			<div onclickcapture={onBack}>
				<GameLink href="/" variant="ghost" size="sm" className="w-fit -rotate-1 shadow-xl">
					<ArrowLeft class="mr-1 h-5 w-5" />
					<span class="font-semibold">Back</span>
				</GameLink>
			</div>
		</div>

		<div
			class="pointer-events-auto absolute top-3 right-3 z-20 flex flex-row items-start gap-2 md:top-6 md:right-8 md:max-w-none md:flex-col md:items-end md:gap-3"
		>
			{#if viewer}
				<GameLink
					href="/draw"
					variant="primary"
					size="sm"
					className="h-11 min-w-11 rotate-1 px-0 shadow-xl md:h-auto md:min-w-0 md:px-[var(--sticker-padding-x)]"
					contentClassName="px-0 md:px-[calc(var(--sticker-padding-x)-2px)]"
				>
					<Paintbrush class="h-5 w-5 md:mr-1" />
					<span class="sr-only">Create Art</span>
					<div aria-hidden="true" class="hidden font-semibold md:inline-flex">Create Art</div>
				</GameLink>
				<GameButton
					variant="secondary"
					size="sm"
					className="relative z-20 !h-11 !min-w-11 rotate-1 !px-0 shadow-xl md:!h-auto md:!min-w-0 md:!px-[var(--sticker-padding-x)]"
					disabled={isRefreshingGallery}
					onclick={onRefresh}
				>
					<RefreshCw class={`h-5 w-5 md:mr-1 ${isRefreshingGallery ? 'animate-spin' : ''}`} />
					<span class="sr-only">{isRefreshingGallery ? 'Refreshing' : 'Refresh'}</span>
					<div aria-hidden="true" class="hidden font-semibold md:inline-flex">
						{isRefreshingGallery ? 'Refreshing' : 'Refresh'}
					</div>
				</GameButton>
			{/if}
		</div>

		<div class="pointer-events-auto mx-auto max-w-full px-12 pt-15 md:w-fit md:px-0 md:pt-1">
			<GalleryRoomNav {roomId} {viewer} />
		</div>
	</div>

	<div
		class="relative z-10 mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 md:gap-8 md:px-8 md:py-8"
	>
		{@render children()}
	</div>
</div>
