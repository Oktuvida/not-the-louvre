type FontFaceSetLike = {
	ready: Promise<unknown>;
};

type PageLayoutReadyDependencies = {
	document: {
		fonts?: FontFaceSetLike;
		readyState: DocumentReadyState;
	};
	window: {
		addEventListener: (
			type: 'load',
			listener: EventListenerOrEventListenerObject,
			options?: AddEventListenerOptions
		) => void;
	};
};

const waitForLoadEvent = (windowObject: PageLayoutReadyDependencies['window']) =>
	new Promise<void>((resolve) => {
		windowObject.addEventListener('load', () => resolve(), { once: true });
	});

export const waitForPageLayoutReady = async ({ document, window }: PageLayoutReadyDependencies) => {
	if (document.readyState !== 'complete') {
		await waitForLoadEvent(window);
	}

	try {
		await document.fonts?.ready;
	} catch {
		// Font readiness is best-effort only; layout measurement can proceed without it.
	}
};
