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

| Hoy                                                                  | Por qué sobra                                                                                | Reemplazo                                                                     |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Codec Rust/WASM y compactación de trazos                             | gzip y validación ya existen en la plataforma y en TS; la compactación destruye el historial | Paquete TS `stroke` con `CompressionStream`                                   |
| Escalera AVIF 4:2:0 en el Worker                                     | Degrada visiblemente los trazos de color                                                     | Una WebP sin pérdida de 768 px renderizada con resvg                          |
| Documentos en base64 dentro de Postgres, escritos en trozos          | Workaround del pooler de Supabase                                                            | Objetos inmutables en R2                                                      |
| Supabase Storage y Realtime                                          | Realtime solo avisa "vuelve a cargar"                                                        | R2, polling y Durable Objects para las salas                                  |
| Drizzle con postgres.js y `prepare: false` sobre Hyperdrive          | Cloudflare lo declara no soportado                                                           | `pg` con `drizzle-orm/node-postgres`                                          |
| Capas service/repository probadas con fakes que reimplementan el SQL | El SQL real no se probaba en CI                                                              | Módulos por feature probados contra Postgres                                  |
| openspec, devenv, tests que hacen grep del CSS                       | Ceremonia sin retorno                                                                        | Se conservan marcados como obsoletos; los tests de CSS caen con su componente |

## Fases

### 0. Red de seguridad y ruta de datos

- [x] Arreglar el upsert de rate limit, roto en producción desde el 8 de septiembre (`35a5e17`). Para producción está listo en `hotfix/rate-limit-upsert`.
- [x] Plan e informe dentro del repo.
- [x] Suite de contrato SQL en CI contra Postgres (job `database`).
- [x] Tests e2e en CI, todos: el de tiempo real dejó de necesitar Supabase en la fase 2.
- [x] Cuarentena de e2e: los 3 de compactación se sustituyeron por tests de recorrido (se publica cada trazo dibujado; el borrador sobrevive a una recarga) y el de la sala misteriosa era un test desactualizado (los comentarios están en el reverso de la postal). Quedan 2 de buffering del lienzo, que se reescriben en la fase 4.
- [x] Bug: sin WebGL no se podía entrar; la escena 3D vive ahora dentro de un `<svelte:boundary>` (`be8a92d`).
- [x] Driver `pg` con `drizzle-orm/node-postgres`: un `Client` por petición en Workers, sin `end()`, y un pool en Node. Probado en workerd con `wrangler dev` y Hyperdrive emulado.
- [ ] Dos configuraciones de Hyperdrive, con y sin caché, y elegir la correcta por petición. **Bloquea el corte:** con `pg` la caché de Hyperdrive (60 s, sin invalidar al escribir) empieza a aplicar. _Requiere acceso a Cloudflare._
- [x] Los reintentos de `chunked-write.ts` y de la publicación, que detectaban códigos de postgres.js y con `pg` quedaban inertes, se fueron con los documentos a R2 (fase 2).
- [ ] Conexión directa a Supabase por IPv4. _Requiere acceso a Supabase._
- [x] Better Auth 1.7.12 (`a480b83`), sin migración de datos: desde la 1.7.3 la tabla `account` es la misma que en la 1.6. La 1.4.22 de producción carga `node:async_hooks` con una importación dinámica dentro de la primera petición; en Workers, si esa petición se cancela, el isolate deja de responder a todo lo que pase por Better Auth (issue upstream #10315). La 1.7.12 usa `process.getBuiltinModule`, síncrono en workerd, y no tiene ese fallo.
- [x] Bug de seguridad: la IP de los rate limits salía del primer valor de `X-Forwarded-For`, que escribe el cliente; con un valor inventado por petición se saltaban el bloqueo de login, el de recuperación y los límites de votos, comentarios y reportes. Ahora sale de `CF-Connecting-IP` (`538abae`).
- [x] Bug de seguridad: `/api/auth/*` exponía la API HTTP entera de Better Auth, que la app no usa; con ella una cuenta bloqueada entraba igual y se podían crear usuarios sin perfil. Ya no se monta (`d653ad5`). Como el bloqueo propio cubre el login, el rate limit de Better Auth no hace falta.

### 1. Plataforma y poda

- [x] Documentos de referencia generados con el Rust actual: 48 casos en `apps/web/src/lib/stroke/fixtures` (`1689f4f`).
- [x] Lector y escritor TS de v1/v2 en `apps/web/src/lib/stroke`, con paridad frente al Rust; Rust/WASM y compactación eliminados. El paquete compartido `stroke` se extrae en la fase 2, cuando lo necesite el Worker de render.
- [x] Quitar `POST /api/artworks`: la API de obras queda de solo lectura.
- [x] Las obras solo se publican desde sus trazos: la acción de `/draw` aceptaba también una imagen subida sin documento, así que cualquiera podía publicar una foto sin trazos (sin fork ni timelapse posibles). Con ella se fueron la demo de subida y la sanitización de imágenes subidas.
- [x] Documentación y tooling históricos (`openspec/`, `docs/superpowers/`, `docs/PRD.md`, `devenv`) se conservan, marcados como obsoletos. No se borran: no hacen daño.
- Los tests que leen el código como texto (`*.source.test.ts`, `css-hygiene`, `check-scoped-keyframes`) protegen el CSS frágil actual: cada uno se elimina cuando se reescribe su componente (fases 3 y 4), sustituido por una prueba de interacción o de captura.
- [x] SvelteKit 3.1, Svelte 5.57, adapter-cloudflare 8, Vite 8, TypeScript 6.0, Vitest 5, Wrangler 4.152 y Playwright 1.64. TypeScript 7 queda fuera hasta que Kit y typescript-eslint lo admitan.
- [x] Los bindings de Cloudflare (Hyperdrive, Cache API, `waitUntil`) se leen solo desde `#lib/server/platform.ts` sobre `cloudflare:workers`; `event.platform` ya no existe.
- [x] Los e2e corren el Worker real en workerd con `wrangler dev`, sobre el Postgres local, en lugar de `vite preview` con Node.

### 2. Datos y medios en R2

- [x] Obras en WebP sin pérdida a 768 px: lo guardado es el render canónico de los trazos, píxel a píxel, y el límite de 100 KB pasa a ser una protección de 1 MiB. Con los ajustes por defecto de libwebp (esfuerzo 75, método 4) cuesta 34–107 ms de CPU en WASM; la escalera AVIF a la que sustituye perdía calidad. Las obras ya publicadas siguen en AVIF hasta la migración.
- [x] Avatares en WebP sin pérdida con clave por contenido (`avatars/<id>/<hash>.webp`): la URL lleva la versión y se cachea como inmutable, así que un avatar nuevo se ve al instante en todas partes sin purgar cachés. El codificador AVIF (3,4 MB de WASM) sale del Worker; el decodificador se queda para los avatares antiguos.
- [x] Imágenes en el bucket R2 de la app (binding `BUCKET`) con las mismas claves que en Supabase Storage. `wrangler dev` y las pruebas lo emulan en local, así que la e2e ya no necesita el almacén en memoria exclusivo de Playwright, y las suites de integración de imágenes y avatares corren en CI solo con Postgres.
- [ ] Worker `renderer` aparte, para sacar los códecs WASM del Worker principal.
- [x] Documentos en R2 (`documents/<sha256>.json.gz`): primero se guardan el dibujo y la imagen, y la fila se escribe al final en una sola sentencia que los nombra, así que ya no hay dibujos a medias ni escrituras troceadas, y Supavisor nunca recibe un documento entero. Las filas anteriores siguen leyéndose de la columna base64 hasta la migración (migración `0017`: columnas `drawing_document_key` y `avatar_document_key`).
- [x] Script de migración (`bun run cutover` en `apps/web`, lógica en `src/lib/server/cutover/cutover.ts`): copia las imágenes de Supabase Storage a R2 con sus claves, pasa los dibujos en línea a `documents/<sha256>.json.gz` (las escrituras rotas se informan y se quedan), redibuja como WebP sin pérdida las obras y avatares que conservan su dibujo, y rellena el placeholder de las AVIF que se quedan. Solo añade, es reanudable y una segunda pasada no repite nada. La lógica está probada contra Postgres y R2 emulado; el cableado con Supabase y la API S3 de R2 solo se puede probar en el corte.
- [x] Tiempo real con Durable Objects en lugar de Supabase Realtime: el Worker `apps/realtime` tiene un `ArtworkTopic` por obra con WebSockets hibernados, el Worker web le reenvía la conexión desde `/api/artworks/[id]/live` (con la misma comprobación de visibilidad que la imagen) y cada voto, comentario o moderación de comentarios le avisa. Funciona también sin sesión, y la e2e de tiempo real corre ya en CI. De momento el aviso hace recargar el detalle, como antes; enviar los datos directamente llega con la galería nueva (fase 3).
- [x] Supabase Realtime retirado: cliente `@supabase/supabase-js`, endpoint de tokens y firma de JWT, demo `artwork-realtime-votes`, tablas espejo con sus triggers, funciones y políticas (migraciones `0018` y `0019`) y sus variables de entorno. De Supabase solo queda Postgres; el entorno se reduce a `ORIGIN`, `BETTER_AUTH_SECRET` y `DATABASE_URL`.
- [ ] Dominio de medios con Tiered Cache.
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
- [x] `compose.yaml` solo con Postgres (`postgres:17-alpine`, como CI, en el puerto 55432); se fueron `supabase/volumes` y `.env.supabase.example`.
- [ ] Opcional: mover la base de datos a PlanetScale.

## Decisiones abiertas

- **Imágenes muy pesadas.** Aceptarlas y medir (recomendado) o servir una versión casi sin pérdida en la rejilla. Se decide en la fase 3.
- **Forks por referencia.** Cambian la regla del PRD de que un fork nunca depende de su padre. Se decide en la fase 4.
- **Obras ocultas.** Desde `4bb1735` (30 de marzo), ni moderadores ni autores pueden abrir el detalle de una obra oculta. ¿Fue intencional? Mientras tanto, la suite de contrato describe el comportamiento actual.
- **Producción.** Votar y comentar fallan en producción hasta que se publique `hotfix/rate-limit-upsert`.

## Prerrequisitos pendientes

- Acceso a la cuenta de Cloudflare para Workers, Hyperdrive, R2 y logs.
- El corte, en orden: crear el bucket R2 `not-the-louvre` y un token de API de R2 con escritura; aplicar las migraciones pendientes; `bun run cutover --copy-only` con main todavía en marcha; desplegar `remaster` (primero sube el Worker de tiempo real); `bun run cutover` para copiar lo que main escribió entretanto y redibujar. Variables: ver la cabecera de `apps/web/scripts/cutover.ts`.
- Plan y acceso del proyecto de Supabase, para el complemento de IPv4.
- Confirmar si la migración 0016 y el backfill de placeholders están aplicados en producción.
- Dispositivos de prueba: un iPad con Pencil y un Galaxy con S Pen.
