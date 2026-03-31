import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	if (!dev && env.PLAYWRIGHT !== '1') {
		throw error(404, 'Not found');
	}

	return {};
};
