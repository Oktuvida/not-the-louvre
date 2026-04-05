import type { DrawingDocumentV2 } from './document';

export const PROD_LIKE_PIPELINE_ITERATION_COUNT = 20;

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
