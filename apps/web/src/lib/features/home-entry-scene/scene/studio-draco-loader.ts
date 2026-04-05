import { browser } from '$app/environment';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

const STUDIO_DRACO_DECODER_PATH = 'https://www.gstatic.com/draco/versioned/decoders/1.4.3/';

let studioDracoLoader: DRACOLoader | null = null;

export const shouldUseJsDracoDecoder = ({
	browser,
	dev,
	userAgent
}: {
	browser: boolean;
	dev: boolean;
	userAgent: string;
}) => browser && dev && /firefox/i.test(userAgent);

export const getStudioDracoLoader = () => {
	if (studioDracoLoader) {
		return studioDracoLoader;
	}

	const loader = new DRACOLoader().setDecoderPath(STUDIO_DRACO_DECODER_PATH);

	if (
		shouldUseJsDracoDecoder({
			browser,
			dev: import.meta.env.DEV,
			userAgent: browser ? window.navigator.userAgent : ''
		})
	) {
		loader.setDecoderConfig({ type: 'js' });
	}

	studioDracoLoader = loader;
	return loader;
};

export const resetStudioDracoLoader = () => {
	studioDracoLoader = null;
};
