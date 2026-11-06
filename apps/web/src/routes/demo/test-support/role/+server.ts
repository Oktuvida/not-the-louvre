import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { db } from '#lib/server/db/index.js';
import { users } from '#lib/server/db/schema.js';
import type { ProductRole } from '#lib/shared/viewer.js';

// `__PLAYWRIGHT__` is a build-time constant: true only in the e2e build, so this
// route cannot promote anybody in a production Worker.
export const POST: RequestHandler = async ({ request }) => {
	if (!__PLAYWRIGHT__) throw error(404, 'Not found');

	const { nickname, role } = (await request.json()) as { nickname: string; role: ProductRole };
	await db.update(users).set({ role }).where(eq(users.nickname, nickname));
	return Response.json({ ok: true });
};
