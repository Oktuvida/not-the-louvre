export const drawingPalette = [
	'#2d2420',
	'#d4956c',
	'#8b9d91',
	'#e8b896',
	'#c84f4f',
	'#6b8e7f',
	'#f4c430',
	'#fdfbf7'
];

export const drawingTools = createDrawingTools();

function createDrawingTools() {
	let activeColor = $state(drawingPalette[0]);
	let brushSize = $state(5);

	return {
		get activeColor() {
			return activeColor;
		},
		set activeColor(value: string) {
			activeColor = value;
		},
		get brushSize() {
			return brushSize;
		},
		set brushSize(value: number) {
			brushSize = value;
		}
	};
}
