import { createStrokeJsonBrowserRuntime } from '@not-the-louvre/stroke-json-runtime/browser';
import {
	parseEditableDrawingDocumentV2,
	parseDrawingDocumentV2,
	serializeDrawingDocument,
	type DrawingDocument,
	type DrawingDocumentV2
} from './document';

export type RuntimeLosslessCompactionResult = {
	document: DrawingDocumentV2;
	stats: {
		largestSkippedStrokeCoveragePixels: number;
		maxStrokeCoveragePixels: number | null;
		skippedPartialCompactionStrokeCount: number;
	};
};

export type RuntimeProdLikePipelineIterationResult = {
	document: DrawingDocumentV2;
	durationMs: number;
	gzipBytes: number;
	passNumber: number;
	pointCount: number;
	rawBytes: number;
	strokeCount: number;
};

export type RuntimeProdLikePipelineResult = {
	finalDocument: DrawingDocumentV2;
	iterations: RuntimeProdLikePipelineIterationResult[];
	totalDurationMs: number;
};

const browserRuntime = createStrokeJsonBrowserRuntime({
	createWorker: () =>
		new Worker(new URL('./runtime.worker.ts', import.meta.url), { type: 'module' })
});

export const compactDrawingDocumentLosslesslyWithReport = async (
	document: DrawingDocument,
	options: {
		maxStrokeCoveragePixels?: number | null;
	} = {}
): Promise<RuntimeLosslessCompactionResult> => {
	const result = await browserRuntime.compactDocumentLosslesslyWithReport(
		serializeDrawingDocument(document),
		options
	);

	return {
		document: parseDrawingDocumentV2(result.documentJson),
		stats: {
			largestSkippedStrokeCoveragePixels: result.largestSkippedStrokeCoveragePixels,
			maxStrokeCoveragePixels: result.maxStrokeCoveragePixels,
			skippedPartialCompactionStrokeCount: result.skippedPartialCompactionStrokeCount
		}
	};
};

export const decodeCompressedDrawingDocument = (payloadBase64: string) =>
	browserRuntime.decodeEditableDocument(payloadBase64);

export const hydrateEditableDrawingDocument = async (
	document: DrawingDocument | string
): Promise<DrawingDocumentV2> => {
	const documentJson = typeof document === 'string' ? document : serializeDrawingDocument(document);

	return parseEditableDrawingDocumentV2(
		await browserRuntime.normalizeEditableDocument(documentJson)
	);
};

export const prepareDrawingDocumentForPublish = async (
	document: DrawingDocument,
	options: {
		maxStrokeCoveragePixels?: number | null;
		minTailPoints?: number;
		rasterGuardPresetId?: string;
	} = {}
) => {
	const result = await browserRuntime.preparePublishDocument(
		serializeDrawingDocument(document),
		options
	);

	return result.documentJson;
};

export const runProdLikePipeline = async (
	document: DrawingDocument,
	options: {
		iterationCount?: number;
		phase2MaxStrokeCoveragePixels?: number | null;
	} = {}
): Promise<RuntimeProdLikePipelineResult> => {
	const result = await browserRuntime.runProdLikePipeline(
		serializeDrawingDocument(document),
		options
	);

	return {
		finalDocument: parseDrawingDocumentV2(result.finalDocumentJson),
		iterations: result.iterations.map((iteration) => ({
			document: parseDrawingDocumentV2(iteration.documentJson),
			durationMs: iteration.durationMs,
			gzipBytes: iteration.gzipBytes,
			passNumber: iteration.passNumber,
			pointCount: iteration.totalPoints,
			rawBytes: iteration.rawBytes,
			strokeCount: iteration.strokeCount
		})),
		totalDurationMs: result.totalDurationMs
	};
};

export const disposeStrokeJsonBrowserRuntime = () => {
	browserRuntime.dispose();
};
