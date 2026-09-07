import { afterEach, describe, expect, it } from 'vitest';
import { createStickerBackgroundUrl, stickerCapWidth } from './museum-canvas';

/*
 * The sticker background is baked once per (size, variant) at the preset's
 * `minWidth × height`, and the control it paints is routinely wider than that:
 * a long label — the gallery header's "Join & draw", the detail panel's "Fork"
 * — stretches the button past its `min-width`. The artwork used to be one
 * `preserveAspectRatio="none"` canvas, so everything in it was smeared by that
 * factor: tape strips turned into wide parallelograms and the torn side edges
 * into bars.
 *
 * This measures the real thing in a real browser rather than reading the
 * markup: the same file is mounted at its natural width and at 3× that, and
 * the fixed parts are expected not to move or grow while the paper still fills
 * the control edge to edge.
 */

const SVG_DATA_URL_PREFIX = 'data:image/svg+xml,';

const PRESET_WIDTH = 180;
const PRESET_HEIGHT = 56;

const stickerMarkup = (width: number, height: number) =>
	decodeURIComponent(
		createStickerBackgroundUrl(width, height, { variant: 'primary' }).slice(
			SVG_DATA_URL_PREFIX.length
		)
	);

const hosts: HTMLElement[] = [];

const paintAt = (boxWidth: number) => {
	const host = document.createElement('div');
	host.setAttribute(
		'style',
		`position:fixed;top:0;left:0;line-height:0;width:${boxWidth}px;height:${PRESET_HEIGHT}px`
	);
	host.innerHTML = stickerMarkup(PRESET_WIDTH, PRESET_HEIGHT);
	document.body.append(host);
	hosts.push(host);

	const root = host.querySelector('svg');
	const paper = host.querySelector('.sticker-paper');
	const [leftTape, rightTape] = host.querySelectorAll('.sticker-tape');

	if (!root || !paper || !leftTape || !rightTape) {
		throw new Error('the sticker background is missing its sliced parts');
	}

	return {
		leftTape: leftTape.getBoundingClientRect(),
		paper: paper.getBoundingClientRect(),
		rightTape: rightTape.getBoundingClientRect(),
		root: root.getBoundingClientRect()
	};
};

afterEach(() => {
	for (const host of hosts.splice(0)) host.remove();
});

describe('sticker background geometry', () => {
	it('keeps the tape strips at their own size on a 3× wide control', () => {
		const natural = paintAt(PRESET_WIDTH);
		const wide = paintAt(PRESET_WIDTH * 3);

		// The bug this pins: at 3× these were 3× as wide, and only as wide.
		expect(natural.leftTape.width).toBeGreaterThan(0);
		expect(Math.abs(wide.leftTape.width - natural.leftTape.width)).toBeLessThan(0.5);
		expect(Math.abs(wide.leftTape.height - natural.leftTape.height)).toBeLessThan(0.5);
		expect(Math.abs(wide.rightTape.width - natural.rightTape.width)).toBeLessThan(0.5);
		expect(Math.abs(wide.rightTape.height - natural.rightTape.height)).toBeLessThan(0.5);
	});

	it('pins each cap to its own edge instead of scaling it into the middle', () => {
		const natural = paintAt(PRESET_WIDTH);
		const wide = paintAt(PRESET_WIDTH * 3);

		const leftInset = (measured: ReturnType<typeof paintAt>) =>
			measured.leftTape.left - measured.root.left;
		const rightInset = (measured: ReturnType<typeof paintAt>) =>
			measured.root.right - measured.rightTape.right;

		expect(Math.abs(leftInset(wide) - leftInset(natural))).toBeLessThan(0.5);
		expect(Math.abs(rightInset(wide) - rightInset(natural))).toBeLessThan(0.5);
		// Both caps stay inside the window the builder reserved for them, so the
		// stretchable middle is never covered by one.
		expect(wide.leftTape.right - wide.root.left).toBeLessThanOrEqual(
			stickerCapWidth(PRESET_WIDTH, PRESET_HEIGHT)
		);
	});

	it('still stretches the paper across the whole control', () => {
		const natural = paintAt(PRESET_WIDTH);
		const wide = paintAt(PRESET_WIDTH * 3);

		// The middle is the half that *should* scale: a sticker that keeps its
		// caps but leaves bare pixels either side of the paper is no better.
		expect(natural.paper.width).toBeCloseTo(PRESET_WIDTH - 4, 0);
		expect(wide.paper.width / natural.paper.width).toBeCloseTo(3, 1);
		expect(Math.abs(wide.paper.height - natural.paper.height)).toBeLessThan(0.5);
	});
});
