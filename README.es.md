<div align="center">

# 📚 StoryGraph → Goodreads

**Migra tu biblioteca de libros de StoryGraph a Goodreads — directamente en tu navegador.**

[![Angular](https://img.shields.io/badge/Angular-21-dd0031?logo=angular&logoColor=white)](https://angular.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![i18n](https://img.shields.io/badge/i18n-ES%20%C2%B7%20EN-6d44c4)](#-internacionalización)
[![Privacidad](https://img.shields.io/badge/privacidad-100%25%20local-2e7d4f)](#-privacidad)

🌐 [English](README.md) · **Español**

</div>

---

Una aplicación web pequeña y rápida que convierte tu exportación CSV de [StoryGraph](https://thestorygraph.com) al formato que [Goodreads](https://www.goodreads.com/review/import) puede importar — además de herramientas para comparar bibliotecas, dividir archivos grandes y trocear tu biblioteca por años. Sin línea de comandos, sin cuentas, sin servidor: **todos los archivos se procesan localmente en tu navegador y nunca salen de tu ordenador.**

## ✨ Funciones

| Herramienta | Qué hace |
| --- | --- |
| 🔄 **Convertir** | Transforma una exportación de StoryGraph al formato de importación de Goodreads: estanterías, fechas, valoraciones, ISBN y reseñas incluidas. Opcionalmente divide el resultado en archivos más pequeños. |
| 🔍 **Comparar** | Encuentra los libros de un archivo nuevo que *no* están en tu biblioteca existente (comparando por ISBN, o por título + autor). Ideal para evitar importar duplicados. |
| ✂️ **Dividir** | Trocea un CSV grande en partes de tamaño fijo, o lo separa por estado de lectura (`read`, `to-read`, `currently-reading`…). |
| 📅 **Por año** | Crea un archivo por cada año de tu biblioteca, o exporta solo los libros de un año concreto. |

Además:

- 🌗 **Modo claro y oscuro** — sigue la preferencia del sistema por defecto, con un selector manual que se recuerda entre visitas.
- 🌍 **Interfaz bilingüe** — español e inglés, detectado automáticamente del idioma del navegador y cambiable en cualquier momento.
- 📦 **Sin backend** — la build de producción es totalmente estática y puede alojarse en cualquier parte.

## 🚀 Inicio rápido

Requisitos: [Node.js](https://nodejs.org) 20.19+ (o 22.12+) y npm.

```sh
git clone https://github.com/rinsdoc/storygraph_to_goodreads.git
cd storygraph_to_goodreads
npm install
npm start
```

Abre <http://localhost:4200> y listo.

## 📖 Cómo migrar tu biblioteca

1. **Exporta desde StoryGraph** — ve a [Manage Data](https://app.thestorygraph.com/user-export) en tu cuenta de StoryGraph y descarga la exportación CSV.
2. **Convierte** — abre la app, elige **Convertir** en la portada, carga el CSV, decide si quieres uno o varios archivos y pulsa *Convertir*.
3. **Descarga** — obtén el `goodreads_import.csv` generado (o varios trozos más pequeños si activaste la división — Goodreads digiere mejor los archivos pequeños).
4. **Importa en Goodreads** — sube el archivo en [goodreads.com/review/import](https://www.goodreads.com/review/import).
5. *(Opcional)* En migraciones posteriores, usa la herramienta **Comparar** con tu exportación actual de Goodreads para importar solo los libros nuevos.

## 🔄 Qué se convierte

| Columna StoryGraph | Columna Goodreads | Notas |
| --- | --- | --- |
| `Title` | `Title` | Tal cual |
| `Authors` | `Author`, `Author l-f` | También deriva la forma *apellido, nombre* |
| `Read Status` | `Exclusive Shelf`, `Bookshelves` | Mapeado a `read` / `currently-reading` / `to-read` |
| `Date Added` | `Date Added` | Si falta, se usa la fecha de hoy |
| `Last Date Read` | `Date Read` | Solo para libros en la estantería `read` |
| `Star Rating` | `My Rating` | Truncado a entero (Goodreads no tiene medias estrellas) |
| `ISBN/UID` | `ISBN` o `ISBN13` | Detectado por número de dígitos (10 frente a 13) |
| `Format` | `Binding` | Tal cual |
| `Review` | `My Review` | Tal cual |
| `Read Count` | `Read Count` | Acotado a un entero no negativo |
| `Owned?` | `Owned Copies` | `yes/true/y/1` → `1`, cualquier otro valor → `0` |

Formatos de fecha admitidos: `YYYY-MM-DD`, `DD/MM/YYYY` y `Month D, YYYY` — todos se normalizan al formato `YYYY/MM/DD` que espera Goodreads.

## 🔒 Privacidad

Esta app **no tiene backend**. Los CSV se leen con la API `File` del navegador, se procesan en memoria y se descargan de vuelta a tu máquina. No se sube, rastrea ni almacena nada — tu historial de lectura sigue siendo tuyo.

## 🌍 Internacionalización

La interfaz está traducida con [`@ngx-translate/core`](https://github.com/ngx-translate/core) usando claves de traducción y el pipe `translate`. Las traducciones viven en archivos JSON planos en `src/app/i18n/` que se empaquetan en build (sin http-loader ni peticiones en tiempo de ejecución).

## 🗂 Estructura del proyecto

```
src/
├── app/
│   ├── app.ts            # Componente raíz: signals, estado de tema e idioma
│   ├── app.html          # Portada y flujo por pasos (solo claves de traducción)
│   ├── app.css           # Estilos del componente
│   ├── app.config.ts     # Providers de la aplicación (ngx-translate)
│   ├── conversion.ts     # Lógica de conversión, comparación y división
│   ├── csv.ts            # Parser y serializador CSV (RFC 4180)
│   └── i18n/             # Archivos de traducción (es.json, en.json)
├── styles.css            # Variables de tema (light-dark) y estilos globales
└── index.html
```

La lógica de conversión es TypeScript puro sin dependencias de Angular — fue portada de los scripts Python originales (`storygraph_to_goodreads.py`, `compare_csv.py`, `split.py`, `year_splitter.py`) y es fácil de testear o reutilizar.

## 🛠 Scripts

| Comando | Descripción |
| --- | --- |
| `npm start` | Servidor de desarrollo con recarga en caliente en `localhost:4200` |
| `npm run build` | Build de producción en `dist/storygraph-converter/` |
| `npm run watch` | Build de desarrollo en modo watch |

## 🧰 Tecnologías

- [Angular 21](https://angular.dev) — componentes standalone, signals, nuevo control de flujo (`@if` / `@for` / `@switch`).
- [@ngx-translate/core](https://github.com/ngx-translate/core) — la **única** dependencia de runtime además del propio Angular.
- CSS moderno — `light-dark()`, `color-mix()`, custom properties. Sin frameworks CSS.
