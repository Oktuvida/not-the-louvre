import type { ImageContentChecker } from './types';

type NSFWPrediction = {
	className: 'Drawing' | 'Hentai' | 'Neutral' | 'Porn' | 'Sexy';
	probability: number;
};

type NSFWModel = {
	classify(image: HTMLImageElement): Promise<NSFWPrediction[]>;
};

type NSFWModule = typeof import('nsfwjs');
type TFModule = typeof import('@tensorflow/tfjs');

let modelPromise: Promise<NSFWModel> | null = null;

const thresholds = {
	hentai: 0.7,
	porn: 0.7
} as const;

const unavailableMessages = {
	artwork: 'Artwork safety check is unavailable right now. Please try again.',
	avatar: 'Avatar safety check is unavailable right now. Please try again.'
} as const;

const blockedMessages = {
	artwork: 'Artwork contains blocked sexual content.',
	avatar: 'Avatar contains blocked sexual content.'
} as const;

const shouldBypassClientContentFilters = () =>
	typeof window !== 'undefined' && Boolean(window.__ntlBypassClientContentFilters);

const getPredictionProbability = (
	predictions: NSFWPrediction[],
	className: NSFWPrediction['className']
) => predictions.find((prediction) => prediction.className === className)?.probability ?? 0;

const loadImage = async (file: File) => {
	const objectUrl = URL.createObjectURL(file);

	try {
		const image = await new Promise<HTMLImageElement>((resolve, reject) => {
			const nextImage = new Image();
			nextImage.onload = () => resolve(nextImage);
			nextImage.onerror = () => reject(new Error('Image decode failed'));
			nextImage.src = objectUrl;
		});

		return image;
	} finally {
		URL.revokeObjectURL(objectUrl);
	}
};

const createModel = async (): Promise<NSFWModel> => {
	const tf = (await import('@tensorflow/tfjs')) as TFModule;
	tf.enableProdMode();
	await tf.ready();

	const nsfwjs = (await import('nsfwjs')) as NSFWModule;
	return nsfwjs.load();
};

const getModel = async () => {
	if (!modelPromise) {
		modelPromise = createModel().catch((error) => {
			modelPromise = null;
			throw error;
		});
	}

	return modelPromise;
};

export const checkImageContent: ImageContentChecker = async (file, context) => {
	if (shouldBypassClientContentFilters()) {
		return { status: 'allowed' };
	}

	try {
		const [model, image] = await Promise.all([getModel(), loadImage(file)]);
		const predictions = await model.classify(image);
		console.info('[content-filter][nsfwjs]', {
			context,
			fileName: file.name,
			predictions
		});
		const pornProbability = getPredictionProbability(predictions, 'Porn');
		const hentaiProbability = getPredictionProbability(predictions, 'Hentai');

		if (pornProbability > thresholds.porn || hentaiProbability > thresholds.hentai) {
			return {
				message: blockedMessages[context],
				status: 'blocked'
			};
		}

		return { status: 'allowed' };
	} catch {
		return {
			message: unavailableMessages[context],
			status: 'unavailable'
		};
	}
};
