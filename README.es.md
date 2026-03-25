# 🖼️ Not The Louvre (No es el Louvre)

*[Read in English 🇬🇧](./README.md)*

> "Mucho marco para tan poco dibujo."

Bienvenido a la institución artística más estirada de internet: un sitio donde todo va de museo nacional y luego entras a la sala principal y te encuentras un gato torcido, dibujado con ratón y peor pulso que criterio.

**Not The Louvre** es un juego social de dibujo hecho para la [Hackathon Cubepath 2026 de midudev](https://github.com/midudev/hackaton-cubepath-2026). Aquí vienes a dibujar, publicar, hacerle `fork` a la obra ajena y juzgarla con una seriedad que no se merece, todo desde el navegador.

---

## 🧐 Vale, pero ¿qué es exactamente?

Piénsalo como un museo que se cree el Prado, pero cuelga cosas que en otra vida habrían acabado pegadas con un imán en la nevera.

Abres la app, haces un dibujo regulero en menos de un minuto, lo publicas y dejas que la gente decida si has tenido un momento de inspiración o si eso pedía tomate virtual desde el primer trazo.

### ✨ Funciones de alto standing, en teoría

- 🖌️ **Una herramienta de dibujo sin ínfulas**: Hay pincel, goma y unos pocos colores. Ya. No hay capas, no hay formas, no hay bote de pintura. Si tu obra dependía de eso, a lo mejor el problema venía de antes.
- 🍴 **Forkear, o copiar con pedigrí**: Si ves algo aprovechable, le haces `fork`, lo dejas como fondo bloqueado y le añades el bigote reglamentario. La trazabilidad queda ahí para que luego se sepa quién tuvo la idea y quién la remató.
- 🎩 **Una puesta en escena 2.5D absurdamente elegante**: Esto va con **Threlte**. La interfaz brilla, se mueve y se da una importancia tremenda. Tu dibujo sigue siendo un PNG plano. Precisamente por eso tiene gracia.
- 🍅 **Crítica popular con verdura incluida**: Puedes aplaudir lo que te parece brillante y castigar lo que clama al cielo. Y sí, si le das caña, cae un tomate en pantalla. Nos parecía de justicia.
- 🛡️ **Un portero con IA**: NSFWJS revisa en cliente si estás intentando subir algo que obligaría a clausurar el museo antes de la hora del vermú. Intentarlo, puedes. Publicarlo, no.

## 🛠️ La tecnología detrás del numerito

Porque hasta las bromas necesitan infraestructura:
- **Frontend:** SvelteKit.
- **3D / Gráficos:** Threlte + HTML5 Canvas 2D API.
- **Backend / Base de datos:** Supabase.
- **Tiempo real:** Supabase Realtime.
- **Moderación:** NSFWJS en el navegador.

## 📦 Estructura del repositorio

Ahora el repo usa un workspace pequeño de Bun para que la raíz quede centrada en documentación e infraestructura compartida.

```text
.
├── apps/
│   └── web/        # App SvelteKit
├── docs/           # Documentación de producto y proyecto
├── compose.yaml    # Postgres local
└── package.json    # Scripts del workspace
```

- Puedes seguir ejecutando la app desde la raíz con `bun run dev`, `bun run check`, `bun run build`, etc.
- La configuración específica de la app vive ahora en `apps/web`.
- Los archivos de entorno de la app pasan a estar en `apps/web/.env` y `apps/web/.env.example`.

## 📜 La idea

La idea era que cualquiera pudiera pasar de "abro el navegador" a "acabo de subir esta cosa lamentable" en un par de minutos. Sin registros eternos, sin tutoriales plomizos, sin muros de pago disfrazados de experiencia premium. Entras, dibujas, te ríes, juzgas y a otra cosa.

---
*Hecho con ❤️ y más cafeína de la estrictamente recomendable para Cubepath 2026.*
