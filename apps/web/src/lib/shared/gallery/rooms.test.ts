import { describe, expect, it } from 'vitest';
import { roomHref, roomIdForPath } from './rooms';

describe('the room a gallery address names', () => {
	it('reads every room back from its own href', () => {
		for (const roomId of ['hall-of-fame', 'hot-wall', 'mystery', 'your-studio'] as const) {
			expect(roomIdForPath(roomHref(roomId))).toBe(roomId);
		}
	});

	it('takes the spelled-out hall of fame address too', () => {
		expect(roomIdForPath('/gallery/hall-of-fame')).toBe('hall-of-fame');
	});

	it('names no room for an address outside the gallery', () => {
		expect(roomIdForPath('/artwork/artwork-1')).toBe(null);
		expect(roomIdForPath('/gallery/attic')).toBe(null);
		expect(roomIdForPath('/draw')).toBe(null);
	});
});
