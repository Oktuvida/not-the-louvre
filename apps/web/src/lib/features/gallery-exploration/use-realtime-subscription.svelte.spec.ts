import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	clearRealtimeTokenCache,
	createRealtimeSubscription
} from './use-realtime-subscription.svelte';

const createMockChannel = () => {
	const handlers = new Map<string, (payload: unknown) => void>();
	const filters = new Map<string, string | undefined>();

	return {
		on: vi
			.fn()
			.mockImplementation(
				(_event: string, _filter: unknown, handler: (payload: unknown) => void) => {
					const table = (_filter as { table?: string })?.table ?? 'unknown';
					handlers.set(table, handler);
					filters.set(table, (_filter as { filter?: string })?.filter);
					return { on: vi.fn().mockReturnThis(), subscribe: vi.fn() };
				}
			),
		subscribe: vi.fn(),
		filters,
		handlers,
		unsubscribe: vi.fn()
	};
};

const createMockSupabaseClient = (channel: ReturnType<typeof createMockChannel>) => ({
	channel: vi.fn().mockReturnValue({
		on: vi
			.fn()
			.mockImplementation(
				(
					_event: string,
					filter: { filter?: string; table?: string },
					handler: (payload: unknown) => void
				) => {
					channel.handlers.set(filter.table ?? 'unknown', handler);
					channel.filters.set(filter.table ?? 'unknown', filter.filter);
					return {
						on: vi
							.fn()
							.mockImplementation(
								(
									_event2: string,
									filter2: { filter?: string; table?: string },
									handler2: (payload: unknown) => void
								) => {
									channel.handlers.set(filter2.table ?? 'unknown', handler2);
									channel.filters.set(filter2.table ?? 'unknown', filter2.filter);
									return { subscribe: vi.fn() };
								}
							),
						subscribe: vi.fn()
					};
				}
			),
		subscribe: vi.fn()
	}),
	removeChannel: vi.fn(),
	realtime: {
		setAuth: vi.fn()
	}
});

describe('createRealtimeSubscription', () => {
	beforeEach(() => {
		clearRealtimeTokenCache();
	});

	it('starts subscription when artworkId is set and stops when cleared', async () => {
		const mockChannel = createMockChannel();
		const mockClient = createMockSupabaseClient(mockChannel);
		const removeChannel = vi.fn();
		mockClient.removeChannel = removeChannel;

		const subscription = createRealtimeSubscription({
			getRealtimeClient: () => mockClient as never,
			fetchToken: async () => ({ token: 'mock-token' }),
			viewerId: 'user-1',
			onRefresh: vi.fn()
		});

		expect(subscription.isConnected).toBe(false);

		await subscription.start('artwork-1');

		expect(mockClient.realtime.setAuth).toHaveBeenCalledWith('mock-token');
		expect(mockClient.channel).toHaveBeenCalled();
		expect(subscription.isConnected).toBe(true);

		subscription.stop();

		expect(subscription.isConnected).toBe(false);
	});

	it('calls onRefresh callback on postgres_changes events for the subscribed artwork', async () => {
		const mockChannel = createMockChannel();
		const mockClient = createMockSupabaseClient(mockChannel);
		const onRefresh = vi.fn();

		const subscription = createRealtimeSubscription({
			getRealtimeClient: () => mockClient as never,
			fetchToken: async () => ({ token: 'mock-token' }),
			viewerId: 'user-1',
			onRefresh
		});

		await subscription.start('artwork-1');

		// Simulate a vote change event
		const voteHandler = mockChannel.handlers.get('artwork_vote_realtime');
		expect(voteHandler).toBeDefined();

		voteHandler!({ new: { artwork_id: 'artwork-1' } });
		expect(onRefresh).toHaveBeenCalledWith('artwork-1');

		// Simulate a comment change event
		const commentHandler = mockChannel.handlers.get('artwork_comment_realtime');
		expect(commentHandler).toBeDefined();

		commentHandler!({ new: { artwork_id: 'artwork-1' } });
		expect(onRefresh).toHaveBeenCalledTimes(2);
	});

	it('integrates with attempt controller — starting a new subscription cancels the previous one', async () => {
		const mockChannel = createMockChannel();
		const mockClient = createMockSupabaseClient(mockChannel);
		const removeChannel = vi.fn();
		mockClient.removeChannel = removeChannel;

		const subscription = createRealtimeSubscription({
			getRealtimeClient: () => mockClient as never,
			fetchToken: async () => ({ token: 'mock-token' }),
			viewerId: 'user-1',
			onRefresh: vi.fn()
		});

		await subscription.start('artwork-1');
		expect(subscription.isConnected).toBe(true);

		// Starting a new subscription should clean up the old one
		await subscription.start('artwork-2');
		expect(removeChannel).toHaveBeenCalled();
		expect(subscription.isConnected).toBe(true);
	});

	it('ignores events for artworks other than the subscribed one', async () => {
		const mockChannel = createMockChannel();
		const mockClient = createMockSupabaseClient(mockChannel);
		const onRefresh = vi.fn();

		const subscription = createRealtimeSubscription({
			getRealtimeClient: () => mockClient as never,
			fetchToken: async () => ({ token: 'mock-token' }),
			viewerId: 'user-1',
			onRefresh
		});

		await subscription.start('artwork-1');

		const voteHandler = mockChannel.handlers.get('artwork_vote_realtime');
		voteHandler!({ new: { artwork_id: 'artwork-999' } });

		expect(onRefresh).not.toHaveBeenCalled();
	});

	it('scopes both postgres_changes registrations to the subscribed artwork', async () => {
		const mockChannel = createMockChannel();
		const mockClient = createMockSupabaseClient(mockChannel);

		const subscription = createRealtimeSubscription({
			getRealtimeClient: () => mockClient as never,
			fetchToken: async () => ({ token: 'mock-token' }),
			viewerId: 'user-1',
			onRefresh: vi.fn()
		});

		await subscription.start('artwork-1');

		// Without the server-side filter every vote and comment on the site is
		// broadcast to every browser and thrown away client-side.
		expect(mockChannel.filters.get('artwork_vote_realtime')).toBe('artwork_id=eq.artwork-1');
		expect(mockChannel.filters.get('artwork_comment_realtime')).toBe('artwork_id=eq.artwork-1');
	});

	it('reuses a realtime token while more than half its lifetime remains', async () => {
		const mockChannel = createMockChannel();
		const mockClient = createMockSupabaseClient(mockChannel);
		const fetchToken = vi.fn(async () => ({
			expiresAt: new Date(Date.now() + 300_000).toISOString(),
			token: 'fresh-token'
		}));

		const subscription = createRealtimeSubscription({
			getRealtimeClient: () => mockClient as never,
			fetchToken,
			viewerId: 'user-1',
			onRefresh: vi.fn()
		});

		await subscription.start('artwork-1');
		subscription.stop();
		await subscription.start('artwork-2');

		expect(fetchToken).toHaveBeenCalledTimes(1);
		expect(mockClient.realtime.setAuth).toHaveBeenNthCalledWith(2, 'fresh-token');
	});

	it('mints a new token once the cached one is close to expiring', async () => {
		const mockChannel = createMockChannel();
		const mockClient = createMockSupabaseClient(mockChannel);
		const fetchToken = vi.fn(async () => ({
			// Under the 150s reuse floor: nothing re-authenticates a live channel,
			// so a nearly-expired token would leave an open panel quietly deaf.
			expiresAt: new Date(Date.now() + 60_000).toISOString(),
			token: 'short-lived-token'
		}));

		const subscription = createRealtimeSubscription({
			getRealtimeClient: () => mockClient as never,
			fetchToken,
			viewerId: 'user-1',
			onRefresh: vi.fn()
		});

		await subscription.start('artwork-1');
		await subscription.start('artwork-2');

		expect(fetchToken).toHaveBeenCalledTimes(2);
	});

	it('handles token fetch failure gracefully', async () => {
		const subscription = createRealtimeSubscription({
			getRealtimeClient: () => {
				throw new Error('should not be called');
			},
			fetchToken: async () => null,
			viewerId: 'user-1',
			onRefresh: vi.fn()
		});

		await subscription.start('artwork-1');

		expect(subscription.isConnected).toBe(false);
	});
});
