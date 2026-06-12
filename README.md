<div align="center">

# 📚 StoryGraph → Goodreads

**Migrate your book library from StoryGraph to Goodreads — right in your browser.**

[![Angular](https://img.shields.io/badge/Angular-21-dd0031?logo=angular&logoColor=white)](https://angular.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![i18n](https://img.shields.io/badge/i18n-ES%20%C2%B7%20EN-6d44c4)](#-internationalization)
[![Privacy](https://img.shields.io/badge/privacy-100%25%20local-2e7d4f)](#-privacy)

🌐 **English** · [Español](README.es.md)

</div>

---

A small, fast web app that converts your [StoryGraph](https://thestorygraph.com) CSV export into the format [Goodreads](https://www.goodreads.com/review/import) can import — plus tools to compare libraries, split large files, and slice your library by year. No command line, no account, no server: **every file is processed locally in your browser and never leaves your computer.**

## ✨ Features

| Tab | What it does |
| --- | --- |
| 🔄 **Convert** | Transforms a StoryGraph export into the Goodreads import format: shelves, dates, ratings, ISBN and reviews included. Optionally splits the result into smaller files. |
| 🔍 **Compare** | Finds the books in a new file that are *not* in your existing library (matched by ISBN, or by title + author). Great for avoiding duplicate imports. |
| ✂️ **Split** | Chops a large CSV into fixed-size parts, or separates it by read status (`read`, `to-read`, `currently-reading`…). |
| 📅 **By year** | Creates one file per year of your library, or exports only the books of a specific year. |

Plus:

- 🌗 **Light & dark mode** — follows your system preference by default, with a manual toggle that persists across visits.
- 🌍 **Bilingual UI** — Spanish and English, auto-detected from your browser language, switchable at any time.
- 📦 **Zero-backend** — the production build is fully static and can be hosted anywhere.

## 🚀 Quick start

Requirements: [Node.js](https://nodejs.org) 20.19+ (or 22.12+) and npm.

```sh
git clone https://github.com/rinsdoc/storygraph_to_goodreads.git
cd storygraph_to_goodreads
npm install
npm start
```

Open <http://localhost:4200> and you're ready to go.

## 📖 How to migrate your library

1. **Export from StoryGraph** — go to [Manage Data](https://app.thestorygraph.com/user-export) in your StoryGraph account and download the CSV export.
2. **Convert** — open the app, pick the **Convert** tab, load the CSV and click *Convert*.
3. **Download** — grab the generated `goodreads_import.csv` (or several smaller chunks if you enabled splitting — Goodreads handles small files more reliably).
4. **Import into Goodreads** — upload the file at [goodreads.com/review/import](https://www.goodreads.com/review/import).
5. *(Optional)* On later migrations, use the **Compare** tab with your current Goodreads export to import only the new books.

## 🔄 What gets converted

| StoryGraph column | Goodreads column | Notes |
| --- | --- | --- |
| `Title` | `Title` | As-is |
| `Authors` | `Author`, `Author l-f` | Also derives the *last-name-first* form |
| `Read Status` | `Exclusive Shelf`, `Bookshelves` | Mapped to `read` / `currently-reading` / `to-read` |
| `Date Added` | `Date Added` | Falls back to today if missing |
| `Last Date Read` | `Date Read` | Only for books on the `read` shelf |
| `Star Rating` | `My Rating` | Truncated to a whole number (Goodreads has no half stars) |
| `ISBN/UID` | `ISBN` or `ISBN13` | Detected by digit count (10 vs 13) |
| `Format` | `Binding` | As-is |
| `Review` | `My Review` | As-is |
| `Read Count` | `Read Count` | Clamped to a non-negative integer |
| `Owned?` | `Owned Copies` | `yes/true/y/1` → `1`, anything else → `0` |

Supported date formats: `YYYY-MM-DD`, `DD/MM/YYYY` and `Month D, YYYY` — all normalized to the `YYYY/MM/DD` format Goodreads expects.

## 🔒 Privacy

This app has **no backend**. CSV files are read with the browser's `File` API, processed in memory, and downloaded back to your machine. Nothing is uploaded, tracked or stored — your reading history stays yours.

## 🌍 Internationalization

The UI is translated with [`@ngx-translate/core`](https://github.com/ngx-translate/core) using translation keys and the `translate` pipe. Translations live in plain JSON files under `src/app/i18n/` that are bundled at build time (no HTTP loader, no runtime requests).

## 🗂 Project structure

```
src/
├── app/
│   ├── app.ts            # Root component: signals, theme & language state
│   ├── app.html          # Tabbed UI (translation keys only, no hardcoded text)
│   ├── app.css           # Component styles
│   ├── app.config.ts     # Application providers (ngx-translate)
│   ├── conversion.ts     # Conversion, comparison and splitting logic
│   ├── csv.ts            # RFC 4180 CSV parser & serializer
│   └── i18n/             # Translation files (es.json, en.json)
├── styles.css            # Theme variables (light-dark) and global styles
└── index.html
```

The conversion logic is pure TypeScript with no Angular dependencies — it was ported from the original Python scripts (`storygraph_to_goodreads.py`, `compare_csv.py`, `split.py`, `year_splitter.py`) and is easy to unit-test or reuse.

## 🛠 Scripts

| Command | Description |
| --- | --- |
| `npm start` | Dev server with hot reload at `localhost:4200` |
| `npm run build` | Production build into `dist/storygraph-converter/` |
| `npm run watch` | Development build in watch mode |

## 🧰 Tech stack

- [Angular 21](https://angular.dev) — standalone components, signals, new control flow (`@if` / `@for` / `@switch`).
- [@ngx-translate/core](https://github.com/ngx-translate/core) — the **only** runtime dependency beyond Angular itself.
- Modern CSS — `light-dark()`, `color-mix()`, CSS custom properties. No CSS framework.
