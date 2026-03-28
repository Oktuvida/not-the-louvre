import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { resetBackendState } from '$lib/server/e2e/reset';

const assertPlaywrightRuntime = () => {
	if (process.env.PLAYWRIGHT !== '1') {
		throw error(404, 'Not found');
	}
};

export const POST: RequestHandler = async () => {
	assertPlaywrightRuntime();

	return json({ ok: true, ...(await resetBackendState()) });
};
