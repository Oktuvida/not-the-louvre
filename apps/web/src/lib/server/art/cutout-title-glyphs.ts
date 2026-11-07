import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import opentype from 'opentype.js';
import type {
	CutoutFont,
	GlyphSource
} from '#lib/features/home-entry-scene/canvas/cutout-title.js';

/*
 * The fonts the cut-out title is lettered in, read from their @fontsource
 * packages at generation time. Only the static-art generator and its spec use
 * this: the title ships as paths, so none of these files reaches a visitor.
 */

const FONT_FILES: Record<CutoutFont, string> = {
	abril: '@fontsource/abril-fatface/files/abril-fatface-latin-400-normal.woff',
	'alfa-slab': '@fontsource/alfa-slab-one/files/alfa-slab-one-latin-400-normal.woff',
	anton: '@fontsource/anton/files/anton-latin-400-normal.woff',
	'archivo-black': '@fontsource/archivo-black/files/archivo-black-latin-400-normal.woff',
	'fredoka-bold': '@fontsource/fredoka/files/fredoka-latin-700-normal.woff',
	'playfair-black': '@fontsource/playfair-display/files/playfair-display-latin-900-normal.woff',
	'playfair-black-italic':
		'@fontsource/playfair-display/files/playfair-display-latin-900-italic.woff'
};

export const loadCutoutGlyphs = (): GlyphSource => {
	const require = createRequire(import.meta.url);
	const fonts = new Map<CutoutFont, opentype.Font>();

	const fontFor = (font: CutoutFont) => {
		let parsed = fonts.get(font);
		if (!parsed) {
			const bytes = readFileSync(require.resolve(FONT_FILES[font]));
			parsed = opentype.parse(
				bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
			);
			fonts.set(font, parsed);
		}
		return parsed;
	};

	return (font, char, size) => {
		const path = fontFor(font).getPath(char, 0, 0, size);
		const { x1, y1, x2, y2 } = path.getBoundingBox();
		return { d: path.toPathData(2), x1, x2, y1, y2 };
	};
};
