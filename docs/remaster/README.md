# Remaster de Not The Louvre

Plan vivo del remaster. El detalle técnico, con fuentes, está en [informe-stack.md](informe-stack.md), y la investigación de cada frente en [notas/](notas/).

## Visión

- Un backend muy bien hecho y optimizado, para que el frontend pueda jugar sin miedo.
- Entrar a la galería se siente tan fluido como Pinterest.
- Dibujar en el móvil es un placer: con el dedo, con Apple Pencil en iPad y con S Pen en Galaxy.
- Cada obra tiene un timelapse de cómo se dibujó.
- Modos de juego: cadáver exquisito, replicar un dibujo y dibujar a partir de una consigna.
- Por fases, y muy limpio.

## Restricciones

- Seguimos en la cuenta actual de Cloudflare, con un presupuesto modesto.
- Se migran todos los datos de producción: usuarios, obras, linaje de forks, votos y comentarios.
- Nunca se degrada visiblemente la calidad de imagen, y no se sirven variantes de menos de 768 px.
- Abrir el detalle de una obra no usa un morph de elemento compartido.
- Las restricciones de la hackathon (tier gratuito, self-host desde el primer día) ya no aplican.

## Cómo trabajamos

- Todo el trabajo va en la rama `remaster`. Se publica a `main` cuando el dueño decida que está donde quiere.
- Mientras tanto, producción sigue saliendo de `main`. Un arreglo urgente de producción se hace en una rama desde `main`, se publica allí y se trae a `remaster`.
- Un PR en borrador de `remaster` a `main` ejecuta CI en cada push sin desplegar. **Nunca se lanza el workflow a mano desde `remaster`**: ese camino sí despliega a producción.
- Cada paso es un commit propio, con `format`, `lint`, `check` y `test` en verde.
- El día del corte, documentos e imágenes se migran a R2 con las publicaciones congeladas unos minutos. La migración se ensaya antes con una copia de los datos.

## Diagnóstico

**Se conserva:** el modelo de datos y las migraciones, los contadores mantenidos por triggers, la moderación (reportes, auto-ocultado, NSFW, bans), Better Auth con nickname y clave de recuperación, el formato de dibujo v1/v2 como entrada, los primitivos de papel y stickers con sus tokens, y los tests e2e y de contrato SQL.

**Se quita o se reemplaza:**

| Hoy | Por qué sobra | Reemplazo |
|---|---|---|
| Codec Rust/WASM y compactación de trazos | gzip y validación ya existen en la plataforma y en TS; la compactación destruye el historial | Paquete TS `stroke` con `CompressionStream` |
| Escalera AVIF 4:2:0 en el Worker | Degrada visiblemente los trazos de color | Una WebP sin pérdida de 768 px renderizada con resvg |
| Documentos en base64 dentro de Postgres, escritos en trozos | Workaround del pooler de Supabase | Objetos inmutables en R2 |
| Supabase Storage y Realtime | Realtime solo avisa "vuelve a cargar" | R2, polling y Durable Objects para las salas |
| Drizzle con postgres.js y `prepare: false` sobre Hyperdrive | Cloudflare lo declara no soportado | `pg` con `drizzle-orm/node-postgres` |
| Capas service/repository probadas con fakes que reimplementan el SQL | El SQL real no se probaba en CI | Módulos por feature probados contra Postgres |
| openspec, devenv, `.opencode`, tests que hacen grep del CSS | Ceremonia sin retorno | Nada |

## Fases

### 0. Red de seguridad y ruta de datos

- [x] Arreglar el upsert de rate limit, roto en producción desde el 8 de septiembre (`35a5e17`). Para producción está listo en `hotfix/rate-limit-upsert`.
- [x] Plan e informe dentro del repo.
- [x] Suite de contrato SQL en CI contra Postgres (job `database`).
- [x] Tests e2e en CI, excepto los `@realtime`, que necesitan Supabase Realtime y desaparecen en la fase 2.
- [ ] Sacar de cuarentena los 6 e2e marcados con `test.fixme`: 3 de compactación (se reescriben en la fase 1), 2 de buffering del lienzo (fase 4) y el de la sala misteriosa (bug de interfaz, abajo).
- [ ] Bug: sin WebGL no se puede entrar. La escena 3D de la home lanza un error y "Come In" nunca abre el panel de login. Comprobado en producción con Chromium headless. El login no puede depender de la escena.
- [ ] Bug: en el detalle, a 1280×720, el pie de la postal tapa el botón "Send comment".
- [ ] Driver `pg` y dos configuraciones de Hyperdrive, con y sin caché. *Requiere acceso a Cloudflare.*
- [ ] Conexión directa a Supabase por IPv4. *Requiere acceso a Supabase.*
- [ ] Better Auth 1.7, rate limit en base de datos y un e2e de petición abortada.

### 1. Plataforma y poda

- [ ] Documentos de referencia generados con el Rust actual, para probar la paridad del lector nuevo.
- [ ] Paquete TS `stroke` con lector v1/v2 y validación; quitar Rust/WASM y la compactación.
- [ ] Quitar tooling vestigial, `POST /api/artworks` y los tests que hacen grep del código.
- [ ] SvelteKit 3.1, Svelte 5.57, adapter-cloudflare 8, Vite 8, TypeScript 6, Vitest 5 y Wrangler 4.118 o superior.

### 2. Datos y medios en R2

- [ ] Worker `renderer`: resvg y WebP sin pérdida, renderizando directamente al tamaño final.
- [ ] Documentos en R2 con clave sha256; la fila de Postgres se escribe al final como marca de commit.
- [ ] Script de migración: documentos byte a byte (omitiendo las escrituras rotas), AVIF copiados con sus claves y backfill a WebP por cola.
- [ ] Dominio de medios con Tiered Cache, avatares con claves versionadas y polling en lugar de Supabase Realtime.
- [ ] Medir la CPU real de render en Workers y la distribución real de puntos por documento.

### 3. Galería fluida

- [ ] Rejilla cuadrada con marcador crema, primera fila prioritaria, virtualización y store normalizado.
- [ ] Precarga desde la home y al tocar, restauración del scroll y feed cacheado en el edge.
- [ ] Permalink `/artwork/[id]` con tarjeta OG, sin morph.
- [ ] Contar cuántas obras superan ~300 KB y decidir la política para esas imágenes.

### 4. Estudio v3 y timelapse

- [ ] Entrada con eventos coalescidos y predichos, presión real solo de lápiz, modo lápiz y gestos de Procreate.
- [ ] Capas seca y húmeda, lienzo según el DPR, zoom y pan, deshacer y borrador.
- [ ] Barra de tinta, filtro de captura de ¼ px y forks por referencia a la imagen del padre.
- [ ] Escritor v3 (JSON columnar con deltas), pinceles versionados y golden images entre cliente y servidor.
- [ ] Reproductor de timelapse y exportación a vídeo. Pruebas en iPad y Galaxy reales.

### 5. Modos de juego

- [ ] Worker `realtime`: un Durable Object por sala, con hibernación, alarmas y tickets de acceso firmados.
- [ ] Invitados con el plugin anonymous de Better Auth.
- [ ] Modos, en orden: consigna, réplica y cadáver exquisito.

### 6. Cierre

- [ ] Verificar los hashes migrados y borrar las columnas viejas.
- [ ] `compose.yaml` solo con Postgres.
- [ ] Opcional: mover la base de datos a PlanetScale.

## Decisiones abiertas

- **Imágenes muy pesadas.** Aceptarlas y medir (recomendado) o servir una versión casi sin pérdida en la rejilla. Se decide en la fase 3.
- **Forks por referencia.** Cambian la regla del PRD de que un fork nunca depende de su padre. Se decide en la fase 4.
- **Obras ocultas.** Desde `4bb1735` (30 de marzo), ni moderadores ni autores pueden abrir el detalle de una obra oculta. ¿Fue intencional? Mientras tanto, la suite de contrato describe el comportamiento actual.
- **Producción.** Votar y comentar fallan en producción hasta que se publique `hotfix/rate-limit-upsert`.

## Prerrequisitos pendientes

- Acceso a la cuenta de Cloudflare para Workers, Hyperdrive, R2 y logs.
- Plan y acceso del proyecto de Supabase, para el complemento de IPv4.
- Confirmar si la migración 0016 y el backfill de placeholders están aplicados en producción.
- Dispositivos de prueba: un iPad con Pencil y un Galaxy con S Pen.
