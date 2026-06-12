/**
 * Conversion logic ported from the original Python scripts:
 * storygraph_to_goodreads.py, compare_csv.py, split.py and year_splitter.py.
 */

import { CsvData, Row } from './csv';

/** Exact headers of the Goodreads import format. */
export const GOODREADS_HEADERS = [
  'Book Id',
  'Title',
  'Author',
  'Author l-f',
  'Additional Authors',
  'ISBN',
  'ISBN13',
  'My Rating',
  'Average Rating',
  'Publisher',
  'Binding',
  'Number of Pages',
  'Year Published',
  'Original Publication Year',
  'Date Read',
  'Date Added',
  'Bookshelves',
  'Bookshelves with positions',
  'Exclusive Shelf',
  'My Review',
  'Spoiler',
  'Private Notes',
  'Read Count',
  'Owned Copies',
];

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Converts a StoryGraph date to the Goodreads YYYY/MM/DD format. */
export function convertDate(dateStr: string): string {
  const s = dateStr.trim();
  if (!s) {
    return '';
  }

  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (m) {
    return `${m[1]}/${pad(+m[2])}/${pad(+m[3])}`;
  }

  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    return `${m[3]}/${pad(+m[2])}/${pad(+m[1])}`;
  }

  m = s.match(/^([A-Za-z]+) (\d{1,2}), (\d{4})$/);
  if (m) {
    const month = MONTHS[m[1].toLowerCase()];
    if (month) {
      return `${m[3]}/${pad(month)}/${pad(+m[2])}`;
    }
  }

  return '';
}

function todayGoodreads(): string {
  const d = new Date();
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
}

export interface ConversionResult {
  data: CsvData;
  counts: Record<string, number>;
}

export function storygraphToGoodreads(sg: CsvData): ConversionResult {
  const counts: Record<string, number> = {};
  const fallbackDate = todayGoodreads();

  const rows = sg.rows.map((sgRow) => {
    const gr: Row = {};
    for (const h of GOODREADS_HEADERS) {
      gr[h] = '';
    }

    gr['Title'] = sgRow['Title'] ?? '';
    const author = (sgRow['Authors'] ?? '').trim();
    gr['Author'] = author;
    const parts = author.split(/\s+/).filter(Boolean);
    if (parts.length > 1) {
      gr['Author l-f'] = `${parts[parts.length - 1]}, ${parts.slice(0, -1).join(' ')}`;
    }

    const readStatus = (sgRow['Read Status'] ?? '').toLowerCase().trim();
    let shelf: string;
    if (readStatus === 'read') {
      shelf = 'read';
    } else if (readStatus === 'currently reading' || readStatus === 'currently-reading') {
      shelf = 'currently-reading';
    } else {
      shelf = 'to-read';
    }
    gr['Exclusive Shelf'] = shelf;
    gr['Bookshelves'] = shelf;
    gr['Bookshelves with positions'] = `${shelf} (#1)`;
    counts[shelf] = (counts[shelf] ?? 0) + 1;

    const dateAdded = convertDate(sgRow['Date Added'] ?? '');
    gr['Date Added'] = dateAdded || fallbackDate;
    if (shelf === 'read') {
      const dateRead = convertDate(sgRow['Last Date Read'] ?? '');
      gr['Date Read'] = dateRead || fallbackDate;
    }

    const rating = parseFloat((sgRow['Star Rating'] ?? '').split(' ')[0]);
    gr['My Rating'] = Number.isFinite(rating) ? String(Math.trunc(rating)) : '0';

    const isbnDigits = (sgRow['ISBN/UID'] ?? '').replace(/\D/g, '');
    if (isbnDigits.length === 13) {
      gr['ISBN13'] = isbnDigits;
    } else if (isbnDigits.length === 10) {
      gr['ISBN'] = isbnDigits;
    }

    gr['Binding'] = sgRow['Format'] ?? '';
    gr['My Review'] = sgRow['Review'] ?? '';

    const readCount = parseFloat(sgRow['Read Count'] ?? '0');
    gr['Read Count'] = Number.isFinite(readCount) ? String(Math.max(0, Math.trunc(readCount))) : '0';

    const owned = (sgRow['Owned?'] ?? '').toLowerCase();
    gr['Owned Copies'] = ['yes', 'true', 'y', '1'].includes(owned) ? '1' : '0';

    return gr;
  });

  return { data: { headers: GOODREADS_HEADERS, rows }, counts };
}

function findColumn(headers: string[], candidates: string[]): string | null {
  return candidates.find((c) => headers.includes(c)) ?? null;
}

const TITLE_COLS = ['Title', 'title'];
const AUTHOR_COLS = ['Authors', 'Author', 'authors', 'author'];
const ISBN_COLS = ['ISBN/UID', 'ISBN', 'isbn', 'ISBN13', 'isbn13'];

function cleanIsbn(value: string): string {
  return value.trim().replaceAll('-', '').replaceAll('="', '').replaceAll('"', '');
}

/** Sentinel message so the UI can translate this known error. */
export const TITLE_COLUMN_NOT_FOUND = 'TITLE_COLUMN_NOT_FOUND';

/** Returns the books in `newData` that are not in `existingData`. */
export function compareLibraries(newData: CsvData, existingData: CsvData): CsvData {
  const titleColExisting = findColumn(existingData.headers, TITLE_COLS);
  const titleColNew = findColumn(newData.headers, TITLE_COLS);
  if (!titleColExisting || !titleColNew) {
    throw new Error(TITLE_COLUMN_NOT_FOUND);
  }
  const authorColExisting = findColumn(existingData.headers, AUTHOR_COLS);
  const isbnColExisting = findColumn(existingData.headers, ISBN_COLS);
  const authorColNew = findColumn(newData.headers, AUTHOR_COLS);
  const isbnColNew = findColumn(newData.headers, ISBN_COLS);

  const existing = new Set<string>();
  for (const row of existingData.rows) {
    const title = (row[titleColExisting] ?? '').trim().toLowerCase();
    const author = authorColExisting ? (row[authorColExisting] ?? '').trim().toLowerCase() : '';
    const isbn = isbnColExisting ? cleanIsbn(row[isbnColExisting] ?? '') : '';
    if (isbn) {
      existing.add(isbn);
    }
    existing.add(author ? `${title}|${author}` : title);
  }

  const rows = newData.rows.filter((row) => {
    const title = (row[titleColNew] ?? '').trim().toLowerCase();
    const author = authorColNew ? (row[authorColNew] ?? '').trim().toLowerCase() : '';
    const isbn = isbnColNew ? cleanIsbn(row[isbnColNew] ?? '') : '';
    if (isbn && existing.has(isbn)) {
      return false;
    }
    if (author && existing.has(`${title}|${author}`)) {
      return false;
    }
    return !existing.has(title);
  });

  return { headers: newData.headers, rows };
}

export interface SplitFile {
  label: string;
  data: CsvData;
}

export function splitChunks(data: CsvData, chunkSize: number): SplitFile[] {
  const files: SplitFile[] = [];
  for (let i = 0; i < data.rows.length; i += chunkSize) {
    files.push({
      label: String(files.length + 1),
      data: { headers: data.headers, rows: data.rows.slice(i, i + chunkSize) },
    });
  }
  return files;
}

export function splitByStatus(data: CsvData): SplitFile[] {
  const statusCol = findColumn(data.headers, ['Exclusive Shelf', 'Read Status']);
  const groups = new Map<string, Row[]>();
  for (const row of data.rows) {
    const status = (statusCol ? row[statusCol] : '').trim() || 'unknown';
    if (!groups.has(status)) {
      groups.set(status, []);
    }
    groups.get(status)!.push(row);
  }
  return [...groups.entries()].map(([status, rows]) => ({
    label: status.toLowerCase().replaceAll(/\s+/g, '-'),
    data: { headers: data.headers, rows },
  }));
}

function extractYears(row: Row): Set<number> {
  const years = new Set<number>();
  const addYear = (dateStr: string) => {
    const m = dateStr.trim().match(/^(\d{4})/);
    if (m) {
      years.add(+m[1]);
    }
  };
  addYear(row['Date Added'] ?? '');
  for (const d of (row['Dates Read'] ?? '').split(',')) {
    addYear(d);
  }
  addYear(row['Last Date Read'] ?? '');
  return years;
}

/**
 * Groups by year (Date Added, Dates Read or Last Date Read). Without a
 * filter, a book may appear in several years; with `year`, only in that year.
 */
export function splitByYear(data: CsvData, year?: number): SplitFile[] {
  const groups = new Map<string, Row[]>();
  for (const row of data.rows) {
    const bookYears = extractYears(row);
    let labels: string[];
    if (year !== undefined) {
      if (!bookYears.has(year)) {
        continue;
      }
      labels = [String(year)];
    } else {
      labels = bookYears.size > 0 ? [...bookYears].map(String) : ['unknown'];
    }
    for (const label of labels) {
      if (!groups.has(label)) {
        groups.set(label, []);
      }
      groups.get(label)!.push(row);
    }
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, rows]) => ({ label, data: { headers: data.headers, rows } }));
}
