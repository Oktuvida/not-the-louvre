import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createClient } = vi.hoisted(() => ({
	createClient: vi.fn()
}));

vi.mock('@supabase/supabase-js', () => ({
	createClient
}));

import { getBrowserRealtimeClient, resetBrowserRealtimeClientCache } from './browser-client';

describe('getBrowserRealtimeClient', () => {
	beforeEach(() => {
		createClient.mockReset();
		resetBrowserRealtimeClientCache();
		createClient.mockImplementation((url: string, anonKey: string, options: unknown) => ({
			anonKey,
			getChannels: () => [],
			options,
			removeChannel: vi.fn(),
			url
		}));
	});

	it('reuses the same browser client for the same Supabase credentials', () => {
		const first = getBrowserRealtimeClient('https://example.supabase.co', 'anon-key');
		const second = getBrowserRealtimeClient('https://example.supabase.co', 'anon-key');

		expect(first).toBe(second);
		expect(createClient).toHaveBeenCalledTimes(1);
	});

	it('creates a separate client when the Supabase credentials differ', () => {
		const first = getBrowserRealtimeClient('https://example.supabase.co', 'anon-key');
		const second = getBrowserRealtimeClient('https://other.supabase.co', 'anon-key');

		expect(first).not.toBe(second);
		expect(createClient).toHaveBeenCalledTimes(2);
	});

	it('disables browser auth persistence for realtime-only clients', () => {
		getBrowserRealtimeClient('https://example.supabase.co', 'anon-key');

		expect(createClient).toHaveBeenCalledWith('https://example.supabase.co', 'anon-key', {
			auth: {
				autoRefreshToken: false,
				detectSessionInUrl: false,
				persistSession: false
			}
		});
	});
});
