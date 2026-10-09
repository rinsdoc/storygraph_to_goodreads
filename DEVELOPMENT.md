# Development

**English** · [Español](DEVELOPMENT.es.md)

How to run, build and deploy [StoryGraph → Goodreads](README.md) yourself.

## Run it locally

Requirements: [Node.js](https://nodejs.org) 20.19+ (or 22.12+) and npm.

```sh
git clone https://github.com/rinsdoc/storygraph_to_goodreads.git
cd storygraph_to_goodreads
npm install
npm start
```

Then open <http://localhost:4200>.

## Scripts

| Command | Description |
| --- | --- |
| `npm start` | Development server with live reload at `localhost:4200` |
| `npm run build` | Production build into `dist/storygraph-converter/browser/` |
| `npm run watch` | Development build in watch mode |

## Project structure

```
src/
├── app/
│   ├── app.ts            # Root component: flow state, theme and language (signals)
│   ├── app.html          # Home index and step-by-step flow (translation keys only)
│   ├── app.css           # Component styles
│   ├── app.config.ts     # Application providers (ngx-translate)
│   ├── conversion.ts     # Conversion, comparison and splitting logic
│   ├── csv.ts            # RFC 4180 CSV parser and serializer
│   └── i18n/             # Translations (es.json, en.json)
├── styles.css            # Palette (light-dark), fonts and global styles
└── index.html
docs/screenshots/         # Images used in these READMEs
.github/workflows/        # GitHub Pages deployment
```

The conversion logic is plain TypeScript with no Angular dependencies. It was ported from the original Python scripts (`storygraph_to_goodreads.py`, `compare_csv.py`, `split.py`, `year_splitter.py`) and is easy to test or reuse.

## Translations

The UI uses [`@ngx-translate/core`](https://github.com/ngx-translate/core) with translation keys and the `translate` pipe. Translations are plain JSON files in `src/app/i18n/`, bundled at build time: no HTTP loader and no requests at runtime. To add a language, add its JSON file, register it in `TRANSLATIONS` and `initialLang` in `app.ts`, and add its button to the language switcher in `app.html`.

## Deployment

[`deploy.yml`](.github/workflows/deploy.yml) builds the app and publishes it on GitHub Pages on every push to `main`; it can also be run by hand from the *Actions* tab. The base path comes from the repository name, so a fork only needs to enable Pages with *GitHub Actions* as the source in *Settings → Pages*.

## Tech stack

- [Angular 21](https://angular.dev): standalone components, signals and the built-in control flow (`@if`, `@for`, `@switch`).
- [@ngx-translate/core](https://github.com/ngx-translate/core) for translations.
- [Fontsource](https://fontsource.org) to bundle Young Serif and Kalam with the app.
- Modern CSS with no framework: `light-dark()`, `color-mix()`, masks, scroll-driven animations and scroll-state container queries. Browsers without the newest features get the same layout without those animations.
