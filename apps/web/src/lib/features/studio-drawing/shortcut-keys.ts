/*
 * The studio's shortcuts as the label inside the cover prints them, in the
 * keys of the computer they are read on: ⌘ on a Mac (and on an iPad, which
 * says it is one), Ctrl everywhere else, where redo is Ctrl + Y by habit.
 * The keyboard handlers take both spellings on every computer.
 */

export type StudioShortcut = { action: string; keys: string };

const APPLE_PLATFORM = /mac|iphone|ipad|ipod/i;

const MAC_SHORTCUTS: StudioShortcut[] = [
	{ action: 'zoom', keys: 'pinch, or ⌘ + scroll' },
	{ action: 'undo', keys: '⌘ Z' },
	{ action: 'redo', keys: '⌘ ⇧ Z' }
];

const CTRL_SHORTCUTS: StudioShortcut[] = [
	{ action: 'zoom', keys: 'pinch, or Ctrl + scroll' },
	{ action: 'undo', keys: 'Ctrl + Z' },
	{ action: 'redo', keys: 'Ctrl + Y' }
];

type NavigatorWithHints = Navigator & { userAgentData?: { platform?: string } };

/** The platform the browser runs on: its client hints where it has them (Chromium). */
const browserPlatform = () =>
	(navigator as NavigatorWithHints).userAgentData?.platform || navigator.platform;

export const studioShortcuts = () =>
	APPLE_PLATFORM.test(browserPlatform()) ? MAC_SHORTCUTS : CTRL_SHORTCUTS;
