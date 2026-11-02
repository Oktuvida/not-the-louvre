import { afterEach, describe, expect, it, vi } from 'vitest';
import { load } from './+layout.server';

// Each visit to the gallery draws the Hall of Fame's award style once: rubber
// stamps or marker doodles, each as likely as the other.

const visit = () => load({} as Parameters<typeof load>[0]);

describe('a visit to the gallery', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('draws one of the two award styles, each as likely as the other', () => {
		vi.spyOn(Math, 'random').mockReturnValue(0.2);
		expect(visit()).toEqual({ awardStyle: 'stamps' });

		vi.spyOn(Math, 'random').mockReturnValue(0.7);
		expect(visit()).toEqual({ awardStyle: 'doodles' });
	});
});
