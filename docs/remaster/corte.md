# El corte a producción

El guion para pasar `remaster` a producción. Lo ejecuta el dueño en su propia terminal: las contraseñas y las claves nunca pasan por el chat.

Ensayado el 2026-11-06 y el 2026-11-07 sobre una copia real de producción, sin tocarla: migraciones, redibujado, remaster sobre esos datos y el código actual de `main` sobre la base ya migrada. Falta lo que solo se puede probar de verdad: copiar las imágenes reales y desplegar en Cloudflare.

## Qué se espera

- **Base:** de la 0016 a la 0022, sin perder filas. Son aditivas salvo las tablas espejo de Supabase Realtime, que `main` solo usa para las actualizaciones en vivo.
- **Web actual tras migrar:** sigue funcionando. Registro, galería y reportes pasaron igual antes y después de migrar.
- **Votar y comentar en `main`:** fallan con o sin migraciones (`blocked_until is ambiguous`), rotos desde el 8 de septiembre. Los arregla el remaster.
- **Redibujado:** 48 de 49 obras a WebP sin pérdida (media 23 KiB, máximo 82 KiB) y los 37 avatares, en unos 6 s.
- **"Smile":** su documento está truncado en producción. Conserva su AVIF y no tiene timelapse. El corte acaba con código de salida 1 y `invalidDocuments: 1` por ella. Es lo esperado.

## Antes del día

1. Pasar el CI en un pull request en borrador de `remaster` a `main`. Un borrador no despliega.
2. Crear el token de R2: R2 object storage → Overview → API Tokens → Manage → Create User API token, con Object Read & Write solo sobre `not-the-louvre`.
3. Copiar la clave `service_role` del proyecto de Supabase.
4. Crear `~/ntl-backups/corte.env` con permisos 600 y el host que aparece en Hyperdrive. Si la contraseña lleva símbolos, va codificada para URL.

   ```sh
   DATABASE_URL='postgres://postgres:<contraseña>@<host>:5432/postgres?sslmode=no-verify'
   SUPABASE_URL='https://<proyecto>.supabase.co'
   SUPABASE_SERVICE_KEY='<service_role>'
   R2_ACCOUNT_ID='<cuenta>'
   R2_ACCESS_KEY_ID='<access key>'
   R2_SECRET_ACCESS_KEY='<secret>'
   ```

`apps/web/.env` apunta a otra base. Las variables exportadas mandan sobre ese archivo, así que todo lo que sigue va en una terminal que ya cargó `corte.env`.

## El día

Abre la terminal y comprueba que apunta a producción. Esto solo lee y debe responder 49 o más:

```sh
cd apps/web
set -a; source ~/ntl-backups/corte.env; set +a
bun -e "import pg from 'pg'; const c = new pg.Client({ connectionString: process.env.DATABASE_URL }); await c.connect(); console.log((await c.query('select count(*) from app.artworks')).rows[0]); await c.end()"
```

1. **Copia fresca.** La contraseña se escribe cuando la pide.

   ```sh
   PGSSLMODE=require /opt/homebrew/opt/postgresql@17/bin/pg_dump -h <host> -p 5432 -U postgres -d postgres -n app -n better_auth -n drizzle -Fc --no-owner --no-privileges -f ~/ntl-backups/prod-dia-del-corte.dump
   ```

2. **Migrar.**

   ```sh
   bun run db:migrate
   ```

3. **Copiar a R2**, con `main` todavía en marcha. Paras si `failures` o `missingImages` no están vacíos. `invalidDocuments` debe ser solo "Smile".

   ```sh
   bun run cutover --copy-only
   ```

4. **Desplegar.** Fusiona el pull request. El flujo pasa los tests y sube, por este orden, el Worker de tiempo real, el renderer y la web.
5. **Comprobar.** Galería, imágenes, entrar, votar, comentar, publicar un dibujo y ver su timelapse. Hasta aquí se puede volver atrás.
6. **Redibujar.** Este paso no tiene vuelta atrás sencilla. Copia también lo que `main` escribió entretanto.

   ```sh
   bun run cutover
   ```

7. **Comprobar otra vez** las imágenes y una obra antigua con su timelapse.

## Si algo va mal

- **Antes del paso 6:** Cloudflare → Workers → `not-the-louvre` → Deployments → volver a la versión anterior. El código de `main` funciona sobre la base migrada, y las migraciones se quedan.
- **Después del paso 6:** no vuelvas atrás, porque `main` no sabe leer las claves nuevas. Se arregla hacia delante.
- **La copia del paso 1** es el último recurso: restaurarla pierde lo escrito desde entonces.

## Después

- Bajar `not-the-louvre-deployment` de Workers Admin a Editor.
- Borrar el token de R2 y `corte.env`.
- Borrar las copias de `~/ntl-backups` y la base local `ntl_rehearsal` cuando el corte lleve unos días estable: tienen datos reales de usuarios.
- Medir la CPU real del render y la latencia de la base desde Cloudflare.
