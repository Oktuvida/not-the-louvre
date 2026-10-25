// Worst-case drawings at the current limits (5k strokes, 100k points):
// document size (v3 columnar delta JSON + gzip) and canonical image size (resvg -> lossless WebP).
// Run from the repo root after `bun install`, with `cwebp` on PATH:
//   node docs/remaster/notas/tamano_peor_caso.mjs <output-dir>
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

// resvg-wasm is a dependency of apps/web, so resolve it from there. Only the
// .wasm subpath is exported, so the ESM entry is located next to it.
const requireFromWeb = createRequire(new URL('../../../apps/web/package.json', import.meta.url));
const resvgWasmPath = requireFromWeb.resolve('@resvg/resvg-wasm/index_bg.wasm');
const { initWasm, Resvg } = await import(
	pathToFileURL(join(dirname(resvgWasmPath), 'index.mjs')).href
);

const out = process.argv[2];
let seed = 7;
const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
const palette = [
	'#1b1b1b',
	'#e63946',
	'#f4a261',
	'#2a9d8f',
	'#264653',
	'#e9c46a',
	'#8338ec',
	'#3a86ff',
	'#ff006e',
	'#06d6a0',
	'#8d5524',
	'#ffffff'
];

// step = px per sample (240 Hz pen ~ 1-3 px), sizes = brush widths to pick from
const makeDoc = ({ strokes, pts, step, sizes }) => {
	const s = [];
	for (let i = 0; i < strokes; i++) {
		let x = rnd() * 768,
			y = rnd() * 768,
			a = rnd() * Math.PI * 2,
			t = 0;
		const points = [];
		for (let k = 0; k < pts; k++) {
			a += (rnd() - 0.5) * 0.6;
			x = Math.min(768, Math.max(0, x + Math.cos(a) * step));
			y = Math.min(768, Math.max(0, y + Math.sin(a) * step));
			t += 4;
			points.push([x, y, 0.3 + 0.6 * rnd(), t]);
		}
		s.push({
			color: palette[Math.floor(rnd() * palette.length)],
			size: sizes[Math.floor(rnd() * sizes.length)],
			points
		});
	}
	return s;
};

const deltas = (vals) => vals.map((v, i) => (i === 0 ? v : v - vals[i - 1]));
const v3Gzip = (strokes) => {
	const doc = {
		version: 3,
		kind: 'artwork',
		width: 768,
		height: 768,
		background: '#fdfbf7',
		xyScale: 4,
		pressureMax: 1023,
		brushes: ['ink@1'],
		strokes: strokes.map((st, i) => ({
			brush: 0,
			color: st.color,
			size: st.size,
			pointer: 'pen',
			start: i * 300,
			x: deltas(st.points.map((p) => Math.round(p[0] * 4))),
			y: deltas(st.points.map((p) => Math.round(p[1] * 4))),
			t: deltas(st.points.map((p) => p[3])),
			p: deltas(st.points.map((p) => Math.round(p[2] * 1023)))
		}))
	};
	const json = JSON.stringify(doc);
	return { raw: json.length, gz: gzipSync(json, { level: 6 }).length };
};

const toSvg = (strokes) =>
	[
		'<svg xmlns="http://www.w3.org/2000/svg" width="768" height="768" viewBox="0 0 768 768">',
		'<rect width="100%" height="100%" fill="#fdfbf7" />',
		...strokes.map(
			(st) =>
				`<polyline points="${st.points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ')}" fill="none" stroke="${st.color}" stroke-width="${st.size}" stroke-linecap="round" stroke-linejoin="round" />`
		),
		'</svg>'
	].join('');

await initWasm(readFileSync(resvgWasmPath));

const scenarios = {
	// someone piling thick layers over the whole canvas until the limit
	capas_gruesas: { strokes: 5000, pts: 20, step: 12, sizes: [48, 64] },
	// thin multicoloured scribbles everywhere: high-frequency detail, worst for the image
	ruido_fino: { strokes: 5000, pts: 20, step: 3, sizes: [1, 2, 3] },
	// mixed brushes, long strokes
	mixto_largo: { strokes: 1000, pts: 100, step: 2, sizes: [2, 4, 8, 16, 32] },
	// a realistic busy drawing for reference (~24k points)
	referencia: { strokes: 300, pts: 80, step: 2, sizes: [2, 4, 8, 16] }
};

for (const [name, cfg] of Object.entries(scenarios)) {
	const strokes = makeDoc(cfg);
	const points = strokes.reduce((n, s) => n + s.points.length, 0);
	const doc = v3Gzip(strokes);
	const svg = toSvg(strokes);
	const a = performance.now();
	const r = new Resvg(svg, { fitTo: { mode: 'original' } });
	const img = r.render();
	const renderMs = performance.now() - a;
	writeFileSync(`${out}/${name}.png`, img.asPng());
	img.free();
	r.free();
	const webp = (args, file) => {
		execFileSync('cwebp', [...args, '-quiet', `${out}/${name}.png`, '-o', `${out}/${file}`]);
		return readFileSync(`${out}/${file}`).length;
	};
	const lossless = webp(['-lossless', '-m', '4'], `${name}.webp`);
	const losslessMax = webp(['-lossless', '-z', '9'], `${name}.z9.webp`);
	const nearLossless = webp(['-lossless', '-near_lossless', '60', '-m', '4'], `${name}.nl60.webp`);
	const kb = (n) => (n / 1024).toFixed(1);
	console.log(
		`${name}: strokes=${strokes.length} points=${points} | doc v3 raw=${kb(doc.raw)}KiB gzip=${kb(doc.gz)}KiB | render=${renderMs.toFixed(0)}ms | webp lossless m4=${kb(lossless)}KiB z9=${kb(losslessMax)}KiB near-lossless60=${kb(nearLossless)}KiB`
	);
}
