/*
 * A stand-in for `$app/state` in component specs. `page` exposes the same reactive
 * read surface, backed by $state, so a spec can move the page (a navigation, a
 * shallow-routing goto) and watch the component react; `navigating` stays idle:
 *
 *   vi.mock('$app/state', async () =>
 *     (await import('#lib/testing/fake-page-state.svelte.js')).fakeAppState
 *   );
 */

type FakePageValue = {
	data: Record<string, unknown>;
	state: Record<string, unknown>;
	url: URL;
};

const blankPage = (): FakePageValue => ({
	data: {},
	state: {},
	url: new URL('http://localhost/')
});

let current = $state<FakePageValue>(blankPage());

export const fakePage = {
	page: {
		get data() {
			return current.data;
		},
		get state() {
			return current.state;
		},
		get url() {
			return current.url;
		}
	},
	/** Replaces the given parts of the page; a relative `url` resolves against the current one. */
	set(next: {
		data?: Record<string, unknown>;
		state?: Record<string, unknown>;
		url?: string | URL;
	}) {
		current = {
			data: next.data ?? current.data,
			state: next.state ?? current.state,
			// Replaced whole and never mutated, like the real page.url, so a plain URL
			// is the right stand-in for SvelteURL here.
			// eslint-disable-next-line svelte/prefer-svelte-reactivity
			url: next.url === undefined ? current.url : new URL(next.url, current.url)
		};
	},
	reset() {
		current = blankPage();
	}
};

export const fakeAppState = {
	navigating: { complete: null, delta: null, from: null, to: null, type: null, willUnload: null },
	page: fakePage.page,
	updated: { check: async () => false, current: false }
};
