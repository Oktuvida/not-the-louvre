<script lang="ts">
	import { onMount, type Snippet } from 'svelte';

	export type BookStageState = 'closed' | 'opening' | 'open';

	let {
		children,
		coverBack,
		onOpened,
		onOpenRequest,
		openingDurationMs = 950,
		stageState
	}: {
		children?: Snippet;
		coverBack?: Snippet;
		onOpened?: () => void;
		onOpenRequest?: () => void;
		openingDurationMs?: number;
		stageState: BookStageState;
	} = $props();

	let prefersReducedMotion = $state(false);

	let effectiveOpeningDurationMs = $derived(
		prefersReducedMotion ? Math.min(openingDurationMs, 80) : openingDurationMs
	);
	let stageStatus = $derived(
		stageState === 'closed'
			? 'Closed sketchbook. Activate to begin drawing.'
			: stageState === 'opening'
				? 'Sketchbook opening.'
				: 'Sketchbook open. Drawing surface ready.'
	);

	onMount(() => {
		const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
		const legacyMediaQuery = mediaQuery as MediaQueryList & {
			addListener?: (listener: (event: MediaQueryListEvent) => void) => void;
			removeListener?: (listener: (event: MediaQueryListEvent) => void) => void;
		};
		const updatePreference = () => {
			prefersReducedMotion = mediaQuery.matches;
		};

		updatePreference();

		if ('addEventListener' in mediaQuery) {
			mediaQuery.addEventListener('change', updatePreference);
			return () => {
				mediaQuery.removeEventListener('change', updatePreference);
			};
		}

		legacyMediaQuery.addListener?.(updatePreference);
		return () => {
			legacyMediaQuery.removeListener?.(updatePreference);
		};
	});

	$effect(() => {
		if (stageState !== 'opening') {
			return;
		}

		const timer = window.setTimeout(() => {
			onOpened?.();
		}, effectiveOpeningDurationMs);

		return () => {
			window.clearTimeout(timer);
		};
	});
</script>

<section
	class="book-shell"
	data-state={stageState}
	style={`--book-open-duration:${effectiveOpeningDurationMs}ms;`}
>
	<p class="sr-only" aria-live="polite">{stageStatus}</p>

	<div class="book-perspective">
		<div class="book-floor-shadow" aria-hidden="true"></div>
		<div class="book-block">
			<div class="book-spread">
				<div class="inside-cover">
					{@render coverBack?.()}
				</div>
				<div class="page canvas-page">
					<div class="canvas-window">
						{@render children?.()}
					</div>
				</div>
			</div>

			<div class="book-cover">
				<button
					type="button"
					class="cover-front"
					onclick={onOpenRequest}
					disabled={stageState !== 'closed'}
					aria-label="Open sketchbook"
				>
					<span class="cover-strap">Draw Route</span>
					<strong>The Sketchbook</strong>
					<span class="cover-invite">Tap the cover to begin</span>
				</button>
				<div class="cover-back-face" aria-hidden="true"></div>
			</div>
		</div>
	</div>
</section>

<style>
	.book-shell {
		width: 100%;
		height: 100%;
	}

	.book-perspective {
		position: relative;
		perspective: 2400px;
		height: 100%;
		display: flex;
		flex-direction: column;
		justify-content: center;
		padding: 0.75rem 0 1.5rem;
	}

	.book-floor-shadow {
		position: absolute;
		left: 8%;
		right: 8%;
		bottom: 0.4rem;
		height: 2rem;
		border-radius: 9999px;
		background:
			radial-gradient(circle at center, rgb(70 48 29 / 0.35), transparent 68%),
			linear-gradient(90deg, transparent, rgb(70 48 29 / 0.14), transparent);
		filter: blur(12px);
	}

	.book-block {
		position: relative;
		flex: 1;
		min-height: 0;
		padding: clamp(0.5rem, 1vw, 1rem);
	}

	.book-spread {
		position: relative;
		display: flex;
		gap: clamp(0.5rem, 1vw, 1rem);
		height: 100%;
		padding: clamp(0.8rem, 1.5vw, 1.4rem);
		border: 3px solid rgb(67 44 29 / 0.4);
		border-radius: 1.5rem;
		background:
			linear-gradient(180deg, rgb(255 248 237 / 0.95), rgb(237 223 202 / 0.95)),
			linear-gradient(
				90deg,
				rgb(178 145 112 / 0.18),
				transparent 16%,
				transparent 84%,
				rgb(178 145 112 / 0.18)
			);
		box-shadow:
			inset 0 0 0 2px rgb(255 255 255 / 0.45),
			0 1.5rem 3rem rgb(73 48 32 / 0.2);
		overflow: hidden;
	}

	.page {
		position: relative;
		border-radius: 1rem;
		padding: clamp(0.35rem, 0.6vw, 0.5rem);
		background:
			linear-gradient(180deg, rgb(255 252 245 / 0.98), rgb(244 234 218 / 0.98)),
			repeating-linear-gradient(
				180deg,
				transparent,
				transparent 2.2rem,
				rgb(148 118 84 / 0.07) 2.2rem,
				rgb(148 118 84 / 0.07) 2.28rem
			);
		box-shadow:
			inset 0 0 0 1px rgb(121 87 57 / 0.12),
			inset -12px 0 24px rgb(104 76 50 / 0.08);
	}

	.canvas-page {
		display: flex;
		flex: 1;
		min-width: 0;
		align-items: stretch;
		justify-content: center;
		background:
			linear-gradient(180deg, rgb(255 250 244 / 0.98), rgb(247 238 225 / 0.98)),
			repeating-linear-gradient(
				180deg,
				transparent,
				transparent 2.2rem,
				rgb(171 143 110 / 0.06) 2.2rem,
				rgb(171 143 110 / 0.06) 2.28rem
			);
	}

	.canvas-window {
		position: relative;
		z-index: 1;
		display: flex;
		width: 100%;
		align-items: center;
		justify-content: center;
	}

	/* --- Inside cover panel (always rendered, covered by the book cover when closed) --- */

	.inside-cover {
		display: flex;
		flex-direction: column;
		flex-shrink: 0;
		width: clamp(11rem, 14vw, 16rem);
		padding: clamp(0.8rem, 1.5vw, 1.4rem);
		border-radius: 1rem;
		background: linear-gradient(145deg, #5b3a26 0%, #4a2e1c 40%, #3a2315 100%);
		box-shadow:
			inset 0 0 0 1px rgb(255 240 219 / 0.08),
			inset 8px 0 20px rgb(32 20 14 / 0.15);
		color: #d4c4ae;
	}

	/* --- Book cover (3D flip) --- */

	.book-cover {
		position: absolute;
		inset: clamp(0.5rem, 1vw, 1rem);
		border-radius: 1.6rem;
		background:
			radial-gradient(circle at 20% 20%, rgb(255 223 184 / 0.14), transparent 22%),
			linear-gradient(135deg, #7c5136 0%, #5b3825 45%, #3c2519 100%);
		box-shadow:
			inset 0 0 0 2px rgb(255 240 219 / 0.14),
			inset -22px 0 30px rgb(32 20 14 / 0.22),
			0 1.6rem 3rem rgb(41 24 16 / 0.3);
		color: #fff7ee;
		text-align: left;
		transform-origin: left center;
		transform-style: preserve-3d;
		transition:
			transform var(--book-open-duration) cubic-bezier(0.23, 1, 0.32, 1),
			box-shadow var(--book-open-duration) ease;
		z-index: 5;
	}

	.cover-front {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		padding: clamp(1.2rem, 2.5vw, 2rem);
		border: 0;
		border-radius: inherit;
		background: transparent;
		color: inherit;
		text-align: inherit;
		backface-visibility: hidden;
		cursor: pointer;
	}

	.cover-front:disabled {
		cursor: default;
	}

	.cover-front:focus-visible {
		outline: 3px solid #f4c430;
		outline-offset: 5px;
	}

	.cover-back-face {
		position: absolute;
		inset: 0;
		border-radius: inherit;
		background: linear-gradient(145deg, #5b3a26 0%, #4a2e1c 40%, #3a2315 100%);
		backface-visibility: hidden;
		transform: rotateY(180deg);
	}

	.cover-strap {
		font-size: 0.76rem;
		font-weight: 700;
		letter-spacing: 0.3em;
		text-transform: uppercase;
		color: rgb(255 224 192 / 0.82);
	}

	.book-cover strong {
		max-width: 8ch;
		font-size: clamp(1.8rem, 4vw, 3.6rem);
		line-height: 0.95;
		font-family: 'Georgia', serif;
	}

	.cover-invite {
		max-width: 16ch;
		font-size: clamp(0.75rem, 1.2vw, 0.95rem);
		line-height: 1.5;
		color: rgb(255 235 214 / 0.84);
	}

	.book-shell[data-state='opening'] .book-cover,
	.book-shell[data-state='open'] .book-cover {
		transform: rotateY(-180deg);
		box-shadow:
			inset 0 0 0 2px rgb(255 240 219 / 0.1),
			0 1rem 2rem rgb(41 24 16 / 0.16);
	}

	.book-shell[data-state='open'] .book-cover {
		pointer-events: none;
	}

	/* --- Responsive --- */

	@media (max-width: 700px) {
		.book-block {
			padding: 0.4rem;
		}

		.book-spread {
			padding: 0.5rem;
			border-radius: 1rem;
			flex-direction: column;
		}

		.inside-cover {
			width: 100%;
			flex-shrink: 1;
			max-height: 5rem;
			overflow: hidden;
		}

		.page {
			padding: 0.35rem;
			border-radius: 0.75rem;
		}

		.cover-invite {
			font-size: 0.78rem;
		}

		.book-cover strong {
			font-size: clamp(1.8rem, 9vw, 3rem);
		}

		.book-cover {
			border-radius: 1.1rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.book-cover {
			transition-duration: 80ms;
		}
	}
</style>
