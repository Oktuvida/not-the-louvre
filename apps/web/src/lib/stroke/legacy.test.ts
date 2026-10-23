import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import fixtures from './fixtures/legacy-rust-parity.json';
import {
	decodeLegacyPayload,
	legacyDocumentMetadata,
	parseLegacyDocument,
	StrokeDocumentError,
	toCanonicalV2,
	toEditableV2
} from './legacy';

/*
 * The fixtures are the answers of the Rust/WASM runtime that stored every
 * drawing until the remaster (scripts/stroke-json/generate-parity-fixtures.ts).
 * Production holds those documents, so the TypeScript reader has to read them
 * exactly as Rust did before the Rust can go.
 */

type Outcome = { ok: true; value: unknown } | { ok: false; error: string };
type Generated = { kind: 'artwork' | 'avatar'; strokes: number; pointsPerStroke: number };

// Rust reports a message; the reader reports a code.
const rustErrorCode = (message: string) =>
	message === 'Invalid drawing document JSON'
		? 'INVALID_JSON'
		: message.startsWith('Failed to decompress')
			? 'DECOMPRESSION_FAILED'
			: message.includes('exceeds max')
				? 'LIMITS_EXCEEDED'
				: 'INVALID_DOCUMENT';

// Inputs only a hand-written payload can contain: stored documents always came
// from a JSON serializer and a single-member gzip encoder. On these the reader
// may accept what Rust rejected or reject what Rust accepted, but it must never
// return a document Rust would have read differently.
const ACCEPTED_DIVERGENCES: Record<string, 'accepts' | 'rejects'> = {
	// JSON.parse cannot tell `10.0` from `10`, nor see a repeated key.
	'integral float coordinate written as 1.0': 'accepts',
	'duplicate version key': 'accepts',
	// DecompressionStream refuses trailing data instead of ignoring it, and does
	// not stop after the first gzip member the way flate2's GzDecoder does.
	'gzip followed by trailing garbage': 'rejects',
	'two concatenated gzip members': 'rejects'
};

// Same rule as the fixture generator: point i is [i mod (width+1), i mod (height+1)].
const buildGeneratedDocument = ({ kind, strokes, pointsPerStroke }: Generated) => {
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

const buildGeneratedPayload = (name: string) => {
	if (name !== 'stored-gzip-of-300KiB-pseudorandom') throw new Error(`Unknown payload ${name}`);
	const bytes = Uint8Array.from({ length: 300 * 1024 }, (_, i) => (i * 2654435761) >>> 24);
	return Uint8Array.from(gzipSync(bytes, { level: 0 }));
};

const sha256 = (text: string) => ({
	bytes: Buffer.byteLength(text),
	sha256: createHash('sha256').update(text).digest('hex')
});

const capture = async (run: () => unknown | Promise<unknown>) => {
	try {
		return { ok: true as const, value: await run() };
	} catch (error) {
		if (error instanceof StrokeDocumentError) return { ok: false as const, code: error.code };
		throw error;
	}
};

// Compares one reader outcome with one Rust outcome; `digest` marks outputs
// the fixture pins by hash of their exact JSON instead of by value.
const expectSameOutcome = (
	actual: Awaited<ReturnType<typeof capture>>,
	expected: Outcome,
	digest: boolean
) => {
	if (!expected.ok) {
		expect(actual).toEqual({ ok: false, code: rustErrorCode(expected.error) });
		return;
	}
	expect(actual.ok).toBe(true);
	if (!actual.ok) return;
	if (digest) {
		expect(sha256(JSON.stringify(actual.value))).toEqual(expected.value);
	} else {
		expect(JSON.stringify(actual.value)).toBe(JSON.stringify(expected.value));
	}
};

const expectAcceptedDivergence = (
	actual: Awaited<ReturnType<typeof capture>>,
	expected: Outcome,
	divergence: 'accepts' | 'rejects'
) => {
	expect(actual.ok).toBe(divergence === 'accepts');
	if (actual.ok && expected.ok) {
		expect(JSON.stringify(actual.value)).toBe(JSON.stringify(expected.value));
	}
};

describe('legacy drawing documents read exactly as the Rust runtime read them', () => {
	for (const fixture of fixtures.documents) {
		const json = fixture.json ?? buildGeneratedDocument(fixture.generated as Generated);
		const digest = fixture.json === undefined;

		it(fixture.name, async () => {
			const validate = await capture(() => legacyDocumentMetadata(parseLegacyDocument(json)));
			const editable = await capture(() => toEditableV2(parseLegacyDocument(json)));
			const canonical = await capture(() => toCanonicalV2(parseLegacyDocument(json)));

			const divergence = ACCEPTED_DIVERGENCES[fixture.name];
			if (divergence) {
				expectAcceptedDivergence(editable, fixture.editable as Outcome, divergence);
				return;
			}
			expectSameOutcome(validate, fixture.validate as Outcome, false);
			expectSameOutcome(editable, fixture.editable as Outcome, digest);
			expectSameOutcome(canonical, fixture.canonical as Outcome, digest);
		});
	}
});

describe('stored payloads decompress exactly as the Rust runtime decompressed them', () => {
	for (const fixture of fixtures.payloads) {
		const bytes =
			'base64' in fixture
				? Uint8Array.from(Buffer.from(fixture.base64 as string, 'base64'))
				: buildGeneratedPayload(fixture.generated as string);

		it(fixture.name, async () => {
			const editable = await capture(async () =>
				toEditableV2(parseLegacyDocument(await decodeLegacyPayload(bytes)))
			);
			const canonical = await capture(async () =>
				toCanonicalV2(parseLegacyDocument(await decodeLegacyPayload(bytes)))
			);

			const divergence = ACCEPTED_DIVERGENCES[fixture.name];
			if (divergence) {
				expectAcceptedDivergence(editable, fixture.editable as Outcome, divergence);
				return;
			}
			expectSameOutcome(editable, fixture.editable as Outcome, false);
			expectSameOutcome(canonical, fixture.canonical as Outcome, false);
		});
	}
});
