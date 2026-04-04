import { gzipSync } from 'fflate';
import {
	countDrawingPoints,
	getRenderableDrawingStrokes,
	normalizeDrawingDocumentToV2,
	serializeCanonicalDrawingDocument,
	type DrawingDocument,
	type DrawingDocumentV2
} from './document';
import { compactDocumentWithClipper2 } from './phase2';
import { simplifyDocumentWithSimplifyJs } from './simplification';

export const PROD_LIKE_PIPELINE_ITERATION_COUNT = 20;
export const PROD_LIKE_PHASE1_ALGORITHM_ID = 'simplify-js' as const;
export const PROD_LIKE_PHASE1_SIMPLIFY_TOLERANCE = 0.5;
export const PROD_LIKE_PHASE1_HIGH_QUALITY = true;
export const PROD_LIKE_PHASE2_ENGINE_ID = 'clipper2-ts' as const;

type ProdLikePhase1Runner = (document: DrawingDocumentV2) => DrawingDocumentV2;
type ProdLikePhase2Runner = (document: DrawingDocumentV2) => Promise<DrawingDocumentV2>;

type ProdLikePassMeasurement = {
	durationMs: number;
	result: DrawingDocumentV2;
};

type ProdLikeDurationMeasurer = (
	run: () => Promise<DrawingDocumentV2>
) => Promise<ProdLikePassMeasurement>;

export type ProdLikePipelineIterationResult = {
	document: DrawingDocumentV2;
	durationMs: number;
	gzipBytes: number;
	passNumber: number;
	pointCount: number;
	rawBytes: number;
	strokeCount: number;
};

export type ProdLikePipelineResult = {
	baselineDocument: DrawingDocumentV2;
	finalDocument: DrawingDocumentV2;
	iterations: ProdLikePipelineIterationResult[];
	totalDurationMs: number;
};

export type ProdLikePipelineOptions = {
	iterationCount?: number;
	measurePassDuration?: ProdLikeDurationMeasurer;
	phase2MaxStrokeCoveragePixels?: number | null;
	runPhase1?: ProdLikePhase1Runner;
	runPhase2?: ProdLikePhase2Runner;
};

const textEncoder = new TextEncoder();

const measurePassDuration: ProdLikeDurationMeasurer = async (run) => {
	const startedAt = globalThis.performance?.now() ?? Date.now();
	const result = await run();
	const finishedAt = globalThis.performance?.now() ?? Date.now();

	return {
		durationMs: Number((finishedAt - startedAt).toFixed(2)),
		result
	};
};

const getResolvedIterationCount = (value?: number) => {
	if (value === undefined) {
		return PROD_LIKE_PIPELINE_ITERATION_COUNT;
	}

	return Math.max(1, Math.floor(value));
};

const getSerializedDocumentMetrics = (document: DrawingDocumentV2) => {
	const serializedDocument = serializeCanonicalDrawingDocument(document);
	const rawBytes = textEncoder.encode(serializedDocument).byteLength;

	return {
		gzipBytes: gzipSync(textEncoder.encode(serializedDocument)).byteLength,
		rawBytes
	};
};

const runProdLikePhase1: ProdLikePhase1Runner = (document) =>
	simplifyDocumentWithSimplifyJs(document, {
		simplifyJsHighQuality: PROD_LIKE_PHASE1_HIGH_QUALITY,
		simplifyJsTolerance: PROD_LIKE_PHASE1_SIMPLIFY_TOLERANCE
	});

const createProdLikePhase2Runner =
	(maxStrokeCoveragePixels?: number | null): ProdLikePhase2Runner =>
	(document) =>
		compactDocumentWithClipper2(document, { maxStrokeCoveragePixels });

export const runProdLikePipeline = async (
	document: DrawingDocument,
	options: ProdLikePipelineOptions = {}
): Promise<ProdLikePipelineResult> => {
	const baselineDocument = normalizeDrawingDocumentToV2(document);
	const iterationCount = getResolvedIterationCount(options.iterationCount);
	const measureDuration = options.measurePassDuration ?? measurePassDuration;
	const runPhase1 = options.runPhase1 ?? runProdLikePhase1;
	const runPhase2 =
		options.runPhase2 ?? createProdLikePhase2Runner(options.phase2MaxStrokeCoveragePixels);
	const iterations: ProdLikePipelineIterationResult[] = [];
	let currentDocument = baselineDocument;

	for (let iterationIndex = 0; iterationIndex < iterationCount; iterationIndex += 1) {
		const passNumber = iterationIndex + 1;

		try {
			const { durationMs, result } = await measureDuration(async () => {
				const phase1Document = runPhase1(currentDocument);
				return runPhase2(phase1Document);
			});
			const { gzipBytes, rawBytes } = getSerializedDocumentMetrics(result);

			currentDocument = result;
			iterations.push({
				document: result,
				durationMs,
				gzipBytes,
				passNumber,
				pointCount: countDrawingPoints(result),
				rawBytes,
				strokeCount: getRenderableDrawingStrokes(result).length
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown prod-like pipeline error';
			throw new Error(`Prod-like pipeline failed at pass ${passNumber}: ${message}`, {
				cause: error
			});
		}
	}

	return {
		baselineDocument,
		finalDocument: currentDocument,
		iterations,
		totalDurationMs: Number(
			iterations.reduce((total, iteration) => total + iteration.durationMs, 0).toFixed(2)
		)
	};
};
