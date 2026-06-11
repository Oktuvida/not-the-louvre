export const drawingPalette = [
	'#FFFFFF', // Blanco
	'#C8C8C8', // Gris claro
	'#636363', // Gris oscuro
	'#1A1A1A', // Negro
	'#2563EB', // Azul
	'#38BDF8', // Celeste
	
	'#FDBCB4', // Durazno
	'#EC4899', // Fucsia
	'#ed7ad2', // Rosa
	'#9f71e8', // Lila
	'#7C3AED', // Morado
	'#1E3A5F', // Marino

	'#F47C20', // Naranja
	'#e8b306', // Amarillo oscuro
	'#F5D200', // Amarillo
	'#84CC16', // Lima
	'#27A844', // Verde
	'#0D9488', // Teal

	'#E63030', // Rojo
	'#7E1212', // Rojo oscuro
	'#6B4A2E', // Marrón
	'#b8925e', // Marrón claro
	'#DCC9A3', // Piel pálida
	'#E5DECA' // Beige 
];

export const brushSizeSteps = [1, 2, 4, 6, 8, 10, 12, 14, 18, 24, 32, 38, 45, 54, 64];

export const drawingTools = createDrawingTools();

function createDrawingTools() {
	let activeColor = $state(drawingPalette[3]);
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
