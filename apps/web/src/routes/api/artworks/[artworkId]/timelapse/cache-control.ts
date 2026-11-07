// A published drawing never changes, but hiding the artwork must still reach
// browsers soon; a hidden one is only for its author and moderators, so it
// stays out of every shared cache.
export const timelapseCacheControl = (isHidden: boolean) =>
	isHidden ? 'private, no-store' : 'public, max-age=300';
