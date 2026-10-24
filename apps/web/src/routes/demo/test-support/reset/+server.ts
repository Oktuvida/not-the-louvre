import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { resetBackendState } from '#lib/server/e2e/reset.js';

// `__PLAYWRIGHT__` is a build-time constant: true only in the e2e build, so this
// route cannot wipe anything in a production Worker.
const assertPlaywrightRuntime = () => {
	if (!__PLAYWRIGHT__) {
		throw error(404, 'Not found');
	}
};

export const POST: RequestHandler = async () => {
	assertPlaywrightRuntime();

	return Response.json({ ok: true, ...(await resetBackendState()) });
};
