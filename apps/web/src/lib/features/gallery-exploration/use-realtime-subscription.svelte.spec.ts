import { describe, expect, it, vi } from 'vitest';
import { createRealtimeSubscription } from './use-realtime-subscription.svelte';

const createMockChannel = () => {
	const handlers = new Map<string, (payload: unknown) => void>();

	return {
		on: vi
			.fn()
			.mockImplementation(
				(_event: string, _filter: unknown, handler: (payload: unknown) => void) => {
					const table = (_filter as { table?: string })?.table ?? 'unknown';
					handlers.set(table, handler);
					return { on: vi.fn().mockReturnThis(), subscribe: vi.fn() };
				}
			),
		subscribe: vi.fn(),
		handlers,
		unsubscribe: vi.fn()
	};
};

const createMockSupabaseClient = (channel: ReturnType<typeof createMockChannel>) => ({
	channel: vi.fn().mockReturnValue({
		on: vi
			.fn()
			.mockImplementation(
				(_event: string, filter: { table?: string }, handler: (payload: unknown) => void) => {
					channel.handlers.set(filter.table ?? 'unknown', handler);
					return {
						on: vi
							.fn()
							.mockImplementation(
								(
									_event2: string,
									filter2: { table?: string },
									handler2: (payload: unknown) => void
								) => {
									channel.handlers.set(filter2.table ?? 'unknown', handler2);
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
	it('starts subscription when artworkId is set and stops when cleared', async () => {
		const mockChannel = createMockChannel();
		const mockClient = createMockSupabaseClient(mockChannel);
		const removeChannel = vi.fn();
		mockClient.removeChannel = removeChannel;

		const subscription = createRealtimeSubscription({
			getRealtimeClient: () => mockClient as never,
			fetchToken: async () => 'mock-token',
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
			fetchToken: async () => 'mock-token',
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
			fetchToken: async () => 'mock-token',
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
			fetchToken: async () => 'mock-token',
			viewerId: 'user-1',
			onRefresh
		});

		await subscription.start('artwork-1');

		const voteHandler = mockChannel.handlers.get('artwork_vote_realtime');
		voteHandler!({ new: { artwork_id: 'artwork-999' } });

		expect(onRefresh).not.toHaveBeenCalled();
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
