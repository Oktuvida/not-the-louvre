import { browser } from '$app/environment';
import { preloadCode, preloadData } from '$app/navigation';
import { resolve } from '$app/paths';

/*
 * The home page holds the visitor for ~2.4s (gallery) and ~1.85s (studio) of
 * camera choreography before `goto` is even called, and the signed-in triggers
 * are `<button>`s, so `data-sveltekit-preload-data="hover"` never applies to
 * them. Warming the destination on pointer/focus intent turns that hold into
 * overlap: the route module and its data are already resolved by the time the
 * fade completes.
 */
export const homeGalleryTarget = `${resolve('/gallery/[room]', { room: 'your-studio' })}?from=home`;
export const homeStudioTarget = resolve('/draw');

const warmedTargets = new Set<string>();

/**
 * `preloadData` is keyed on the full URL including the query string, so the
 * target must be the exact URL the handler navigates to — the gallery reads
 * `?from=home` to decide its entry animation.
 */
export const warmNavigationTarget = (target: string) => {
	if (!browser || warmedTargets.has(target)) {
		return;
	}

	warmedTargets.add(target);

	const pathname = target.split('?')[0] ?? target;

	void preloadCode(pathname).catch(() => {
		// A cold-start warm-up must never surface as an error to the visitor.
	});
	void preloadData(target).catch(() => {
		// Same: the navigation itself will retry and report properly.
	});
};

/**
 * Same warm-up, pushed off the critical path. Used from the navigation handlers
 * themselves (the touch/keyboard fallback) so module evaluation does not land
 * inside the first frames of the camera tween.
 */
export const warmNavigationTargetWhenIdle = (target: string) => {
	if (!browser || warmedTargets.has(target)) {
		return;
	}

	if (typeof window.requestIdleCallback === 'function') {
		window.requestIdleCallback(() => warmNavigationTarget(target), { timeout: 200 });
		return;
	}

	window.setTimeout(() => warmNavigationTarget(target), 0);
};

/**
 * Svelte action: warm `target` the moment the visitor shows intent — hovering
 * the control or tabbing into it. Applied to the wrapper rather than the control
 * because the sticker button is a shared component that forwards only `onclick`.
 */
export const warmOnIntent = (node: HTMLElement, target: string) => {
	let currentTarget = target;
	const warm = () => warmNavigationTarget(currentTarget);

	node.addEventListener('pointerenter', warm);
	node.addEventListener('focusin', warm);

	return {
		update(nextTarget: string) {
			currentTarget = nextTarget;
		},
		destroy() {
			node.removeEventListener('pointerenter', warm);
			node.removeEventListener('focusin', warm);
		}
	};
};
