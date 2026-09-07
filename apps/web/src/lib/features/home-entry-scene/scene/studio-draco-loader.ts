import { browser } from '$app/environment';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

/*
 * The decoder ships from our own origin (static/draco/, copied out of the
 * resolved `three` package at build time). Pointing DRACOLoader at
 * www.gstatic.com added a third-party DNS + TLS handshake at the very END of
 * the home critical path — the decoder is only requested once the 578KB GLB
 * header has been parsed — and made the 3D studio depend on a third party
 * staying up: the GLB declares extensionsRequired KHR_draco_mesh_compression,
 * so every visitor needs it.
 */
const STUDIO_DRACO_DECODER_PATH = '/draco/';

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
