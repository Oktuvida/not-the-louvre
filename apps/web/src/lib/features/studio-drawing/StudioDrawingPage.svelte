<script lang="ts">
	import { deserialize } from '$app/forms';
	import { resolve } from '$app/paths';
	import {
		checkTextContent as defaultCheckTextContent,
		type TextContentChecker
	} from '$lib/client/content-filter';
	import type {
		DrawForkParent,
		DrawPageUser,
		DrawPublishActionData,
		DrawPublishedArtwork
	} from '$lib/features/studio-drawing/publish-contract';
	import { exportArtworkFile } from '$lib/features/studio-drawing/canvas-export';
	import DrawingCanvas from '$lib/features/studio-drawing/components/DrawingCanvas.svelte';
	import DrawingToolTray from '$lib/features/studio-drawing/tools/DrawingToolTray.svelte';

	let {
		checkTextContent = defaultCheckTextContent,
		createArtworkFile = exportArtworkFile,
		forkParent = null,
		publishDrawing = async (
			file: File,
			options: { isNsfw: boolean; parentArtworkId?: string | null; title: string }
		): Promise<DrawPublishActionData> => {
			const formData = new FormData();
			formData.set('isNsfw', String(options.isNsfw));
			formData.set('media', file);
			formData.set('title', options.title);
			if (options.parentArtworkId) {
				formData.set('parentArtworkId', options.parentArtworkId);
			}

			const response = await fetch('?/publish', {
				body: formData,
				headers: {
					'x-sveltekit-action': 'true'
				},
				method: 'POST'
			});
			const result = deserialize(await response.text());

			if ((result.type === 'success' || result.type === 'failure') && result.data) {
				return result.data as DrawPublishActionData;
			}

			return { message: 'Artwork publish failed' };
		},
		user
	}: {
		checkTextContent?: TextContentChecker;
		createArtworkFile?: (canvas: HTMLCanvasElement) => Promise<File | null>;
		forkParent?: DrawForkParent | null;
		publishDrawing?: (
			file: File,
			options: { isNsfw: boolean; parentArtworkId?: string | null; title: string }
		) => Promise<DrawPublishActionData>;
		user?: DrawPageUser;
	} = $props();

	let canvasRef = $state<HTMLCanvasElement | null>(null);
	let clearVersion = $state(0);
	let isPublishing = $state(false);
	let publishedArtwork = $state<DrawPublishedArtwork | null>(null);
	let statusMessage = $state('');
	let statusTone = $state<'error' | 'success' | 'idle'>('idle');
	let artworkTitle = $state('');
	let isArtworkNsfw = $state(false);
	let titleError = $state('');

	const clearCanvas = () => {
		clearVersion += 1;
		publishedArtwork = null;
		statusMessage = '';
		statusTone = 'idle';
	};

	const publishArtwork = async () => {
		if (!canvasRef || isPublishing) return;

		artworkTitle = artworkTitle.trim();
		if (!artworkTitle) {
			titleError = 'Title is required before publishing';
			statusMessage = '';
			statusTone = 'idle';
			return;
		}

		publishedArtwork = null;
		statusMessage = '';
		statusTone = 'idle';
		titleError = '';
		isPublishing = true;

		try {
			const titleModeration = await checkTextContent(artworkTitle, 'artwork_title');
			if (titleModeration.status !== 'allowed') {
				titleError = titleModeration.message;
				statusMessage = '';
				statusTone = 'idle';
				return;
			}

			const file = await createArtworkFile(canvasRef);
			if (!file) {
				statusMessage = 'This browser could not export your drawing. Please try again.';
				statusTone = 'error';
				return;
			}

			const result = await publishDrawing(file, {
				isNsfw: isArtworkNsfw,
				parentArtworkId: forkParent?.id ?? null,
				title: artworkTitle
			});
			if ('success' in result && result.success) {
				publishedArtwork = result.artwork;
				statusMessage = `Artwork published as ${result.artwork.title}`;
				statusTone = 'success';
				return;
			}

			statusMessage = result.message;
			statusTone = 'error';
		} catch (error) {
			statusMessage = error instanceof Error ? error.message : 'Artwork publish failed';
			statusTone = 'error';
		} finally {
			isPublishing = false;
		}
	};
</script>

<div class="relative h-screen w-full overflow-hidden bg-[#f5f0e8]">
	<div class="absolute inset-0">
		<div
			class="absolute inset-0 bg-gradient-to-t from-[#f5f0e8] via-transparent to-[#f5f0e8]/50"
		></div>
	</div>

	<a
		href={resolve('/')}
		class="absolute top-8 left-8 z-30 flex -rotate-1 items-center gap-2 rounded-lg border-3 border-[#2d2420] bg-[#8b9d91] px-6 py-3 font-semibold text-[#fdfbf7] shadow-lg transition-transform hover:scale-105"
		style="font-family: 'Baloo 2', sans-serif;"
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></svg
		>
		<span>Exit Studio</span>
	</a>

	{#if user}
		<div
			class="absolute top-8 right-8 z-30 rounded-lg border-3 border-[#2d2420] bg-[#fdfbf7] px-4 py-3 text-sm text-[#2d2420] shadow-lg"
		>
			Signed in as <span class="font-bold">{user.nickname}</span>
		</div>
	{/if}

	<div
		class="absolute top-28 left-8 z-30 w-full max-w-sm rounded-2xl border-4 border-[#2d2420] bg-[#fdfbf7] p-5 shadow-2xl"
	>
		<p class="text-xs font-semibold tracking-[0.18em] text-[#8b9d91] uppercase">
			{forkParent ? 'Fork in progress' : 'Artwork details'}
		</p>
		{#if forkParent}
			<p class="mt-2 text-sm text-[#6b625a]">
				Forking from <span class="font-semibold text-[#2d2420]">{forkParent.title}</span>
			</p>
		{/if}
		<label class="mt-4 block space-y-2">
			<span class="text-xs font-semibold tracking-[0.18em] text-[#86654b] uppercase">Title</span>
			<input
				bind:value={artworkTitle}
				type="text"
				maxlength="80"
				placeholder="Give your piece a title"
				class="w-full rounded-[1rem] border-2 border-[#c8af95] bg-[#f5f0e1] px-4 py-3 text-base transition outline-none focus:border-[#4ecdc4]"
			/>
		</label>
		<label
			class="mt-4 flex items-center gap-3 rounded-[1rem] border-2 border-[#c8af95] bg-[#f5f0e1] px-4 py-3 text-sm text-[#2d2420]"
		>
			<input bind:checked={isArtworkNsfw} type="checkbox" />
			<span>Mark this artwork as NSFW</span>
		</label>
		{#if titleError}
			<p class="mt-2 text-sm text-[#8f3720]">{titleError}</p>
		{/if}
	</div>

	<div class="absolute inset-0 z-10 flex items-center justify-center">
		<DrawingCanvas bind:canvasRef {clearVersion} {statusMessage} {statusTone} />
	</div>

	<div class="absolute top-1/2 right-8 z-20 -translate-y-1/2">
		<DrawingToolTray {isPublishing} onPublish={publishArtwork} onClear={clearCanvas} />
	</div>

	{#if publishedArtwork}
		<div
			class="absolute top-28 left-[calc(2rem+26rem)] z-30 max-w-sm rounded-2xl border-4 border-[#2d2420] bg-[#fdfbf7] p-5 shadow-2xl"
		>
			<p class="text-xs font-semibold tracking-[0.18em] text-[#8b9d91] uppercase">
				Artwork published
			</p>
			<h2 class="mt-2 text-2xl font-black text-[#2d2420]">{publishedArtwork.title}</h2>
			<p class="mt-2 text-sm text-[#6b625a]">Artwork id: {publishedArtwork.id}</p>
			<div class="mt-4 flex gap-3">
				<button
					type="button"
					class="rounded-lg border-2 border-[#2d2420] bg-[#d4956c] px-4 py-2 font-semibold text-[#fdfbf7]"
					onclick={clearCanvas}
				>
					Draw again
				</button>
				<a
					href={resolve('/gallery')}
					class="rounded-lg border-2 border-[#2d2420] bg-[#8b9d91] px-4 py-2 font-semibold text-[#fdfbf7]"
				>
					Open gallery
				</a>
			</div>
		</div>
	{/if}

	<div
		class="absolute bottom-8 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 text-sm text-[#6b625a] italic"
		style="font-family: 'Baloo 2', sans-serif;"
	>
		<div class="h-3 w-3 animate-bounce rounded-full bg-[#d4956c]"></div>
		Your character is painting...
	</div>
</div>
