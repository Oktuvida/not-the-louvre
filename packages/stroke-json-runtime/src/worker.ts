import {
	createDirectStrokeJsonBrowserRuntime,
	registerStrokeJsonWorker,
	type StrokeJsonRuntime,
	type StrokeJsonWorkerScope
} from './browser';

export const startStrokeJsonWorker = (
	scope: StrokeJsonWorkerScope = self as unknown as StrokeJsonWorkerScope,
	runtime: StrokeJsonRuntime = createDirectStrokeJsonBrowserRuntime()
) => {
	registerStrokeJsonWorker(scope, runtime);
	return runtime;
};

export { registerStrokeJsonWorker };
export type { StrokeJsonRuntime, StrokeJsonWorkerScope };