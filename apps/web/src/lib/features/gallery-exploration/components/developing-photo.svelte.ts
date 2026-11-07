import { on } from 'svelte/events';

/*
 * A photo that did not come, handled once for every surface that shows one:
 * the polaroids (<NsfwImage>) and the Mystery Room's reel frames.
 *
 * The browser would draw its broken-image icon and the bare title. The
 * surface leaves the photo undrawn instead, says so in pencil, and the photo
 * is asked for again by itself after a pause, then a longer one, and whenever
 * the connection comes back.
 */
const RETRY_AFTER_MS = [2_000, 6_000];

export type DevelopingPhoto = {
	/**
	 * The address to ask for. The browser keeps a failed image under its
	 * address for as long as the page lives, so a new try asks under a new one:
	 * the media route reads only the format from the query.
	 */
	readonly requestedSrc: string;
	/** Changes with every new try: key the `<img>` on it, so each try is a fresh element. */
	readonly attempt: number;
	/** The photo shown now did not come, and has not come since. */
	readonly undeveloped: boolean;
	/**
	 * The photo the failures count against, copied out of the source by an
	 * effect: an image can fail while its card or postcard is already on its
	 * way out, when the prop's own source is gone, so handlers read this
	 * instead of the prop.
	 */
	readonly trackedSrc: string;
	/** The photo came. */
	developed: () => void;
	/**
	 * The photo did not come. Counted once per image element: the effect that
	 * catches a server-rendered failure runs again whenever the card
	 * re-renders, and counting every re-render used up the retries in a blink.
	 */
	failed: (image: Element) => void;
};

/** Call while a component initialises: it registers that component's effects. */
export const createDevelopingPhoto = (getSrc: () => string): DevelopingPhoto => {
	let undevelopedSrc = $state<string | null>(null);
	/** How many times the photo has been asked for again. */
	let attempt = $state(0);
	let trackedSrc = '';
	let failures = 0;
	let failedImage: Element | null = null;
	let retryTimer: ReturnType<typeof setTimeout> | undefined;

	const undeveloped = $derived(undevelopedSrc === getSrc());
	const requestedSrc = $derived.by(() => {
		const src = getSrc();
		return attempt === 0 || /^(data|blob):/.test(src)
			? src
			: `${src}${src.includes('?') ? '&' : '?'}retry=${attempt}`;
	});

	const stopRetrying = () => {
		clearTimeout(retryTimer);
		retryTimer = undefined;
	};

	const tryAgain = () => {
		stopRetrying();
		attempt += 1;
	};

	/*
	 * A new photo starts with nothing counted against it. The reel and the
	 * grids reuse their frames and cards for other artworks, and the next one
	 * must neither spend the last one's retries nor wait out its pause, nor
	 * have its own failure dismissed as the last one's.
	 */
	$effect.pre(() => {
		const src = getSrc();
		if (src === trackedSrc) return;
		trackedSrc = src;
		failures = 0;
		failedImage = null;
		stopRetrying();
	});

	$effect(() =>
		on(window, 'online', () => {
			if (undeveloped) tryAgain();
		})
	);

	$effect(() => stopRetrying);

	return {
		get attempt() {
			return attempt;
		},
		get requestedSrc() {
			return requestedSrc;
		},
		get trackedSrc() {
			return trackedSrc;
		},
		get undeveloped() {
			return undeveloped;
		},
		developed: () => {
			undevelopedSrc = null;
		},
		failed: (image) => {
			if (image === failedImage) return;
			failedImage = image;
			undevelopedSrc = trackedSrc;
			stopRetrying();
			const wait = RETRY_AFTER_MS[failures];
			failures += 1;
			if (wait !== undefined) retryTimer = setTimeout(tryAgain, wait);
		}
	};
};
