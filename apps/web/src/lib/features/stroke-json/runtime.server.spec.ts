import { describe, expect, it, vi } from 'vitest';
import {
	createServerStrokeJsonRuntime,
	StrokeJsonRuntimeError,
	type StrokeJsonBindings,
	type StrokeJsonRuntimeLoader
} from '@not-the-louvre/stroke-json-runtime/server';
import { toArtworkFlowError } from './runtime.server';

const textEncoder = new TextEncoder();

const createBindings = (): StrokeJsonBindings => ({
	compact_document_losslessly_with_report: vi.fn(),
	decode_canonical_document: vi.fn(),
	decode_editable_document: vi.fn((payload: Uint8Array) => {
		const decoded = Buffer.from(payload).toString('hex');
		return textEncoder.encode(`decoded:${decoded}`);
	}),
	normalize_editable_document: vi.fn(),
	prepare_publish_document: vi.fn(),
	prepare_storage_document: vi.fn((documentJson: Uint8Array) => ({
		canonical_json: textEncoder.encode(`canonical:${new TextDecoder().decode(documentJson)}`),
		compressed_bytes: Uint8Array.from([0, 255, 4, 8]),
		free: vi.fn(),
		height: 768,
		kind: 'artwork',
		stroke_count: 4,
		total_points: 12,
		version: 2,
		width: 768
	})),
	run_prod_like_pipeline: vi.fn(),
	serialize_canonical_document: vi.fn(),
	stroke_json_wasm_version: vi.fn(() => '0.1.0'),
	validate_document: vi.fn(() => ({
		free: vi.fn(),
		height: 768,
		kind: 'artwork',
		stroke_count: 4,
		total_points: 12,
		version: 2,
		width: 768
	}))
});

describe('createServerStrokeJsonRuntime', () => {
	it('keeps UTF-8 and base64 translations inside the wrapper API', async () => {
		const bindings = createBindings();
		const runtime = createServerStrokeJsonRuntime({
			loadBindings: vi.fn(async () => bindings)
		});

		await expect(runtime.decodeEditableDocument('AAECAw==')).resolves.toBe('decoded:00010203');
		await expect(runtime.prepareStorageDocument('{"version":1}')).resolves.toMatchObject({
			canonicalDocumentJson: 'canonical:{"version":1}',
			compressedDocumentBase64: 'AP8ECA==',
			height: 768,
			kind: 'artwork',
			strokeCount: 4,
			totalPoints: 12,
			version: 2,
			width: 768
		});

		expect(bindings.decode_editable_document).toHaveBeenCalledWith(Uint8Array.from([0, 1, 2, 3]));
		expect(bindings.prepare_storage_document).toHaveBeenCalledWith(
			textEncoder.encode('{"version":1}')
		);
	});

	it('memoizes initialization and surfaces init failures without fallback retries', async () => {
		const loadBindings: StrokeJsonRuntimeLoader = vi
			.fn(async () => {
				throw new Error('broken wasm bootstrap');
			})
			.mockName('loadBindings');
		const runtime = createServerStrokeJsonRuntime({ loadBindings });

		await expect(runtime.getVersion()).rejects.toMatchObject({
			code: 'init_failed',
			message: 'broken wasm bootstrap'
		});
		await expect(runtime.validateDocument('{"version":2}')).rejects.toMatchObject({
			code: 'init_failed',
			message: 'broken wasm bootstrap'
		});

		expect(loadBindings).toHaveBeenCalledTimes(1);
	});
});

describe('toArtworkFlowError', () => {
	it('maps invalid runtime validation failures to the stable product contract', () => {
		expect(
			toArtworkFlowError(new StrokeJsonRuntimeError('invalid_document', 'bad document'))
		).toMatchObject({
			code: 'INVALID_DRAWING_DOCUMENT',
			message: 'Invalid drawing document',
			status: 400
		});
	});

	it('maps runtime size-limit failures to the stable product contract', () => {
		expect(
			toArtworkFlowError(new StrokeJsonRuntimeError('document_limits_exceeded', 'too many points'))
		).toMatchObject({
			code: 'DRAWING_DOCUMENT_TOO_LARGE',
			message: 'Drawing document is too large',
			status: 413
		});
	});

	it('maps runtime initialization failures to a stable server error contract', () => {
		expect(
			toArtworkFlowError(new StrokeJsonRuntimeError('init_failed', 'broken wasm bootstrap'))
		).toMatchObject({
			code: 'DRAWING_RUNTIME_FAILED',
			message: 'Drawing runtime failed',
			status: 500
		});
	});
});
