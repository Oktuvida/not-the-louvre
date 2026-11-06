import { describe, expect, it } from 'vitest';
import { studioZoomScale } from './studio-framing';

// Once in, the artist sees the whole studio from its corner, on whatever screen
// they have: a laptop window shows the same room, the portrait of them on the
// left wall included, as a large monitor does, only smaller.

// The room at rest, measured on screen: 30.3 by 17.5 of the scene's units.
const ROOM = { height: 17.5, width: 30.3 };
const RESTING_ZOOM = 60;

const screens = [
	{ height: 571, name: 'a laptop window', width: 1000 },
	{ height: 720, name: 'a 720p screen', width: 1280 },
	{ height: 860, name: 'a 14-inch laptop', width: 1512 },
	{ height: 1080, name: 'a 1080p monitor', width: 1920 },
	{ height: 1440, name: 'a 1440p monitor', width: 2560 },
	{ height: 1180, name: 'an upright tablet', width: 820 },
	{ height: 844, name: 'a phone', width: 390 }
];

describe('the studio’s framing', () => {
	for (const screen of screens) {
		it(`shows the whole room, filling the view, on ${screen.name}`, () => {
			const pixelsPerUnit = RESTING_ZOOM * studioZoomScale(screen.width, screen.height);
			const room = { height: ROOM.height * pixelsPerUnit, width: ROOM.width * pixelsPerUnit };

			expect(room.width).toBeLessThanOrEqual(screen.width);
			expect(room.height).toBeLessThanOrEqual(screen.height);
			// Whichever side runs out first, the room spans nearly all of it.
			expect(Math.max(room.width / screen.width, room.height / screen.height)).toBeGreaterThan(0.9);
		});
	}

	it('keeps the room as it was composed before the screen has a size', () => {
		expect(studioZoomScale(0, 0)).toBe(1);
	});
});
