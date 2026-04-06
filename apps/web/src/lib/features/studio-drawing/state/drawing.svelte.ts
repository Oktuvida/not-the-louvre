export const drawingPalette = [
	'#FFFFFF', // Blanco (borrador)
	'#C8C8C8', // Gris claro
	'#636363', // Gris oscuro
	'#1A1A1A', // Negro
	'#FDBCB4', // Piel
	'#7B4F2E', // Marrón
	'#E63030', // Rojo
	'#F47C20', // Naranja
	'#F5D200', // Amarillo
	'#27A844', // Verde
	'#2563EB', // Azul
	'#7C3AED', // Morado
	'#EC4899', // Rosa
	'#C026D3', // Magenta
	'#0D9488', // Teal
	'#38BDF8', // Celeste
	'#84CC16', // Lima
	'#1E3A5F' // Marino
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
