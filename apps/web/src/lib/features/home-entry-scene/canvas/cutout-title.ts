/*
 * The front door's title, NOT THE LOUVRE, as a ransom note: every letter cut
 * from a different paper — a newspaper headline with its body copy and column
 * rule, a glossy magazine photo printed in halftone, a red masthead with a
 * sliver of the next letter, a yellow ad, a paper bag, a cheap print whose
 * colours slipped out of register — snipped with scissors, stuck on a little
 * crooked, two of them held by tape.
 *
 * A pure SVG string builder, like the museum's other art: the glyph outlines
 * come in from outside (the generator reads them from the fonts), so the
 * title ships as paths in one static file and the front door loads none of
 * these typefaces.
 */

export type CutoutFont =
	| 'abril'
	| 'alfa-slab'
	| 'anton'
	| 'archivo-black'
	| 'fredoka-bold'
	| 'playfair-black'
	| 'playfair-black-italic';

export type GlyphOutline = { d: string; x1: number; y1: number; x2: number; y2: number };

/** A glyph's outline at a font size, its baseline at y = 0. */
export type GlyphSource = (font: CutoutFont, char: string, size: number) => GlyphOutline;

export type CutoutLayout = 'stacked' | 'wide';

type Paper = 'black' | 'cream' | 'kraft' | 'news' | 'photo' | 'red' | 'yellow';

type Clipping = {
	char: string;
	font: CutoutFont;
	paper: Paper;
	w: number;
	h: number;
	rotate: number;
	ink: string;
	/** For a photo: its colours, light to deep. */
	photo?: readonly [string, string, string];
	/** A dark outline round a light letter, as a photo headline prints it. */
	outline?: string;
	/** A sliver of the neighbouring letter, left on the paper by the scissors. */
	sliver?: { char: string; font: CutoutFont };
	/** Newspaper only: where its body copy shows. */
	copy?: 'bottom' | 'top';
	rule?: 'left' | 'right' | 'both';
	highlighter?: boolean;
	misregistered?: boolean;
	tape?: 'left' | 'right';
};

const WORDS: readonly (readonly Clipping[])[] = [
	[
		{
			char: 'N',
			font: 'playfair-black',
			paper: 'news',
			w: 78,
			h: 96,
			rotate: -5,
			ink: '#161412',
			copy: 'bottom',
			rule: 'left'
		},
		{
			char: 'O',
			font: 'anton',
			paper: 'photo',
			w: 82,
			h: 104,
			rotate: 4,
			ink: '#fdfbf7',
			outline: '#1a1210',
			photo: ['#ffd08a', '#f08a3c', '#b8401f']
		},
		{
			char: 'T',
			font: 'archivo-black',
			paper: 'red',
			w: 72,
			h: 98,
			rotate: -3,
			ink: '#fdfbf7',
			sliver: { char: 'I', font: 'archivo-black' },
			tape: 'left'
		}
	],
	[
		{ char: 'T', font: 'alfa-slab', paper: 'yellow', w: 70, h: 92, rotate: 6, ink: '#1a1712' },
		{
			char: 'h',
			font: 'abril',
			paper: 'news',
			w: 70,
			h: 104,
			rotate: -4,
			ink: '#161412',
			copy: 'top',
			rule: 'right'
		},
		{
			char: 'E',
			font: 'playfair-black-italic',
			paper: 'black',
			w: 72,
			h: 96,
			rotate: 3,
			ink: '#fdfbf7'
		}
	],
	[
		{ char: 'L', font: 'fredoka-bold', paper: 'kraft', w: 66, h: 98, rotate: 3, ink: '#3a220c' },
		{
			char: 'O',
			font: 'archivo-black',
			paper: 'photo',
			w: 84,
			h: 92,
			rotate: -6,
			ink: '#160c10',
			photo: ['#f27bb5', '#e2338b', '#a8135e']
		},
		{
			char: 'U',
			font: 'anton',
			paper: 'news',
			w: 76,
			h: 100,
			rotate: 4,
			ink: '#161412',
			copy: 'bottom',
			rule: 'both'
		},
		{
			char: 'v',
			font: 'playfair-black-italic',
			paper: 'photo',
			w: 70,
			h: 88,
			rotate: -3,
			ink: '#fdfbf7',
			photo: ['#9fd2f2', '#3f8fd0', '#2a6fb0']
		},
		{
			char: 'R',
			font: 'archivo-black',
			paper: 'cream',
			w: 72,
			h: 98,
			rotate: 5,
			ink: '#1b1715',
			misregistered: true
		},
		{
			char: 'E',
			font: 'abril',
			paper: 'news',
			w: 70,
			h: 94,
			rotate: -4,
			ink: '#161412',
			highlighter: true,
			tape: 'right'
		}
	]
];

const PAPER_FILL: Record<Exclude<Paper, 'photo'>, string> = {
	black: '#141112',
	cream: '#f1ece2',
	kraft: '#b98b54',
	news: '#e9e3d3',
	red: '#d7262e',
	yellow: '#f6d33c'
};

const LETTER_GAP = -3;
const WORD_GAP = 26;
const PAD = 18;

/** A small seeded generator, so the same title is cut every build. */
const random = (seed: number) => () => {
	seed |= 0;
	seed = (seed + 0x6d2b79f5) | 0;
	let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
	t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const round = (value: number) => Math.round(value * 100) / 100;

/** A scissor cut round a w × h box: no corner quite square, a kink or two. */
const cutOutline = (w: number, h: number, next: () => number) => {
	const jitter = (span: number) => (next() - 0.5) * span;
	const points: [number, number][] = [
		[jitter(5), jitter(5)],
		[w * (0.35 + next() * 0.3), jitter(3)],
		[w + jitter(5), jitter(5)],
		[w + jitter(3), h * (0.4 + next() * 0.2)],
		[w + jitter(5), h + jitter(5)],
		[w * (0.35 + next() * 0.3), h + jitter(3)],
		[jitter(5), h + jitter(5)],
		[jitter(3), h * (0.4 + next() * 0.2)]
	];
	return `M${points.map(([x, y]) => `${round(x)} ${round(y)}`).join('L')}Z`;
};

/** A line of body copy: words of uneven length. */
const copyLines = (w: number, top: number, rows: number, next: () => number) => {
	const rects: string[] = [];
	for (let row = 0; row < rows; row++) {
		let x = 4 + next() * 3;
		const y = top + row * 4.4;
		while (x < w - 6) {
			const word = Math.min(3 + next() * 10, w - 4 - x);
			rects.push(`<rect x="${round(x)}" y="${round(y)}" width="${round(word)}" height="1.6"/>`);
			x += word + 1.8;
		}
	}
	return `<g fill="#4f4840" fill-opacity=".6">${rects.join('')}</g>`;
};

const defs = `<defs>
<filter id="lift" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="2.2" stdDeviation="1.6" flood-color="#28190a" flood-opacity=".42"/></filter>
<pattern id="halftone" width="3.4" height="3.4" patternUnits="userSpaceOnUse" patternTransform="rotate(15)"><circle cx="1.7" cy="1.7" r=".95" fill="#000" fill-opacity=".2"/></pattern>
<pattern id="fibres" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="1" cy="2" r=".7" fill="#5a3a14" fill-opacity=".22"/><circle cx="4.2" cy="4.6" r=".55" fill="#5a3a14" fill-opacity=".18"/></pattern>
<pattern id="grain" width="4" height="4" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".5" fill="#000" fill-opacity=".08"/><circle cx="3" cy="2.6" r=".4" fill="#fff" fill-opacity=".08"/></pattern>
<linearGradient id="gloss" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".34"/><stop offset=".42" stop-color="#fff" stop-opacity="0"/></linearGradient>
</defs>`;

const clippingMarkup = (
	clipping: Clipping,
	index: number,
	x: number,
	y: number,
	glyph: GlyphSource
) => {
	const next = random(index * 977 + clipping.char.charCodeAt(0));
	const { w, h } = clipping;
	const outline = cutOutline(w, h, next);
	const id = `c${index}`;

	// The letter fills the paper the way a headline does: tall, centred.
	const probe = glyph(clipping.font, clipping.char, 100);
	const scale = Math.min((0.74 * h) / (probe.y2 - probe.y1), (0.8 * w) / (probe.x2 - probe.x1));
	const letter = glyph(clipping.font, clipping.char, 100 * scale);
	const dx = round(w / 2 - (letter.x1 + letter.x2) / 2);
	const dy = round(h / 2 - (letter.y1 + letter.y2) / 2);

	const paper =
		clipping.paper === 'photo'
			? `<linearGradient id="${id}p" x1="0" y1="0" x2=".6" y2="1"><stop offset="0" stop-color="${clipping.photo![0]}"/><stop offset=".5" stop-color="${clipping.photo![1]}"/><stop offset="1" stop-color="${clipping.photo![2]}"/></linearGradient>`
			: '';
	const fill = clipping.paper === 'photo' ? `url(#${id}p)` : PAPER_FILL[clipping.paper];

	const layers: string[] = [
		`<rect x="-6" y="-6" width="${w + 12}" height="${h + 12}" fill="${fill}"/>`
	];
	if (clipping.paper === 'photo')
		layers.push(`<rect x="-6" y="-6" width="${w + 12}" height="${h + 12}" fill="url(#halftone)"/>`);
	if (clipping.paper === 'kraft')
		layers.push(`<rect x="-6" y="-6" width="${w + 12}" height="${h + 12}" fill="url(#fibres)"/>`);
	if (
		clipping.paper === 'red' ||
		clipping.paper === 'yellow' ||
		clipping.paper === 'black' ||
		clipping.paper === 'cream'
	) {
		layers.push(`<rect x="-6" y="-6" width="${w + 12}" height="${h + 12}" fill="url(#grain)"/>`);
	}
	if (clipping.copy === 'bottom') layers.push(copyLines(w, h - 13, 3, next));
	if (clipping.copy === 'top') layers.push(copyLines(w, 2, 2, next));
	if (clipping.rule === 'left' || clipping.rule === 'both')
		layers.push(
			`<rect x="7" y="-6" width=".9" height="${h + 12}" fill="#2d2824" fill-opacity=".7"/>`
		);
	if (clipping.rule === 'right' || clipping.rule === 'both')
		layers.push(
			`<rect x="${w - 8}" y="-6" width=".9" height="${h + 12}" fill="#2d2824" fill-opacity=".7"/>`
		);
	if (clipping.highlighter) {
		layers.push(
			`<rect x="-8" y="${round(h * 0.42)}" width="${w + 16}" height="${round(h * 0.26)}" fill="#ff78aa" fill-opacity=".55" transform="rotate(-4 ${w / 2} ${h / 2})"/>`
		);
	}
	if (clipping.sliver) {
		const sliver = glyph(clipping.sliver.font, clipping.sliver.char, 100 * scale);
		// Only its edge made it inside the cut.
		layers.push(
			`<path d="${sliver.d}" fill="${clipping.ink}" transform="translate(${round(w - 7 - sliver.x1)} ${dy})"/>`
		);
	}
	if (clipping.misregistered) {
		layers.push(
			`<path d="${letter.d}" fill="#00aadc" fill-opacity=".55" transform="translate(${dx - 1.6} ${dy})"/>`
		);
		layers.push(
			`<path d="${letter.d}" fill="#e60078" fill-opacity=".45" transform="translate(${dx + 1.6} ${dy + 0.6})"/>`
		);
	}
	const stroke = clipping.outline
		? ` stroke="${clipping.outline}" stroke-width="2.4" paint-order="stroke"`
		: '';
	layers.push(
		`<path d="${letter.d}" fill="${clipping.ink}"${stroke} transform="translate(${dx} ${dy})"/>`
	);
	if (clipping.paper === 'photo' || clipping.paper === 'black')
		layers.push(`<rect x="-6" y="-6" width="${w + 12}" height="${h + 12}" fill="url(#gloss)"/>`);

	// The cut edge shows the paper's white core.
	const edge = clipping.paper === 'news' || clipping.paper === 'cream' ? '#fffdf6' : '#ffffff';
	const tape = clipping.tape
		? `<path d="M0 1L3 0L50 1L52 4L50 8L52 13L49 15L2 14L0 11L2 7Z" fill="#e9dcc0" fill-opacity=".86" transform="translate(${clipping.tape === 'left' ? -18 : w - 30} ${clipping.tape === 'left' ? -4 : h - 10}) rotate(${clipping.tape === 'left' ? -24 : 18})"/>`
		: '';

	return `<g transform="translate(${round(x)} ${round(y)}) rotate(${clipping.rotate} ${w / 2} ${h / 2})">${paper}<clipPath id="${id}"><path d="${outline}"/></clipPath><g filter="url(#lift)"><g clip-path="url(#${id})">${layers.join('')}</g><path d="${outline}" fill="none" stroke="${edge}" stroke-opacity=".6" stroke-width="1.3"/></g>${tape}</g>`;
};

const rowOf = (words: readonly (readonly Clipping[])[]) => {
	const placed: { clipping: Clipping; x: number }[] = [];
	let x = 0;
	words.forEach((word, wordIndex) => {
		if (wordIndex > 0) x += WORD_GAP;
		word.forEach((clipping, letterIndex) => {
			if (letterIndex > 0) x += LETTER_GAP;
			placed.push({ clipping, x });
			x += clipping.w;
		});
	});
	return { placed, width: x, height: Math.max(...placed.map(({ clipping }) => clipping.h)) };
};

/**
 * The title's SVG: on one line for a screen on its side, on two (NOT THE /
 * LOUVRE) for an upright one.
 */
export const createCutoutTitleSvg = (layout: CutoutLayout, glyph: GlyphSource) => {
	const rows = layout === 'wide' ? [WORDS] : [WORDS.slice(0, 2), WORDS.slice(2)];
	const laid = rows.map(rowOf);
	const width = Math.max(...laid.map((row) => row.width)) + PAD * 2;
	const rowGap = 14;
	const height =
		laid.reduce((sum, row) => sum + row.height, 0) + rowGap * (laid.length - 1) + PAD * 2;

	let index = 0;
	let top = PAD;
	const body: string[] = [];
	for (const row of laid) {
		const left = (width - row.width) / 2;
		for (const { clipping, x } of row.placed) {
			// The papers stand on one line, each a little high or low.
			const y = top + (row.height - clipping.h) + (random(index * 31 + 7)() - 0.5) * 8;
			body.push(clippingMarkup(clipping, index, left + x, y, glyph));
			index += 1;
		}
		top += row.height + rowGap;
	}

	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${round(width)} ${round(height)}" width="${round(width)}" height="${round(height)}">${defs}${body.join('')}</svg>`;
};
