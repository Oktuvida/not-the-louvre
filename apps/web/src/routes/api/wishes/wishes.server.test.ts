import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ArtworkFlowError } from '#lib/server/artwork/errors.js';

const mocked = vi.hoisted(() => ({
	createWish: vi.fn(),
	listWishes: vi.fn()
}));

vi.mock('#lib/server/artwork/service.js', () => ({
	createWish: mocked.createWish,
	listWishes: mocked.listWishes
}));

vi.mock('better-auth/api', () => ({ getIP: () => '203.0.113.7' }));
vi.mock('#lib/server/auth.js', () => ({ auth: { options: {} } }));

const event = (url: string, init?: RequestInit, user: unknown = null) =>
	({
		locals: { user },
		request: new Request(url, init),
		url: new URL(url)
	}) as never;

describe('the mailbox endpoint', () => {
	beforeEach(() => {
		mocked.createWish.mockReset();
		mocked.listWishes.mockReset();
	});

	it('hands out slips, skipping the ones the artist has just seen', async () => {
		mocked.listWishes.mockResolvedValue([{ author: 'oktuvida', id: 'wish-1', text: 'a sun' }]);
		const { GET } = await import('./+server');
		const user = { id: 'artist-1' };

		const response = await GET(event('http://localhost/api/wishes?seen=a,b', undefined, user));

		expect(await response.json()).toEqual({
			wishes: [{ author: 'oktuvida', id: 'wish-1', text: 'a sun' }]
		});
		expect(mocked.listWishes).toHaveBeenCalledWith({ seen: ['a', 'b'] }, { user });
	});

	it('takes a slip from an artist', async () => {
		mocked.createWish.mockResolvedValue({ author: 'hithere', id: 'wish-2', text: 'a sun' });
		const { POST } = await import('./+server');
		const user = { id: 'artist-1' };

		const response = await POST(
			event(
				'http://localhost/api/wishes',
				{ body: JSON.stringify({ text: 'a sun' }), method: 'POST' },
				user
			)
		);

		expect(response.status).toBe(201);
		expect(await response.json()).toEqual({
			wish: { author: 'hithere', id: 'wish-2', text: 'a sun' }
		});
		expect(mocked.createWish).toHaveBeenCalledWith(
			{ text: 'a sun' },
			{ ipAddress: '203.0.113.7', user }
		);
	});

	it('says why a slip was refused', async () => {
		mocked.createWish.mockRejectedValue(new ArtworkFlowError(400, 'Not that word', 'INVALID_WISH'));
		const { POST } = await import('./+server');

		const response = await POST(
			event('http://localhost/api/wishes', { body: JSON.stringify({ text: 'x' }), method: 'POST' })
		);

		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({ code: 'INVALID_WISH', message: 'Not that word' });
	});
});
