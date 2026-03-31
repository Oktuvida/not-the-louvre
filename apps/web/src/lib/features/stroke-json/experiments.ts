export type CanvasExportMeasurement<TBlob> = {
	blob: TBlob;
	bytes: number;
	format: string;
};

type BitmapCloneExperimentOptions<TDocument, TCanvas, TBlob, TImage> = {
	buildRenderedCanvas: (document: TDocument) => TCanvas;
	cloneIterations: number;
	countPixelDiff: (baseline: TCanvas, next: TCanvas) => number | null;
	document: TDocument;
	loadImageFromBlob: (blob: TBlob) => Promise<TImage>;
	measureCanvasExport: (canvas: TCanvas) => Promise<CanvasExportMeasurement<TBlob>>;
	rebuildCanvasFromImage: (document: TDocument, image: TImage) => TCanvas;
	snapshotCanvas: (canvas: TCanvas) => string;
};

type JsonCloneExperimentOptions<TDocument, TCanvas, TBlob> = {
	buildRenderedCanvas: (document: TDocument) => TCanvas;
	cloneIterations: number;
	countPixelDiff: (baseline: TCanvas, next: TCanvas) => number | null;
	document: TDocument;
	measureCanvasExport: (canvas: TCanvas) => Promise<CanvasExportMeasurement<TBlob>>;
	parseDocument: (serialized: string) => TDocument;
	serializeDocument: (document: TDocument) => string;
	snapshotCanvas: (canvas: TCanvas) => string;
};

export const runBitmapCloneExperiment = async <TDocument, TCanvas, TBlob, TImage>(
	options: BitmapCloneExperimentOptions<TDocument, TCanvas, TBlob, TImage>
) => {
	const baselineCanvas = options.buildRenderedCanvas(options.document);
	let workingCanvas = options.buildRenderedCanvas(options.document);

	for (let iteration = 0; iteration < options.cloneIterations; iteration += 1) {
		const exportMeasurement = await options.measureCanvasExport(workingCanvas);
		const image = await options.loadImageFromBlob(exportMeasurement.blob);
		workingCanvas = options.rebuildCanvasFromImage(options.document, image);
	}

	const finalExport = await options.measureCanvasExport(workingCanvas);

	return {
		bytes: finalExport.bytes,
		diffPixels: options.countPixelDiff(baselineCanvas, workingCanvas),
		format: finalExport.format,
		previewUrl: options.snapshotCanvas(workingCanvas)
	};
};

export const runJsonCloneExperiment = async <TDocument, TCanvas, TBlob>(
	options: JsonCloneExperimentOptions<TDocument, TCanvas, TBlob>
) => {
	const baselineCanvas = options.buildRenderedCanvas(options.document);
	let nextDocument = options.document;
	let workingCanvas = options.buildRenderedCanvas(nextDocument);

	for (let iteration = 0; iteration < options.cloneIterations; iteration += 1) {
		nextDocument = options.parseDocument(options.serializeDocument(nextDocument));
		workingCanvas = options.buildRenderedCanvas(nextDocument);
	}

	const finalExport = await options.measureCanvasExport(workingCanvas);

	return {
		bytes: finalExport.bytes,
		diffPixels: options.countPixelDiff(baselineCanvas, workingCanvas),
		format: finalExport.format,
		previewUrl: options.snapshotCanvas(workingCanvas)
	};
};
