# Desarrollo

[English](DEVELOPMENT.md) · **Español**

Cómo ejecutar, compilar y desplegar [StoryGraph → Goodreads](README.es.md) por tu cuenta.

## Ejecutarla en local

Requisitos: [Node.js](https://nodejs.org) 20.19+ (o 22.12+) y npm.

```sh
git clone https://github.com/rinsdoc/storygraph_to_goodreads.git
cd storygraph_to_goodreads
npm install
npm start
```

Después abre <http://localhost:4200>.

## Scripts

| Comando | Descripción |
| --- | --- |
| `npm start` | Servidor de desarrollo con recarga en caliente en `localhost:4200` |
| `npm run build` | Build de producción en `dist/storygraph-converter/browser/` |
| `npm run watch` | Build de desarrollo en modo watch |

## Estructura del proyecto

```
src/
├── app/
│   ├── app.ts            # Componente raíz: estado del flujo, tema e idioma (signals)
│   ├── app.html          # Portada y flujo por pasos (solo claves de traducción)
│   ├── app.css           # Estilos del componente
│   ├── app.config.ts     # Providers de la aplicación (ngx-translate)
│   ├── conversion.ts     # Lógica de conversión, comparación y división
│   ├── csv.ts            # Parser y serializador CSV (RFC 4180)
│   └── i18n/             # Traducciones (es.json, en.json)
├── styles.css            # Paleta (light-dark), fuentes y estilos globales
└── index.html
docs/screenshots/         # Imágenes de estos README
.github/workflows/        # Despliegue en GitHub Pages
```

La lógica de conversión es TypeScript puro sin dependencias de Angular. Se portó de los scripts Python originales (`storygraph_to_goodreads.py`, `compare_csv.py`, `split.py`, `year_splitter.py`) y es fácil de testear o reutilizar.

## Traducciones

La interfaz usa [`@ngx-translate/core`](https://github.com/ngx-translate/core) con claves de traducción y el pipe `translate`. Las traducciones son archivos JSON en `src/app/i18n/` que se empaquetan en la build: sin http-loader ni peticiones en tiempo de ejecución. Para añadir un idioma, crea su JSON, regístralo en `TRANSLATIONS` y en `initialLang` (`app.ts`) y añade su botón al selector de idioma de `app.html`.

## Despliegue

[`deploy.yml`](.github/workflows/deploy.yml) compila la app y la publica en GitHub Pages en cada push a `main`; también se puede lanzar a mano desde la pestaña *Actions*. La ruta base sale del nombre del repositorio, así que en un fork basta con activar Pages con *GitHub Actions* como origen en *Settings → Pages*.

## Tecnologías

- [Angular 21](https://angular.dev): componentes standalone, signals y el control de flujo integrado (`@if`, `@for`, `@switch`).
- [@ngx-translate/core](https://github.com/ngx-translate/core) para las traducciones.
- [Fontsource](https://fontsource.org) para incluir Young Serif y Kalam en la app.
- CSS moderno sin frameworks: `light-dark()`, `color-mix()`, máscaras, animaciones ligadas al scroll y consultas de contenedor `scroll-state`. Los navegadores sin estas novedades ven el mismo diseño sin esas animaciones.
