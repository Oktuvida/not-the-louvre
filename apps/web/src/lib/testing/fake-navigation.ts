import { vi } from 'vitest';
import { fakePage } from './fake-page-state.svelte.js';

/*
 * A stand-in for `$app/navigation` in component specs. Under SvelteKit 3, Vitest's
 * `importOriginal()` of the real module never resolves in the browser runner, so
 * specs replace it whole:
 *
 *   vi.mock('$app/navigation', async () =>
 *     (await import('#lib/testing/fake-navigation.js')).fakeNavigation
 *   );
 *
 * A shallow `goto` (SvelteKit 3's replacement for pushState and replaceState)
 * moves `fakePage` the way the router would.
 */

type GotoOptions = {
	replace?: boolean;
	shallow?: boolean;
	state?: Record<string, unknown>;
};

// Every export of SvelteKit 3's `$app/navigation`, so a component deep in the tree
// never imports a name the mock lacks.
export const fakeNavigation = {
	afterNavigate: vi.fn(),
	beforeNavigate: vi.fn(),
	disableScrollHandling: vi.fn(),
	goto: vi.fn(async (url: string | URL, options: GotoOptions = {}) => {
		if (options.shallow) fakePage.set({ state: options.state ?? {}, url });
	}),
	invalidate: vi.fn(async () => {}),
	invalidateAll: vi.fn(async () => {}),
	onNavigate: vi.fn(),
	preloadCode: vi.fn(async () => {}),
	preloadData: vi.fn(async () => ({ type: 'loaded' as const, status: 200, data: {} })),
	pushState: vi.fn((url: string | URL, state: Record<string, unknown>) =>
		fakePage.set({ state, url })
	),
	refreshAll: vi.fn(async () => {}),
	replaceState: vi.fn((url: string | URL, state: Record<string, unknown>) =>
		fakePage.set({ state, url })
	),
	snapshot: vi.fn()
};
