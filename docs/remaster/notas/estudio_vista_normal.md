# Estudio: la vista normal en cada pantalla

Diseño acordado con el dueño el 2026-11-01. El objetivo es el mismo estudio de hoy (la mesa, el cuaderno, los post-its y la caja de materiales), pero bien colocado en cualquier pantalla. El estilo no cambia. El modo de pantalla completa queda para después; sus bocetos están en el lienzo "Estudio — pantalla completa".

Bocetos y capturas de partida: lienzo "Estudio — vista normal" (https://claude.ai/artifact/9NQL3xNsF2e5xGyH8MFXGp).

## Qué falla hoy

Medido con capturas reales del preview local:

| Pantalla                   | Lienzo  | Problema                                                                                  |
| -------------------------- | ------- | ----------------------------------------------------------------------------------------- |
| 1920×1080                  | 786 px  | bien                                                                                      |
| 1512×860                   | 601 px  | la tapa se corta contra el borde y "Exit Studio" pisa el cuaderno                         |
| 1280×720                   | 482 px  | la caja tapa el borde derecho del lienzo                                                  |
| Tablet horizontal 1180×820 | 606 px  | la caja tapa el lienzo; el título y el 18+ no se ven                                      |
| Tablet vertical 820×1180   | 899 px  | el lienzo es más ancho que la pantalla; la caja lo tapa; el título y el 18+ no se ven     |
| Móvil 390×844              | 326×273 | el lienzo no es cuadrado: cada eje se escala por separado y el dibujo publicado se estira |

Las causas:

- **Un solo corte por ancho.** Con 700 px o menos el estudio cambia a la maqueta del móvil. Una tablet se queda con la de escritorio.
- **El cuaderno de escritorio se coloca con números fijos.** `--book-open-offset-x: 30rem` y `--book-open-scale: 1.3` (con otros valores por debajo de 1280 px) solo cuadran en pantallas parecidas a una de 1512 px.
- **En el móvil, el lienzo tiene `max-height: min(70vw, 24rem)` con `width: 100%`.** Eso da un rectángulo, y `pointer-drawing.ts` escala x e y por separado.
- **La caja de materiales**:
  - el grosor es un `range` de 8 px de alto;
  - Clear está pegado a Publish y pesa lo mismo;
  - las etiquetas de los post-its miden 0,68rem (menos de 12 px).
- **El piano** (`AmbientAudioTab`, fijo abajo a la derecha) queda encima de la escena.

## El diseño

### Proporciones fijas, tamaño fluido

No hay ningún tamaño fijo en píxeles:

- El lienzo es siempre 1:1 y mide `min(lo que deja el alto, lo que deja el ancho)`. Ambos valores salen de la ventana (`dvh`, `vw`) menos el resto de piezas.
- El resto de piezas (franja de arriba, post-its, caja, márgenes de la página, lomo) están en `rem`. En el estudio, la fuente raíz escala con la ventana igual que en la galería: `clamp(100%, min(100vw / 94.5, 100dvh / 53.75), 150%)`, que vale 16 px en una pantalla de 1512×860. Al crecer la pantalla todo crece junto y la relación entre piezas se mantiene.
- Los únicos mínimos son físicos: un control nunca baja de 44 px y un texto nunca baja de 12 px. Por eso la fuente raíz no baja del 100 %, y cuando las piezas ya no caben se pasa a otra disposición en vez de encogerlas.
- El documento sigue siendo 768×768 en cualquier pantalla. Un trazo de grosor 8 ocupa la misma proporción del dibujo en un móvil que en un PC. El lienzo se pinta a la densidad de la pantalla, como ya hace hoy.

### Cuatro disposiciones, elegidas por la forma de la ventana

| Disposición       | Cuándo                                                                    | Cómo se ve                                                                                                                                                                                                               |
| ----------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Mesa**          | ventana al menos 8:5 y de al menos 30rem de alto                          | El cuaderno abierto. A la izquierda, la tapa con los post-its (pueden salirse de la pantalla, pero los post-its siempre se ven). Lomo estrecho, página con el lienzo, y la caja a la derecha con Publish y Clear debajo. |
| **Mesa compacta** | resto de ventanas apaisadas (tablet horizontal, 4:3, móvil en horizontal) | De la tapa solo se ve un canto. Post-its, caja y botones van en la columna derecha; si no caben, esa columna se desplaza.                                                                                                |
| **Torre**         | ventana vertical (o casi cuadrada) de al menos 40rem de ancho             | Arriba, los post-its en fila. En medio, la página con un canto de lomo. Abajo, la caja en horizontal: colores en dos filas, y grosor y herramientas en una fila junto a Clear y Publish.                                 |
| **Bolsillo**      | menos de 40rem de ancho                                                   | Lienzo cuadrado a todo el ancho; debajo, la caja compacta (colores en una tira deslizable, grosor y herramientas); luego, el título; al final, el 18+, Clear y Publish.                                                  |

Cuánto mediría el lienzo con estas proporciones:

| Pantalla  | Disposición   | Lienzo aproximado |
| --------- | ------------- | ----------------- |
| 1920×1080 | Mesa          | ~850 px           |
| 1512×860  | Mesa          | ~650 px           |
| 1280×720  | Mesa          | ~530 px           |
| 1180×820  | Mesa compacta | ~630 px           |
| 820×1180  | Torre         | ~660 px           |
| 390×844   | Bolsillo      | ~340 px           |

En la Mesa y la Mesa compacta se mantiene la animación de abrir la tapa. En la Torre y el Bolsillo no hay tapa, igual que hoy en el móvil.

### Reglas que se cumplen siempre (y se prueban)

1. El lienzo es cuadrado, se ve entero dentro de la ventana y nada lo tapa.
2. Nunca hay scroll horizontal.
3. El título, el 18+ y Publish se ven sin hacer scroll. Excepciones: un móvil muy bajo (como el iPhone SE) y un móvil en horizontal, donde se llega a ellos desplazando la página o la columna.
4. La caja nunca queda encima del lienzo.
5. Al girar la pantalla no se pierde nada de lo dibujado.

### La caja y los botones

- **El grosor** sigue siendo una barra deslizante con el mismo aspecto, pero la zona que se puede tocar mide al menos 44 px de alto.
- **Publish y Clear salen de la caja** y forman su propio bloque, que cada disposición coloca en su sitio: debajo de la caja en Mesa, al final de la columna en Mesa compacta, a la derecha de la caja en Torre y al final en Bolsillo.
  - Publish es el botón grande.
  - Clear es pequeño y pide un segundo toque: el primero lo convierte en "Tap again to clear" durante unos segundos, sin abrir ningún diálogo.
- **El aviso de publicado** ("Hung on the wall!") aparece en el bloque de botones.
- **Los textos** de los post-its y de la caja suben a 12 px como mínimo. El rótulo "Studio Supplies" se queda como decoración, oculto a los lectores de pantalla.
- **En el estudio, el piano sube a la franja de arriba**, a la derecha de "Exit Studio", y ya no tapa nada.

## Cómo se construye

- **Una sola maqueta.** Desaparecen el corte de 700 px (`MOBILE_STUDIO_MEDIA_QUERY`, la semilla `initialIsMobile` y el `isMobileRequest` del servidor) y los dos árboles. El lienzo se monta una vez y no se vuelve a montar al girar la pantalla.
- **Toda la geometría vive en `studio-layout.css`**, igual que la de la galería en `gallery-grid.css`. Ahí están las cuatro disposiciones (media queries por proporción y tamaño), las medidas en `rem` y el tamaño del lienzo. Los componentes solo ponen su aspecto. La caja cambia de forma según la disposición desde esa misma hoja.
- **El JavaScript lee lo que resolvió el CSS.** Si la tapa no se muestra (Torre y Bolsillo), el cuaderno cuenta como abierto desde el principio. No hay ninguna media query duplicada en TypeScript.
- **Los post-its son una pieza propia de la maqueta.** En la Mesa se colocan encima de la tapa abierta y aparecen cuando termina de abrirse; en las otras disposiciones van donde toca.

## Pruebas

- **`studio-layout.e2e.ts`**: en 1920×1080, 1512×860, 1280×720, 1180×820, 1024×768, 820×1180, 390×844, 375×667 y 844×390, con un artista con sesión y el cuaderno abierto, comprueba las cinco reglas:
  - un lienzo cuadrado dentro de la ventana;
  - `elementFromPoint` sobre una rejilla de puntos del lienzo solo devuelve el lienzo;
  - sin scroll horizontal;
  - el título, el 18+ y Publish dentro de la ventana, salvo las excepciones;
  - la caja sin cruzarse con el lienzo;
  - un trazo que sobrevive a un giro.

  También que el lienzo ocupe al menos una fracción de la ventana: 70 % del alto en Mesa, 75 % del ancho en Torre y 85 % del ancho en Bolsillo.

- **`accessibility.e2e.ts`** añade el estudio abierto a las superficies del artista (axe y el mínimo de 12 px).
- **Specs de componente**:
  - la barra de grosor se puede agarrar (al menos 44 px de alto);
  - un toque en Clear no borra y el segundo sí.
- **Los specs que fijaban el corte de 700 px** se sustituyen por los e2e de arriba, que miden la página de verdad.

## Fuera de alcance

- El modo de pantalla completa.
- El sello del avatar que tapa la esquina del lienzo en el editor de avatar (`AvatarSketchpad`, otro componente).
- Los modos de juego. La columna de los post-its es el hueco natural para la consigna cuando lleguen.
- La pasada de assets.
