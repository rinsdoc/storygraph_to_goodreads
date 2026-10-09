import { Component, computed, effect, inject, signal } from '@angular/core';
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

type Tool = 'convert' | 'compare' | 'split' | 'year';
type Theme = 'light' | 'dark';
type FileSlot = 'convert' | 'compareNew' | 'compareExisting' | 'split' | 'year';

/** Every tool is a three-step flow: pick the file(s), set the options, get the result. */
const STEP_COUNT = 3;

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
  imports: [TranslatePipe],
})
export class App {
  private readonly translate = inject(TranslateService);

  protected readonly tools: Tool[] = ['convert', 'compare', 'split', 'year'];
  protected readonly stepIndexes = Array.from({ length: STEP_COUNT }, (_, i) => i);

  /** Null while the home screen is shown. */
  protected readonly tool = signal<Tool | null>(null);
  protected readonly step = signal(0);
  protected readonly error = signal<AppError | null>(null);

  protected readonly theme = signal<Theme>(App.initialTheme());
  protected readonly lang = signal<AppLanguage>(App.initialLang());

  /** File slot asked for on the current step, or null if the step has no file picker. */
  protected readonly pickerSlot = computed<FileSlot | null>(() => {
    const tool = this.tool();
    if (tool === 'compare') {
      return this.step() === 0 ? 'compareNew' : this.step() === 1 ? 'compareExisting' : null;
    }
    return tool && this.step() === 0 ? tool : null;
  });

  protected readonly pickedFile = computed(() => {
    switch (this.pickerSlot()) {
      case 'convert':
        return this.convertFile();
      case 'compareNew':
        return this.compareNewFile();
      case 'compareExisting':
        return this.compareExistingFile();
      case 'split':
        return this.splitFile();
      case 'year':
        return this.yearFile();
      default:
        return null;
    }
  });

  /** Files produced by the current tool, shown on its last step. */
  protected readonly outputs = computed<OutputFile[]>(() => {
    switch (this.tool()) {
      case 'convert':
        return this.convertOutputs();
      case 'compare': {
        const output = this.compareOutput();
        return output ? [output] : [];
      }
      case 'split':
        return this.splitOutputs();
      case 'year':
        return this.yearOutputs();
      default:
        return [];
    }
  });

  /** The big number on the result step. */
  protected readonly resultCount = computed(() => {
    switch (this.tool()) {
      case 'convert': {
        const counts = this.convertCounts();
        return counts ? this.totalCount(counts) : 0;
      }
      case 'compare':
        return this.compareOutput()?.count ?? 0;
      default:
        return this.outputs().length;
    }
  });

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

  protected openTool(tool: Tool): void {
    this.tool.set(tool);
    this.step.set(0);
    this.error.set(null);
  }

  protected goHome(): void {
    this.tool.set(null);
    this.error.set(null);
  }

  protected goToStep(step: number): void {
    this.step.set(step);
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

  protected onFile(event: Event, slot: FileSlot): Promise<void> {
    switch (slot) {
      case 'convert':
        return this.onConvertFile(event);
      case 'compareNew':
        return this.onCompareNewFile(event);
      case 'compareExisting':
        return this.onCompareExistingFile(event);
      case 'split':
        return this.onSplitFile(event);
      case 'year':
        return this.onYearFile(event);
    }
  }

  private async onConvertFile(event: Event): Promise<void> {
    this.convertFile.set(await this.readFile(event));
    this.convertCounts.set(null);
    this.convertOutputs.set([]);
    this.advanceIfLoaded(this.convertFile());
  }

  private async onCompareNewFile(event: Event): Promise<void> {
    this.compareNewFile.set(await this.readFile(event));
    this.compareOutput.set(null);
    this.advanceIfLoaded(this.compareNewFile());
  }

  private async onCompareExistingFile(event: Event): Promise<void> {
    this.compareExistingFile.set(await this.readFile(event));
    this.compareOutput.set(null);
  }

  private async onSplitFile(event: Event): Promise<void> {
    this.splitFile.set(await this.readFile(event));
    this.splitOutputs.set([]);
    this.advanceIfLoaded(this.splitFile());
  }

  private async onYearFile(event: Event): Promise<void> {
    this.yearFile.set(await this.readFile(event));
    this.yearOutputs.set([]);
    this.advanceIfLoaded(this.yearFile());
  }

  /** Moves on to the options step as soon as the first step's file is loaded. */
  private advanceIfLoaded(file: LoadedFile | null): void {
    if (file) {
      this.goToStep(1);
    }
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
      this.goToStep(2);
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
      this.goToStep(2);
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
    this.goToStep(2);
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
      return;
    }
    this.yearOutputs.set(parts.map((p) => this.toOutput(`${base}_${p.label}.csv`, p.data)));
    this.goToStep(2);
  }

  protected totalCount(counts: [string, number][]): number {
    return counts.reduce((sum, [, n]) => sum + n, 0);
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
