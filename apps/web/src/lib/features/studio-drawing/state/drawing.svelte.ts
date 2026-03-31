export const drawingPalette = [
	'#1a1a1a', // Negro
	'#808080', // Gris
	'#d4d4d4', // Blanco
	'#e63946', // Rojo
	'#2176d9', // Azul
	'#ffd500', // Amarillo
	'#2dba4e', // Verde
	'#f4841a', // Naranja
	'#9b30c8', // Morado
	'#4fc3f7', // Azul claro
	'#1a3a6b', // Marino
	'#26c6a0', // Turquesa
	'#f5cba7', // Piel
	'#c87941', // Café
	'#6b3a1f', // Marrón
	'#f06292', // Rosa
	'#a8e063', // Verde lima
	'#fff9c4' // Crema
];

export const brushSizeSteps = [1, 2, 4, 6, 8, 10, 12, 14, 18, 24, 32, 38, 45, 54, 64];

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
