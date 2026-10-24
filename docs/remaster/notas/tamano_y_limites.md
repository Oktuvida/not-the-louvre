# Tamaño de los dibujos y límites: casos extremos

Pregunta del dueño (2026-10-23): ¿está bien pensado el tamaño de los dibujos si alguien dibuja "infinitas capas" una encima de otra?

## Método

Script: `tamano_peor_caso.mjs` (en esta carpeta). Genera dibujos sintéticos llevados justo al límite actual de `apps/web/src/lib/features/stroke-json/document.ts:150-157` (5000 trazos, 100 000 puntos, 5000 puntos por trazo). Para cada uno mide:

- el documento v3 en JSON columnar con deltas (x/y a ¼ px, presión de 10 bits, tiempo en ms), sin comprimir y con gzip-6;
- el tiempo de render con resvg-wasm 2.6.2 (el mismo del repo), en un M5 Pro con Node 24, no en workerd;
- la imagen canónica con `cwebp` nativo: sin pérdida `-m 4`, sin pérdida `-z 9` y `-near_lossless 60`.

La presión y los colores son aleatorios por punto y por trazo, así que los tamaños tiran a pesimistas frente a dibujos reales.

## Resultados

| Caso | Trazos | Puntos | Doc v3 sin comprimir | Doc v3 gzip | Render resvg | WebP sin pérdida (m4 / z9) | Near-lossless 60 |
|---|---:|---:|---:|---:|---:|---:|---:|
| `capas_gruesas`: pinceles de 48–64 px apilados por todo el lienzo | 5000 | 100 000 | 1713 KiB | 428 KiB | 572 ms | 47,4 / 47,0 KiB | 53,8 KiB |
| `ruido_fino`: garabatos de 1–3 px multicolor por todo el lienzo | 5000 | 100 000 | 1641 KiB | 379 KiB | 135 ms | 772,8 / 766,8 KiB | 635,3 KiB |
| `mixto_largo`: trazos largos de 2–32 px | 1000 | 100 000 | 1179 KiB | 291 KiB | 185 ms | 186,1 / 183,9 KiB | 193,5 KiB |
| `referencia`: dibujo cargado normal | 300 | 24 000 | 289 KiB | 72 KiB | 41 ms | 129,7 / 128,6 KiB | 139,7 KiB |

## Lectura

- Apilar capas infla el documento (todo el historial), no la imagen: lo de abajo queda tapado y la imagen pesa 47 KiB.
- Lo que infla la imagen es el detalle fino multicolor: 773 KiB sin pérdida en el peor caso. `-z 9` no ayuda y near-lossless solo baja a 635 KiB, porque el contenido es ruido de alta frecuencia.
- El peor documento (1,7 MiB / 428 KiB) cabe en los topes propuestos por el informe (~2 MiB descomprimido, 512 KiB comprimido).
- El peor render cuesta ~0,6 s de CPU en un M5 Pro; los pinceles gruesos cuestan más que los finos porque rellenan más área.

## Hechos del código verificados (rama `audit/fix-everything`)

- El estudio no comprueba ningún límite mientras se dibuja: `assertDrawingDocumentWithinLimits` solo se usa en la validación, así que el límite se descubre al publicar, cuando el servidor rechaza el documento.
- Un fork copia el documento completo del padre: `StudioDrawingPage.svelte:345-346` (`cloneDrawingDocumentV2(resolvedForkParent.drawingDocument)`).
- El estudio no tiene deshacer ni borrador: `grep -i 'undo|eraser'` sobre `features/studio-drawing` devuelve 0 coincidencias. Los trazos heredados del padre funcionan de hecho como un fondo bloqueado, como describe el README.

## Huecos

- Datos sintéticos; la distribución real de puntos por documento saldrá gratis de la migración de la fase 2, que lee todos los documentos de producción.
- No se midió en workerd ni en móviles.
- No se verificó si resvg-wasm 2.6.2 acepta WebP embebida en `<image>`; componer la imagen del padre y los trazos nuevos fuera de resvg evita la duda.
