import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import AwardMark from './AwardMark.svelte';

// The Hall of Fame's three places, in whichever of its two hands the visit
// drew: a rubber stamp in coloured ink, or a doodle in marker on the wall.

const places = [
	{ name: 'Champion, first place', place: 1, stamped: '1st', doodled: '#1!' },
	{ name: 'Runner-up, second place', place: 2, stamped: '2nd', doodled: '2nd!' },
	{ name: 'Bronze star, third place', place: 3, stamped: '3rd', doodled: '3rd' }
] as const;

describe('AwardMark', () => {
	it('stamps the champion in ink, 1st inside the Hall of Fame ring', async () => {
		await render(AwardMark, { awardStyle: 'stamps', place: 1 });

		const award = page.getByRole('img', { name: 'Champion, first place (rubber stamp)' });
		await expect.element(award).toBeVisible();
		await expect.element(award.getByText('1st')).toBeVisible();
		await expect.element(award.getByText('HALL OF FAME · NOT THE LOUVRE ·')).toBeVisible();
		await expect.element(award.getByText('CHAMPION')).toBeVisible();
	});

	it('crowns the champion in marker', async () => {
		await render(AwardMark, { awardStyle: 'doodles', place: 1 });

		const award = page.getByRole('img', { name: 'Champion, first place (marker doodle)' });
		await expect.element(award).toBeVisible();
		await expect.element(award.getByText('#1!')).toBeVisible();
	});

	for (const { doodled, name, place, stamped } of places) {
		it(`marks ${name} in either hand`, async () => {
			const { rerender } = await render(AwardMark, { awardStyle: 'stamps', place });
			const stamp = page.getByRole('img', { name: `${name} (rubber stamp)` });
			await expect.element(stamp.getByText(stamped)).toBeVisible();

			await rerender({ awardStyle: 'doodles', place });
			const doodle = page.getByRole('img', { name: `${name} (marker doodle)` });
			await expect.element(doodle.getByText(doodled)).toBeVisible();
		});
	}

	it('in the corner of a postcard, is the mark alone, without its title', async () => {
		const { rerender } = await render(AwardMark, { awardStyle: 'stamps', corner: true, place: 1 });
		const stamp = page.getByRole('img', { name: 'Champion, first place (rubber stamp)' });
		await expect.element(stamp.getByText('1st')).toBeVisible();
		await expect.element(stamp.getByText('CHAMPION')).not.toBeInTheDocument();

		await rerender({ awardStyle: 'doodles', corner: true, place: 1 });
		const crown = page.getByRole('img', { name: 'Champion, first place (marker doodle)' });
		await expect.element(crown).toBeVisible();
		await expect.element(crown.getByText('#1!')).not.toBeInTheDocument();
	});
});
