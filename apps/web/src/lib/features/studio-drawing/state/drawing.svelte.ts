export const drawingPalette = [
	'#F4EBDD',
	'#DCC9A3',
	'#B78C5A',
	'#6B4A2E',
	'#2B2622',
	'#C79A2B',
	'#A5562A',
	'#C96A4A',
	'#B9322E',
	'#B97A74',
	'#2F4B9A',
	'#2E6F7E',
	'#667A3E',
	'#8FA27A',
	'#2D7A63',
	'#8C7AAE',
	'#5E3A57',
	'#A9862A'
];

export const brushSizeSteps = [1, 2, 4, 6, 8, 10, 12, 14, 18, 24, 32, 42];

export const drawingTools = createDrawingTools();

function createDrawingTools() {
	let activeColor = $state(drawingPalette[4]);
	let brushSizeIndex = $state(3);

	return {
		get activeColor() {
			return activeColor;
		},
		set activeColor(value: string) {
			activeColor = value;
		},
		get brushSize() {
			return brushSizeSteps[brushSizeIndex];
		},
		get brushSizeIndex() {
			return brushSizeIndex;
		},
		set brushSizeIndex(value: number) {
			brushSizeIndex = Math.max(0, Math.min(brushSizeSteps.length - 1, value));
		}
	};
}
