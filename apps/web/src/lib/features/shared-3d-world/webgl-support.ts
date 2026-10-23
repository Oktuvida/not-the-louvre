/**
 * Whether three.js can render here at all. It needs a WebGL 2 context, which
 * old phones, blocklisted GPUs and browsers with WebGL turned off cannot give.
 * The probe context is released at once: browsers cap how many a page may hold.
 */
export const browserSupportsWebGL = () => {
	const context = document.createElement('canvas').getContext('webgl2');
	context?.getExtension('WEBGL_lose_context')?.loseContext();

	return context !== null;
};
