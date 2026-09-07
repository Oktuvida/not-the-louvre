import { afterEach, describe, expect, it } from 'vitest';
import { focusTrap } from './focus-trap';

let dialog: HTMLElement | null = null;

const mountDialog = (html: string) => {
	dialog = document.createElement('div');
	dialog.tabIndex = -1;
	dialog.innerHTML = html;
	document.body.append(dialog);
	return dialog;
};

const tab = (node: HTMLElement, shiftKey = false) => {
	const event = new KeyboardEvent('keydown', {
		bubbles: true,
		cancelable: true,
		key: 'Tab',
		shiftKey
	});
	(document.activeElement ?? node).dispatchEvent(event);
	return event;
};

afterEach(() => {
	dialog?.remove();
	dialog = null;
});

describe('focusTrap', () => {
	it('wraps Tab from the last control back to the first', () => {
		const node = mountDialog('<button id="a">a</button><button id="b">b</button>');
		const trap = focusTrap(node, { autoFocus: true });

		expect(document.activeElement?.id).toBe('a');

		document.getElementById('b')!.focus();
		const event = tab(node);

		expect(event.defaultPrevented).toBe(true);
		expect(document.activeElement?.id).toBe('a');

		trap?.destroy?.();
	});

	it('wraps Shift+Tab from the first control to the last', () => {
		const node = mountDialog('<button id="a">a</button><button id="b">b</button>');
		const trap = focusTrap(node, { autoFocus: true });

		const event = tab(node, true);

		expect(event.defaultPrevented).toBe(true);
		expect(document.activeElement?.id).toBe('b');

		trap?.destroy?.();
	});

	it('never lands on an inert, aria-hidden, disabled or zero-size control', () => {
		const node = mountDialog(`
			<button id="a">a</button>
			<div inert><button id="inert-face">hidden face</button></div>
			<div aria-hidden="true"><button id="decorative">decorative</button></div>
			<button id="off" disabled>disabled</button>
			<button id="collapsed" style="display:none">collapsed</button>
			<button id="z">z</button>
		`);
		const trap = focusTrap(node, { autoFocus: true });

		expect(document.activeElement?.id).toBe('a');

		document.getElementById('z')!.focus();
		tab(node);

		expect(document.activeElement?.id).toBe('a');

		trap?.destroy?.();
	});

	it('stands down while a nested dialog owns focus', () => {
		const node = mountDialog('<button id="a">a</button><button id="b">b</button>');
		const trap = focusTrap(node, { autoFocus: true });

		trap?.update?.({ enabled: false });
		document.getElementById('b')!.focus();
		const event = tab(node);

		expect(event.defaultPrevented).toBe(false);

		trap?.destroy?.();
	});

	it('stops wrapping once it is torn down', () => {
		const node = mountDialog('<button id="a">a</button><button id="b">b</button>');
		const trap = focusTrap(node, { autoFocus: true });

		trap?.destroy?.();
		document.getElementById('b')!.focus();
		const event = tab(node);

		expect(event.defaultPrevented).toBe(false);
		expect(document.activeElement?.id).toBe('b');
	});
});
