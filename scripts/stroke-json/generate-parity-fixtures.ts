// Records how the current Rust/WASM runtime reads drawing documents, so the
// TypeScript reader that replaces it can be held to the same answers before the
// Rust is deleted. Run once from the repo root:
//   bun run scripts/stroke-json/generate-parity-fixtures.ts
// Output: apps/web/src/lib/stroke/fixtures/legacy-rust-parity.json
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { serverGeneratedWasmDirectory } from './shared';

type Bindings = {
	initSync: (input: { module: BufferSource }) => unknown;
	stroke_json_wasm_version: () => string;
	validate_document: (json: Uint8Array) => {
		version: number;
		kind: string;
		width: number;
		height: number;
		stroke_count: number;
		total_points: number;
		free?: () => void;
	};
	normalize_editable_document: (json: Uint8Array) => Uint8Array;
	serialize_canonical_document: (json: Uint8Array) => Uint8Array;
	decode_editable_document: (payload: Uint8Array) => Uint8Array;
	decode_canonical_document: (payload: Uint8Array) => Uint8Array;
};

const outputPath = join(process.cwd(), 'apps/web/src/lib/stroke/fixtures/legacy-rust-parity.json');
const bindings = (await import(
	pathToFileURL(join(serverGeneratedWasmDirectory, 'stroke_json_wasm.js')).href
)) as Bindings;
bindings.initSync({
	module: await readFile(join(serverGeneratedWasmDirectory, 'stroke_json_wasm_bg.wasm'))
});

const encoder = new TextEncoder();
const decoder = new TextDecoder();

// Big documents are described, not stored, and rebuilt by the same rule on
// both sides: point i of every stroke is [i mod (width + 1), i mod (height + 1)].
type Generated = { kind: 'artwork' | 'avatar'; strokes: number; pointsPerStroke: number };
export const buildGeneratedDocument = ({ kind, strokes, pointsPerStroke }: Generated) => {
	const [width, height, background] =
		kind === 'artwork' ? [768, 768, '#fdfbf7'] : [340, 340, '#f5f0e1'];
	return JSON.stringify({
		version: 1,
		kind,
		width,
		height,
		background,
		strokes: Array.from({ length: strokes }, () => ({
			color: '#1d3557',
			size: 4,
			points: Array.from({ length: pointsPerStroke }, (_, i) => [i % (width + 1), i % (height + 1)])
		}))
	});
};

const artwork = { kind: 'artwork', width: 768, height: 768, background: '#fdfbf7' };
const avatar = { kind: 'avatar', width: 340, height: 340, background: '#f5f0e1' };
const stroke = (points: number[][], color = '#1d3557', size = 8) => ({ color, size, points });
const v1 = (header: object, strokes: object[]) =>
	JSON.stringify({ version: 1, ...header, strokes });
const v1Basic = v1(artwork, [
	stroke([
		[10, 10],
		[20, 25],
		[30, 40]
	]),
	stroke(
		[
			[100, 100],
			[120, 90]
		],
		'#E63946',
		24
	)
]);
const v2Basic = JSON.stringify({
	version: 2,
	...artwork,
	base: [stroke([[1, 2]], '#264653', 64)],
	tail: [
		stroke([
			[5, 5],
			[6, 7]
		])
	]
});

type DocumentCase = { name: string; json?: string; generated?: Generated };
const documentCases: DocumentCase[] = [
	{ name: 'v1 artwork with two strokes', json: v1Basic },
	{ name: 'v1 avatar', json: v1(avatar, [stroke([[340, 0]], '#000000', 1)]) },
	{ name: 'v2 artwork with base and tail', json: v2Basic },
	{
		name: 'v2 artwork with no strokes',
		json: JSON.stringify({ version: 2, ...artwork, base: [], tail: [] })
	},
	{ name: 'v1 artwork with no strokes', json: v1(artwork, []) },
	{
		name: 'points on the canvas edges, sizes 1 and 64, uppercase hex',
		json: v1(artwork, [
			stroke(
				[
					[0, 0],
					[768, 768]
				],
				'#ABCDEF',
				1
			),
			stroke([[768, 0]], '#abcdef', 64)
		])
	},
	{ name: 'single-point stroke', json: v1(artwork, [stroke([[384, 384]])]) },
	{
		name: 'keys in a different order',
		json: '{"strokes":[{"points":[[1,1]],"size":2,"color":"#123456"}],"background":"#fdfbf7","height":768,"width":768,"kind":"artwork","version":1}'
	},
	{
		name: 'exactly the per-stroke point limit',
		generated: { kind: 'artwork', strokes: 1, pointsPerStroke: 5000 }
	},
	{
		name: 'exactly the total point limit',
		generated: { kind: 'artwork', strokes: 20, pointsPerStroke: 5000 }
	},
	{ name: 'invalid JSON', json: '{not json' },
	{ name: 'missing version', json: JSON.stringify({ ...artwork, strokes: [] }) },
	{ name: 'unsupported version 3', json: JSON.stringify({ version: 3, ...artwork, strokes: [] }) },
	{ name: 'version as a string', json: JSON.stringify({ version: '1', ...artwork, strokes: [] }) },
	{
		name: 'unknown document field',
		json: JSON.stringify({ version: 1, ...artwork, strokes: [], title: 'x' })
	},
	{ name: 'unknown stroke field', json: v1(artwork, [{ ...stroke([[1, 1]]), opacity: 0.5 }]) },
	{ name: 'color with five hex digits', json: v1(artwork, [stroke([[1, 1]], '#12345')]) },
	{ name: 'named color', json: v1(artwork, [stroke([[1, 1]], 'red')]) },
	{ name: 'non-hex color', json: v1(artwork, [stroke([[1, 1]], '#gggggg')]) },
	{ name: 'size 0', json: v1(artwork, [stroke([[1, 1]], '#123456', 0)]) },
	{ name: 'size 65', json: v1(artwork, [stroke([[1, 1]], '#123456', 65)]) },
	{ name: 'fractional size', json: v1(artwork, [stroke([[1, 1]], '#123456', 2.5)]) },
	{ name: 'stroke with no points', json: v1(artwork, [stroke([])]) },
	{ name: 'x beyond the width', json: v1(artwork, [stroke([[769, 1]])]) },
	{ name: 'y beyond the height', json: v1(artwork, [stroke([[1, 769]])]) },
	{ name: 'negative coordinate', json: v1(artwork, [stroke([[-1, 1]])]) },
	{ name: 'fractional coordinate', json: v1(artwork, [stroke([[1.5, 1]])]) },
	{
		name: 'integral float coordinate written as 1.0',
		json: v1Basic.replace('[10,10]', '[10.0,10]')
	},
	{ name: 'point with three coordinates', json: v1(artwork, [stroke([[1, 2, 3]])]) },
	{ name: 'artwork with avatar dimensions', json: v1({ ...artwork, width: 340, height: 340 }, []) },
	{
		name: 'artwork with the wrong background',
		json: v1({ ...artwork, background: '#ffffff' }, [])
	},
	{ name: 'unknown kind', json: v1({ ...artwork, kind: 'sticker' }, []) },
	{ name: 'v2 without tail', json: JSON.stringify({ version: 2, ...artwork, base: [] }) },
	{
		name: 'v2 with v1 strokes field',
		json: JSON.stringify({ version: 2, ...artwork, strokes: [] })
	},
	{
		name: 'duplicate version key',
		json: v1Basic.replace('{"version":1,', '{"version":1,"version":1,')
	},
	{
		name: 'one point over the per-stroke limit',
		generated: { kind: 'artwork', strokes: 1, pointsPerStroke: 5001 }
	},
	{
		name: 'one stroke over the stroke limit',
		generated: { kind: 'artwork', strokes: 5001, pointsPerStroke: 1 }
	},
	{
		name: 'over the total point limit',
		generated: { kind: 'artwork', strokes: 21, pointsPerStroke: 5000 }
	}
];

const toBase64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64');
const concat = (...parts: Uint8Array[]) => Uint8Array.from(Buffer.concat(parts));
const incompressible = Uint8Array.from({ length: 300 * 1024 }, (_, i) => (i * 2654435761) >>> 24);

type PayloadCase = { name: string; bytes: Uint8Array; generated?: string };
const payloadCases: PayloadCase[] = [
	{ name: 'gzip level 6 of a v1 document (Rust and fflate default)', bytes: gzipSync(v1Basic) },
	{ name: 'gzip level 9 of a v1 document', bytes: gzipSync(v1Basic, { level: 9 }) },
	{ name: 'gzip level 1 of a v2 document', bytes: gzipSync(v2Basic, { level: 1 }) },
	{ name: 'plain JSON bytes without gzip', bytes: encoder.encode(v1Basic) },
	{ name: 'truncated gzip', bytes: gzipSync(v1Basic).subarray(0, 20) },
	{ name: 'gzip of an invalid document', bytes: gzipSync(v1(artwork, [stroke([[999, 1]])])) },
	{
		name: 'gzip followed by trailing garbage',
		bytes: concat(gzipSync(v1Basic), encoder.encode('garbage'))
	},
	{ name: 'two concatenated gzip members', bytes: concat(gzipSync(v1Basic), gzipSync(v2Basic)) },
	{
		name: 'compressed payload over 256 KiB',
		bytes: gzipSync(incompressible, { level: 0 }),
		// Rebuilt by the test: gzip level 0 of 300 KiB where byte i = (i * 2654435761) >>> 24.
		generated: 'stored-gzip-of-300KiB-pseudorandom'
	},
	{
		name: 'decompresses past 1 MiB',
		bytes: gzipSync(v1Basic.replace('{"version":1', `{${' '.repeat(1024 * 1024)}"version":1`))
	}
];

type Outcome = { ok: true; value: unknown } | { ok: false; error: string };
const attempt = (run: () => unknown): Outcome => {
	try {
		return { ok: true, value: run() };
	} catch (error) {
		return { ok: false, error: error instanceof Error ? error.message : String(error) };
	}
};
const parseBytes = (bytes: Uint8Array) => JSON.parse(decoder.decode(bytes)) as unknown;
// Generated documents are too big to store, so their exact output bytes are
// pinned by digest instead: the reader must serialize to the same JSON.
const digestBytes = (bytes: Uint8Array) => ({
	bytes: bytes.length,
	sha256: createHash('sha256').update(bytes).digest('hex')
});

const documents = documentCases.map(({ name, json, generated }) => {
	const input = encoder.encode(json ?? buildGeneratedDocument(generated!));
	const read = json === undefined ? digestBytes : parseBytes;
	return {
		name,
		...(json === undefined ? { generated } : { json }),
		validate: attempt(() => {
			const { version, kind, width, height, stroke_count, total_points } =
				bindings.validate_document(input);
			return { version, kind, width, height, strokeCount: stroke_count, totalPoints: total_points };
		}),
		editable: attempt(() => read(bindings.normalize_editable_document(input))),
		canonical: attempt(() => read(bindings.serialize_canonical_document(input)))
	};
});

const payloads = payloadCases.map(({ name, bytes, generated }) => ({
	name,
	...(generated ? { generated } : { base64: toBase64(bytes) }),
	editable: attempt(() => parseBytes(bindings.decode_editable_document(bytes))),
	canonical: attempt(() => parseBytes(bindings.decode_canonical_document(bytes)))
}));

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(
	outputPath,
	`${JSON.stringify(
		{
			about:
				'Answers of the Rust/WASM stroke-json runtime, recorded before its removal. The TypeScript reader must match them.',
			runtimeVersion: bindings.stroke_json_wasm_version(),
			documents,
			payloads
		},
		null,
		'\t'
	)}\n`
);
process.stdout.write(
	`Wrote ${documents.length} document and ${payloads.length} payload cases to ${outputPath}\n`
);
