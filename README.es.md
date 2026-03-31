<p align="center">
  <img width="420" src="./assets/images/logo.svg" alt="Not The Louvre logo">
</p>


*[Read in English 🇬🇧](./README.md)*

> "Mucho marco para tan poco dibujo."

Se bienvenido a la institución artística con mas clase de internet: un sitio donde todo va de museo de elite y luego entras a la sala principal y te encuentras un gato torcido, dibujado con ratón y peor pulso que criterio.

**Not The Louvre** es un juego social de dibujo hecho para la [Hackathon Cubepath 2026 de midudev](https://github.com/midudev/hackaton-cubepath-2026). Aquí vienes a dibujar, publicar, hacerle `fork` a la obra ajena y juzgarla con una seriedad que no se merece, todo desde el navegador.

---

## 🧐 Vale, pero ¿qué es exactamente?

Piénsalo como un museo que se cree el Prado, pero cuelga cosas que en otra vida habrían acabado pegadas con un imán en la nevera.

Abres la app, haces un dibujo regulero en menos de un minuto, lo publicas y dejas que la gente decida si has tenido un momento de inspiración o si eso pedía que le lanzaran tomates desde el primer trazo.

## ✨ Por qué parece cool (Features & Tech)

- 🖌️ **Una herramienta de dibujo deslumbrante**: Hay pincel y unos pocos colores. Ya. No hay capas, no hay formas, no hay bote de pintura. Si tu obra dependía de eso, a lo mejor el problema venía de antes.
- 🍴 **Forkear**: Si ves algo aprovechable, le haces `fork`, lo dejas como fondo bloqueado y le añades el bigote reglamentario. La trazabilidad queda ahí para que luego se sepa quién tuvo la idea y quién la "mejoró".
- 🎩 **Navegación 3D + Canvas 2D (Threlte)**: Usamos Threlte para que la navegación por las rutas de la app parezca interactuar orgánicamente con un modelo 3D del estudio. Pero a la hora de dibujar, usamos la API clásica de Canvas 2D para máxima fluidez.
- 🍅 **Loop Social en Tiempo Real**: Votos y comentarios que se actualizan en vivo sin recargar la página, gracias a Supabase Realtime.
- 🧠 **Mapas JSON sin pérdida de calidad (Lossless)**: Para permitir forks infinitos sin que la imagen acabe pixelada, la fuente de la verdad no es un PNG. Guardamos un documento JSON versionado y comprimido con los trazos matemáticos. Al hacer un fork, clonas la data, no los píxeles.
- 🛡️ **Moderación y la inevitable métrica "TTP"**: En cualquier app pública de dibujo, el *Time To Penis (TTP)* tiende irremediablemente a cero. Para gestionarlo, creamos un sistema de moderación real desde el día uno: los creadores marcan contenido NSFW (que se oculta bajo un filtro +18) y los admins tienen atajos rápidos para censurar el caos inaceptable.
- 📦 **Infraestructura Reproducible y Self-Hostable**

## 📦 Estructura del repositorio

Ahora el repo usa un workspace pequeño de Bun para que la raíz quede centrada en documentación e infraestructura compartida.

```text
.
├── apps/
│   └── web/        # App SvelteKit
├── docs/           # Documentación de producto y proyecto
├── compose.yaml    # Stack local de Supabase
├── .env.supabase.example
└── package.json    # Scripts del workspace
```

- Levanta el stack local de Supabase con `bun run db:start` y detenlo con `bun run db:stop`.
- La primera vez, `bun run db:start` copia `.env.supabase.example` a `.env.supabase` si todavía no lo personalizaste.
- Puedes seguir ejecutando la app desde la raíz con `bun run dev`, `bun run check`, `bun run build`, etc.
- La configuración específica de la app vive ahora en `apps/web`.
- Los archivos de entorno de la app pasan a estar en `apps/web/.env` y `apps/web/.env.example`.

## 📜 La idea

La idea era que cualquiera pudiera pasar de "abro el navegador" a "acabo de subir esta cosa lamentable" en un par de minutos. Sin registros eternos, sin tutoriales aburridos, sin muros de pago disfrazados de experiencia premium. Entras, dibujas, te ríes, juzgas y a otra cosa.

---
*Hecho con ❤️ y más cafeína de la estrictamente recomendable para Cubepath 2026.*
