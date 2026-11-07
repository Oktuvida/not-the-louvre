import { vi } from 'vitest';

/*
 * A stand-in for IntersectionObserver in component specs. The real one, inside
 * the browser runner's iframe, answers by layout and timing, so a spec that
 * scrolled an element into view passed or failed with the CI runner's load.
 * Specs install this and say what became visible instead:
 *
 *   beforeEach(() => installFakeIntersectionObserver());
 *   revealElement(document.querySelector('[data-testid="scroll-sentinel"]'));
 *
 * A reveal delivers one "now intersecting" entry to the observers watching the
 * element, or, when none is watching yet, to the next one that starts.
 */

const liveObservers = new Set<FakeIntersectionObserver>();
const pendingReveals = new Set<Element>();

class FakeIntersectionObserver {
	readonly root = null;
	readonly rootMargin = '0px';
	readonly thresholds = [0];
	readonly #callback: IntersectionObserverCallback;
	readonly #targets = new Set<Element>();

	constructor(callback: IntersectionObserverCallback) {
		this.#callback = callback;
		liveObservers.add(this);
	}

	observe(target: Element) {
		this.#targets.add(target);
		if (pendingReveals.delete(target)) {
			queueMicrotask(() => this.notify(target));
		}
	}

	unobserve(target: Element) {
		this.#targets.delete(target);
	}

	disconnect() {
		this.#targets.clear();
		liveObservers.delete(this);
	}

	takeRecords(): IntersectionObserverEntry[] {
		return [];
	}

	watches(target: Element) {
		return this.#targets.has(target);
	}

	notify(target: Element) {
		if (!this.#targets.has(target)) return;

		const entry: IntersectionObserverEntry = {
			boundingClientRect: target.getBoundingClientRect(),
			intersectionRatio: 1,
			intersectionRect: target.getBoundingClientRect(),
			isIntersecting: true,
			rootBounds: null,
			target,
			time: performance.now()
		};

		this.#callback([entry], this as unknown as IntersectionObserver);
	}
}

export const installFakeIntersectionObserver = () => {
	liveObservers.clear();
	pendingReveals.clear();
	vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
};

export const revealElement = (target: Element | null) => {
	if (!target) {
		throw new Error('revealElement: there is no element to reveal');
	}

	const watching = [...liveObservers].filter((observer) => observer.watches(target));
	if (watching.length === 0) {
		pendingReveals.add(target);
		return;
	}

	for (const observer of watching) {
		observer.notify(target);
	}
};
