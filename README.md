# StoryGraph → Goodreads · Conversor CSV

Aplicación web (Angular 21, sin dependencias adicionales) para migrar tu biblioteca
de StoryGraph a Goodreads sin usar la línea de comandos. Todo el procesado ocurre
en el navegador: ningún archivo se sube a ningún servidor.

## Funciones

- **Convertir** — Transforma una exportación de StoryGraph al formato de importación
  de Goodreads: estanterías, fechas, valoraciones, ISBN y reseñas. Opcionalmente
  divide el resultado en archivos más pequeños.
- **Comparar** — Encuentra los libros de un archivo que no están en tu biblioteca
  existente, comparando por ISBN o título+autor. Útil para evitar duplicados.
- **Dividir** — Trocea un CSV grande en partes de tamaño fijo o por estado de
  lectura (read, to-read, currently-reading…).
- **Por año** — Crea un archivo por cada año de la biblioteca, o exporta solo los
  libros de un año concreto. Un libro cuenta para un año si alguna de sus fechas
  (añadido, leído o última lectura) cae en ese año.

## Uso

```sh
npm install
npm start
```

Abre <http://localhost:4200>, elige la pestaña que necesites, carga tu CSV
exportado desde StoryGraph y descarga el resultado. Después impórtalo en
<https://www.goodreads.com/review/import>.

## Compilar para producción

```sh
npm run build
```

El resultado queda en `dist/storygraph-converter/` y puede servirse desde cualquier
hosting estático (GitHub Pages, Netlify…) al no necesitar backend.

## Estructura

- `src/app/csv.ts` — parser y serializador CSV (RFC 4180).
- `src/app/conversion.ts` — lógica de conversión, comparación y división.
- `src/app/app.ts` / `app.html` / `app.css` — interfaz con pestañas.
