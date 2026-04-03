type MuseumWallWillChangeElements = {
	frameVisualElement: HTMLDivElement;
	overlayElement: HTMLDivElement;
	wallSceneElement: HTMLDivElement;
	wallTextureElement: HTMLDivElement;
};

export const applyMuseumWallWillChange = (
	elements: MuseumWallWillChangeElements,
	active: boolean
) => {
	elements.wallSceneElement.style.willChange = active ? 'transform' : '';
	elements.overlayElement.style.willChange = '';
	elements.wallTextureElement.style.willChange = '';
	elements.frameVisualElement.style.willChange = '';
};
