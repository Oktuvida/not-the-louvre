import type { Action } from 'svelte/action';

export type FocusTrapOptions = {
	/** Move focus into the trap as soon as it is installed. */
	autoFocus?: boolean;
	/** Turn the trap off without tearing it down (a nested dialog owns focus). */
	enabled?: boolean;
	/**
	 * Hand focus back to whatever was focused when the trap was installed, on
	 * destroy. Opt-in rather than automatic: a dialog that plays an outro paints
	 * itself over the page after the action is gone, so its opener is not there
	 * to receive focus yet and it has to schedule the hand-back itself
	 * (ArtworkDetailPanel does exactly that). Turn this on for the dialogs that
	 * simply disappear.
	 */
	restoreFocus?: boolean;
};

const FOCUSABLE_SELECTOR = [
	'a[href]',
	'area[href]',
	'audio[controls]',
	'button',
	'iframe',
	'input',
	'select',
	'summary',
	'textarea',
	'video[controls]',
	'[contenteditable]:not([contenteditable="false"])',
	'[tabindex]'
].join(',');

/**
 * Both postcard faces stay mounted with `inert` on the hidden one, and the
 * comment skeleton is `aria-hidden`, so a plain `querySelectorAll` would tab
 * straight into things the visitor cannot see.
 */
const isReachable = (element: HTMLElement) => {
	if (element.hasAttribute('disabled') || element.hasAttribute('hidden')) return false;
	if (Number(element.getAttribute('tabindex') ?? '0') < 0) return false;
	if (element.closest('[inert]') || element.closest('[aria-hidden="true"]')) return false;

	return element.getClientRects().length > 0;
};

export const focusTrap: Action<HTMLElement, FocusTrapOptions | undefined> = (node, parameters) => {
	let options: FocusTrapOptions = parameters ?? {};

	// Captured before `autoFocus` moves focus, so this is the control the
	// visitor was on when the dialog opened.
	const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;

	const tabbables = () =>
		Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(isReachable);

	const focusFirst = () => {
		const [first] = tabbables();
		(first ?? node).focus();
	};

	const handleKeydown = (event: KeyboardEvent) => {
		// A nested trap (the avatar preview inside the artwork dialog) has already
		// decided where focus goes; do not wrap it a second time on the way up.
		if (event.defaultPrevented || event.key !== 'Tab' || options.enabled === false) return;

		const items = tabbables();

		if (items.length === 0) {
			event.preventDefault();
			node.focus();
			return;
		}

		const first = items[0]!;
		const last = items[items.length - 1]!;
		const active = document.activeElement;
		const inside = active instanceof HTMLElement && node.contains(active);

		if (event.shiftKey) {
			if (!inside || active === first || active === node) {
				event.preventDefault();
				last.focus();
			}
			return;
		}

		if (!inside || active === last) {
			event.preventDefault();
			first.focus();
		}
	};

	/**
	 * Focus is ours to give back while it still sits inside the trap — and also
	 * when it sits nowhere, because the control that had it was torn down with
	 * the dialog and the browser fell back to `<body>`. Anything else means the
	 * visitor has already moved on and taking focus would be a hijack.
	 */
	const restoreFocusToOpener = () => {
		if (!options.restoreFocus || !opener?.isConnected) return;

		const active = document.activeElement;
		if (active !== null && active !== document.body && !node.contains(active)) return;

		opener.focus();
	};

	if (options.enabled !== false && options.autoFocus) {
		focusFirst();
	}

	node.addEventListener('keydown', handleKeydown);

	return {
		update(next: FocusTrapOptions | undefined) {
			options = next ?? {};
		},
		destroy() {
			node.removeEventListener('keydown', handleKeydown);
			restoreFocusToOpener();
		}
	};
};
