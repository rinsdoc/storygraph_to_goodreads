import { Component, effect, inject, signal } from '@angular/core';
import { TranslatePipe, TranslateService, TranslationObject } from '@ngx-translate/core';

import { CsvData, parseCsv, toCsv } from './csv';
import {
  TITLE_COLUMN_NOT_FOUND,
  compareLibraries,
  splitByStatus,
  splitByYear,
  splitChunks,
  storygraphToGoodreads,
} from './conversion';
import en from './i18n/en.json';
import es from './i18n/es.json';

/** Available languages; each one has its file in `src/app/i18n/`. */
const TRANSLATIONS = { es, en };

type AppLanguage = keyof typeof TRANSLATIONS;

interface LoadedFile {
  name: string;
  data: CsvData;
}

interface OutputFile {
  name: string;
  csv: string;
  count: number;
}

interface AppError {
  key: string;
  params?: Record<string, string>;
}

type Tab = 'convert' | 'compare' | 'split' | 'year';
type Theme = 'light' | 'dark';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
  imports: [TranslatePipe],
})
export class App {
  private readonly translate = inject(TranslateService);

  protected readonly tabs: Tab[] = ['convert', 'compare', 'split', 'year'];
  protected readonly tabIcons: Record<Tab, string> = {
    convert: '🔄',
    compare: '🔍',
    split: '✂️',
    year: '📅',
  };

  protected readonly tab = signal<Tab>('convert');
  protected readonly error = signal<AppError | null>(null);

  protected readonly theme = signal<Theme>(App.initialTheme());
  protected readonly lang = signal<AppLanguage>(App.initialLang());

  // Convert
  protected readonly convertFile = signal<LoadedFile | null>(null);
  protected readonly convertSplit = signal(false);
  protected readonly convertChunkSize = signal(100);
  protected readonly convertCounts = signal<[string, number][] | null>(null);
  protected readonly convertOutputs = signal<OutputFile[]>([]);

  // Compare
  protected readonly compareNewFile = signal<LoadedFile | null>(null);
  protected readonly compareExistingFile = signal<LoadedFile | null>(null);
  protected readonly compareOutput = signal<OutputFile | null>(null);

  // Split
  protected readonly splitFile = signal<LoadedFile | null>(null);
  protected readonly splitMode = signal<'chunks' | 'status'>('chunks');
  protected readonly splitChunkSize = signal(50);
  protected readonly splitOutputs = signal<OutputFile[]>([]);

  // By year
  protected readonly yearFile = signal<LoadedFile | null>(null);
  protected readonly yearFilter = signal('');
  protected readonly yearOutputs = signal<OutputFile[]>([]);

  constructor() {
    for (const [lang, translations] of Object.entries(TRANSLATIONS)) {
      this.translate.setTranslation(lang, translations as TranslationObject);
    }

    effect(() => {
      const theme = this.theme();
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('theme', theme);
    });

    effect(() => {
      const lang = this.lang();
      this.translate.use(lang);
      document.documentElement.lang = lang;
      localStorage.setItem('lang', lang);
    });
  }

  private static initialTheme(): Theme {
    const stored = localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  private static initialLang(): AppLanguage {
    const stored = localStorage.getItem('lang');
    if (stored === 'es' || stored === 'en') {
      return stored;
    }
    return navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en';
  }

  protected toggleTheme(): void {
    this.theme.set(this.theme() === 'dark' ? 'light' : 'dark');
  }

  protected onLangChange(event: Event): void {
    this.lang.set((event.target as HTMLSelectElement).value as AppLanguage);
  }

  protected selectTab(tab: Tab): void {
    this.tab.set(tab);
    this.error.set(null);
  }

  private async readFile(event: Event): Promise<LoadedFile | null> {
    this.error.set(null);
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return null;
    }
    try {
      const data = parseCsv(await file.text());
      if (data.headers.length === 0) {
        this.error.set({ key: 'errors.emptyFile', params: { name: file.name } });
        return null;
      }
      return { name: file.name, data };
    } catch {
      this.error.set({ key: 'errors.readFile', params: { name: file.name } });
      return null;
    } finally {
      input.value = '';
    }
  }

  protected async onConvertFile(event: Event): Promise<void> {
    this.convertFile.set(await this.readFile(event));
    this.convertCounts.set(null);
    this.convertOutputs.set([]);
  }

  protected async onCompareNewFile(event: Event): Promise<void> {
    this.compareNewFile.set(await this.readFile(event));
    this.compareOutput.set(null);
  }

  protected async onCompareExistingFile(event: Event): Promise<void> {
    this.compareExistingFile.set(await this.readFile(event));
    this.compareOutput.set(null);
  }

  protected async onSplitFile(event: Event): Promise<void> {
    this.splitFile.set(await this.readFile(event));
    this.splitOutputs.set([]);
  }

  protected async onYearFile(event: Event): Promise<void> {
    this.yearFile.set(await this.readFile(event));
    this.yearOutputs.set([]);
  }

  protected onNumberInput(event: Event, target: 'convert' | 'split'): void {
    const value = Math.max(1, Math.trunc(+(event.target as HTMLInputElement).value || 1));
    if (target === 'convert') {
      this.convertChunkSize.set(value);
    } else {
      this.splitChunkSize.set(value);
    }
  }

  protected onYearFilterInput(event: Event): void {
    this.yearFilter.set((event.target as HTMLInputElement).value.trim());
  }

  private setCaughtError(key: string, e: unknown): void {
    if (e instanceof Error && e.message === TITLE_COLUMN_NOT_FOUND) {
      this.error.set({ key: 'errors.titleColumn' });
    } else {
      this.error.set({ key, params: { message: e instanceof Error ? e.message : String(e) } });
    }
  }

  protected runConvert(): void {
    const file = this.convertFile();
    if (!file) {
      return;
    }
    this.error.set(null);
    try {
      const { data, counts } = storygraphToGoodreads(file.data);
      this.convertCounts.set(Object.entries(counts));
      if (this.convertSplit() && data.rows.length > this.convertChunkSize()) {
        const chunks = splitChunks(data, this.convertChunkSize());
        this.convertOutputs.set(
          chunks.map((c) => this.toOutput(`goodreads_import_${c.label}.csv`, c.data)),
        );
      } else {
        this.convertOutputs.set([this.toOutput('goodreads_import.csv', data)]);
      }
    } catch (e) {
      this.setCaughtError('errors.convert', e);
    }
  }

  protected runCompare(): void {
    const newFile = this.compareNewFile();
    const existingFile = this.compareExistingFile();
    if (!newFile || !existingFile) {
      return;
    }
    this.error.set(null);
    try {
      const result = compareLibraries(newFile.data, existingFile.data);
      this.compareOutput.set(this.toOutput('libros_nuevos.csv', result));
    } catch (e) {
      this.setCaughtError('errors.compare', e);
    }
  }

  protected runSplit(): void {
    const file = this.splitFile();
    if (!file) {
      return;
    }
    this.error.set(null);
    const base = this.baseName(file.name);
    const parts =
      this.splitMode() === 'status'
        ? splitByStatus(file.data)
        : splitChunks(file.data, this.splitChunkSize());
    this.splitOutputs.set(parts.map((p) => this.toOutput(`${base}_${p.label}.csv`, p.data)));
  }

  protected runYear(): void {
    const file = this.yearFile();
    if (!file) {
      return;
    }
    this.error.set(null);
    const filter = this.yearFilter();
    if (filter && !/^\d{4}$/.test(filter)) {
      this.error.set({ key: 'errors.yearFormat' });
      return;
    }
    const base = this.baseName(file.name);
    const parts = splitByYear(file.data, filter ? +filter : undefined);
    if (parts.length === 0) {
      this.error.set({ key: 'errors.noBooksForYear', params: { year: filter } });
    }
    this.yearOutputs.set(parts.map((p) => this.toOutput(`${base}_${p.label}.csv`, p.data)));
  }

  private toOutput(name: string, data: CsvData): OutputFile {
    return { name, csv: toCsv(data), count: data.rows.length };
  }

  private baseName(fileName: string): string {
    return fileName.replace(/\.csv$/i, '');
  }

  protected download(file: OutputFile): void {
    const blob = new Blob([file.csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  }

  protected async downloadAll(files: OutputFile[]): Promise<void> {
    for (const file of files) {
      this.download(file);
      // Short pause so the browser doesn't block consecutive downloads
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }
}
