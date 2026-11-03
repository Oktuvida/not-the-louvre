import { version } from '$app/env';
import { updated } from '$app/state';

/** The release this tab last reloaded itself out of. */
const RELOADED_FROM_KEY = 'ntl:reloaded-from-release';

/**
 * A tab left open across a release still runs the build it was opened on, and
 * that build's hashed files are gone from the server. When one of them fails
 * to load, this asks whether a newer release is out and, if so, reloads the
 * page into it. Resolves `true` when the page is about to reload.
 *
 * Once per release the tab ran: a cache that keeps handing out the old page
 * would otherwise reload the tab for as long as it stayed open. Without
 * storage there is no such guard, so there is no reload either.
 */
export const reloadIntoNewRelease = async (): Promise<boolean> => {
	if (!(await updated.check())) return false;

	try {
		if (sessionStorage.getItem(RELOADED_FROM_KEY) === version) return false;
		sessionStorage.setItem(RELOADED_FROM_KEY, version);
	} catch {
		return false;
	}

	location.reload();
	return true;
};
