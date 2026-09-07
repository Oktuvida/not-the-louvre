import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/private', () => ({ env: {} }));

vi.mock('$lib/server/artwork/read.service', () => ({
	listArtworkDiscovery: vi.fn()
}));

vi.mock('$lib/server/moderation/service', () => ({
	getViewerContentPreferences: vi.fn()
}));

describe('loadGalleryRoomShell', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	it('warns once per isolate when the realtime anon key is missing', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const { loadGalleryRoomShell } = await import('./gallery-data.server');

		const first = loadGalleryRoomShell('hot-wall');
		const second = loadGalleryRoomShell('hall-of-fame');

		// Without the key the browser silently never opens a realtime channel,
		// so live votes and comments just stop arriving.
		expect(first.realtimeConfig.anonKey).toBeNull();
		expect(second.realtimeConfig.anonKey).toBeNull();
		expect(warn).toHaveBeenCalledTimes(1);
		expect(String(warn.mock.calls[0]?.[0])).toContain('SUPABASE_ANON_KEY');

		warn.mockRestore();
	});
});
