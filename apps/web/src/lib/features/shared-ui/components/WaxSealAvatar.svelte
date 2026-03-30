<script lang="ts">
	import { hashString } from '$lib/features/artwork-presentation/model/frame';

	type WaxSealSize = 'xl' | 'lg' | 'md' | 'sm';

	// Blobs más pronunciados — mayor varianza en las curvas
	const BLOB_PRESETS = [
		'40% 60% 55% 45% / 58% 42% 62% 38%',
		'62% 38% 44% 56% / 42% 58% 38% 62%',
		'35% 65% 58% 42% / 55% 45% 65% 35%',
		'55% 45% 40% 60% / 38% 62% 44% 56%',
		'60% 40% 52% 48% / 46% 54% 36% 64%',
		'38% 62% 60% 40% / 58% 42% 46% 54%',
		'52% 48% 38% 62% / 64% 36% 52% 48%',
		'44% 56% 62% 38% / 40% 60% 58% 42%'
	] as const;

	let {
		alt,
		className = '',
		seed = '',
		size = 'md' as WaxSealSize,
		src
	}: {
		alt: string;
		className?: string;
		seed?: string;
		size?: WaxSealSize;
		src: string;
	} = $props();

	const hash = $derived(hashString(seed || alt));
	const blobShape = $derived(BLOB_PRESETS[hash % BLOB_PRESETS.length]!);
</script>

<div
	class={`wax-seal wax-seal--${size} ${className}`}
	data-seal-seed={seed || undefined}
	data-seal-size={size}
	data-testid="wax-seal-avatar"
	style={`--seal-blob:${blobShape};--seal-rotate:0deg;`}
>
	<div class="wax-seal__body">
		<div class="wax-seal__well">
			<div class="wax-seal__avatar">
				<img {src} {alt} class="wax-seal__img" />
			</div>
		</div>
	</div>
</div>

<style>
	/* ── Wrapper ── */
	.wax-seal {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		/* La sombra se escala por tamaño vía custom property */
		filter: var(--seal-shadow);
	}

	/* ── Wax body ── */
	.wax-seal__body {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		transform: rotate(var(--seal-rotate, 0deg));
		border-radius: var(--seal-blob, 47% 53% 46% 54% / 50% 45% 55% 50%);

		background:
			radial-gradient(ellipse 35% 28% at 26% 22%, rgba(255, 190, 190, 0.5), transparent),
			radial-gradient(ellipse 20% 16% at 32% 18%, rgba(255, 160, 160, 0.22), transparent),
			radial-gradient(ellipse 55% 55% at 78% 80%, rgba(30, 0, 0, 0.55), transparent),
			linear-gradient(150deg, #b02238 0%, #8b1a2a 25%, #6b0f1a 60%, #4a0a12 100%);

		box-shadow:
			inset 0 var(--seal-inset-top) var(--seal-inset-blur) rgba(255, 175, 175, var(--seal-inset-hi)),
			inset 0 calc(var(--seal-inset-top) * -1) calc(var(--seal-inset-blur) * 1.5)
				rgba(20, 0, 0, var(--seal-inset-sh));
	}

	/* ── Inner depression ── */
	.wax-seal__well {
		position: relative;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;

		background:
			radial-gradient(circle at 38% 33%, rgba(255, 140, 140, 0.08), transparent 50%),
			linear-gradient(160deg, #7a1525 0%, #5a0f18 100%);

		box-shadow:
			inset 0 var(--seal-well-depth) calc(var(--seal-well-depth) * 2.5) rgba(20, 0, 0, 0.5),
			inset 0 calc(var(--seal-well-depth) * -0.5) var(--seal-well-depth) rgba(255, 160, 160, 0.1);
	}

	/* Groove ring — solo visible en lg/xl */
	.wax-seal__well::before {
		content: '';
		position: absolute;
		inset: -2px;
		border-radius: 50%;
		border: 1px solid rgba(255, 200, 200, var(--seal-groove-opacity, 0));
		pointer-events: none;
	}

	/* ── Avatar ── */
	.wax-seal__avatar {
		border-radius: 50%;
		overflow: hidden;
		border: 1px solid rgba(255, 200, 200, 0.1);
		position: relative;
		z-index: 1;
	}

	.wax-seal__img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	/* ── XL ── */
	.wax-seal--xl {
		--seal-shadow: drop-shadow(0 4px 8px rgba(70, 8, 8, 0.5))
			drop-shadow(0 1px 2px rgba(0, 0, 0, 0.18));
		--seal-inset-top: 2px;
		--seal-inset-blur: 4px;
		--seal-inset-hi: 0.22;
		--seal-inset-sh: 0.4;
		--seal-well-depth: 3px;
		--seal-groove-opacity: 0.12;
	}
	.wax-seal--xl .wax-seal__body {
		width: 88px;
		height: 88px;
	}
	.wax-seal--xl .wax-seal__well {
		width: 62px;
		height: 62px;
	}
	.wax-seal--xl .wax-seal__avatar {
		width: 50px;
		height: 50px;
	}

	/* ── LG ── */
	.wax-seal--lg {
		--seal-shadow: drop-shadow(0 3px 5px rgba(70, 8, 8, 0.44))
			drop-shadow(0 1px 1px rgba(0, 0, 0, 0.14));
		--seal-inset-top: 1px;
		--seal-inset-blur: 3px;
		--seal-inset-hi: 0.18;
		--seal-inset-sh: 0.35;
		--seal-well-depth: 2px;
		--seal-groove-opacity: 0.09;
	}
	.wax-seal--lg .wax-seal__body {
		width: 68px;
		height: 68px;
	}
	.wax-seal--lg .wax-seal__well {
		width: 48px;
		height: 48px;
	}
	.wax-seal--lg .wax-seal__avatar {
		width: 40px;
		height: 40px;
	}

	/* ── MD ── */
	.wax-seal--md {
		--seal-shadow: drop-shadow(0 2px 4px rgba(70, 8, 8, 0.36));
		--seal-inset-top: 1px;
		--seal-inset-blur: 2px;
		--seal-inset-hi: 0.14;
		--seal-inset-sh: 0.3;
		--seal-well-depth: 1.5px;
		--seal-groove-opacity: 0;
	}
	.wax-seal--md .wax-seal__body {
		width: 50px;
		height: 50px;
	}
	.wax-seal--md .wax-seal__well {
		width: 34px;
		height: 34px;
	}
	.wax-seal--md .wax-seal__avatar {
		width: 28px;
		height: 28px;
	}

	/* ── SM ── */
	.wax-seal--sm {
		--seal-shadow: drop-shadow(0 1px 3px rgba(70, 8, 8, 0.32));
		--seal-inset-top: 1px;
		--seal-inset-blur: 2px;
		--seal-inset-hi: 0.1;
		--seal-inset-sh: 0.26;
		--seal-well-depth: 1px;
		--seal-groove-opacity: 0;
	}
	.wax-seal--sm .wax-seal__body {
		width: 38px;
		height: 38px;
	}
	.wax-seal--sm .wax-seal__well {
		width: 26px;
		height: 26px;
	}
	.wax-seal--sm .wax-seal__avatar {
		width: 20px;
		height: 20px;
	}
</style>
