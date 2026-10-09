import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  Injector,
  WritableSignal,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
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

/**
 * Hand-drawn circles around the chosen option (viewBox 320×70). A real pen never
 * draws the same loop twice, so each new choice takes the next one.
 */
const PEN_CIRCLES = [
  // Clockwise from the top left, closing past the start
  'M40 10 C 120 0, 270 2, 308 22 C 330 36, 296 62, 200 66 C 110 70, 14 62, 8 40 C 2 20, 50 6, 120 5',
  // Anticlockwise from the top right, a little tilted
  'M290 8 C 200 -2, 60 2, 18 20 C -6 34, 30 64, 150 66 C 260 68, 318 52, 312 32 C 306 14, 250 4, 180 6',
  // A looser loop that goes round once more at the top
  'M60 14 C 150 2, 290 4, 310 30 C 324 54, 230 68, 150 64 C 60 62, 4 52, 10 30 C 16 10, 110 2, 200 8 C 250 12, 290 18, 300 26',
];

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
  imports: [NgTemplateOutlet, TranslatePipe],
})
export class App {
  private readonly translate = inject(TranslateService);
  private readonly injector = inject(Injector);

  protected readonly tools: Tool[] = ['convert', 'compare', 'split', 'year'];
  protected readonly stepIndexes = Array.from({ length: STEP_COUNT }, (_, i) => i);

  private readonly penTurn = signal(0);
  protected readonly penPath = computed(() => PEN_CIRCLES[this.penTurn() % PEN_CIRCLES.length]);

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
    const slot = this.pickerSlot();
    return slot ? this.fileSlots[slot].file() : null;
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

  /**
   * Furthest step that can be opened from the step index: the options once the
   * first file is in, the result only while one exists. Changing a file or an
   * option clears the result (see clearResult), so a stale one is never offered.
   */
  protected readonly reachableStep = computed(() => {
    const tool = this.tool();
    if (!tool) {
      return 0;
    }
    if (this.outputs().length > 0) {
      return 2;
    }
    const firstSlot = tool === 'compare' ? 'compareNew' : tool;
    return this.fileSlots[firstSlot].file() ? 1 : 0;
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

  /** Where each file picker stores its file, which tool it feeds, and whether it moves on. */
  private readonly fileSlots: Record<
    FileSlot,
    { file: WritableSignal<LoadedFile | null>; tool: Tool; advance: boolean }
  > = {
    convert: { file: this.convertFile, tool: 'convert', advance: true },
    compareNew: { file: this.compareNewFile, tool: 'compare', advance: true },
    compareExisting: { file: this.compareExistingFile, tool: 'compare', advance: false },
    split: { file: this.splitFile, tool: 'split', advance: true },
    year: { file: this.yearFile, tool: 'year', advance: true },
  };

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

  protected openTool(tool: Tool): void {
    this.tool.set(tool);
    this.step.set(0);
    this.error.set(null);
    this.focusHeading();
  }

  protected goHome(): void {
    this.tool.set(null);
    this.error.set(null);
    this.focusHeading();
  }

  protected goToStep(step: number): void {
    this.step.set(step);
    this.error.set(null);
    this.focusHeading();
  }

  /** A new option was picked: the next circle is drawn differently. */
  protected nextPenCircle(event: Event): void {
    // The number field inside the group also fires change; only radios count
    if ((event.target as HTMLInputElement).type === 'radio') {
      this.penTurn.update((turn) => turn + 1);
    }
  }

  /**
   * Each screen replaces the one with the focused control, so focus would fall
   * back to <body>. Moving it to the new heading keeps keyboard users in place
   * and makes screen readers announce the new step.
   */
  private focusHeading(): void {
    afterNextRender(
      () => document.querySelector<HTMLElement>('main h1')?.focus({ preventScroll: true }),
      { injector: this.injector },
    );
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

  protected async onFile(event: Event, slot: FileSlot): Promise<void> {
    const { file, tool, advance } = this.fileSlots[slot];
    file.set(await this.readFile(event));
    this.clearResult(tool);
    // The first step moves on to the options as soon as its file is loaded
    if (advance && file()) {
      this.goToStep(1);
    }
  }

  /**
   * Forgets a tool's result. Called whenever a file or an option it was built
   * from changes, so the result step is only reachable with a matching result.
   */
  protected clearResult(tool: Tool): void {
    switch (tool) {
      case 'convert':
        this.convertCounts.set(null);
        this.convertOutputs.set([]);
        break;
      case 'compare':
        this.compareOutput.set(null);
        break;
      case 'split':
        this.splitOutputs.set([]);
        break;
      case 'year':
        this.yearOutputs.set([]);
        break;
    }
  }

  protected onNumberInput(event: Event, target: 'convert' | 'split'): void {
    const value = Math.max(1, Math.trunc(+(event.target as HTMLInputElement).value || 1));
    if (target === 'convert') {
      this.convertChunkSize.set(value);
    } else {
      this.splitChunkSize.set(value);
    }
    this.clearResult(target);
  }

  protected onYearFilterInput(event: Event): void {
    this.yearFilter.set((event.target as HTMLInputElement).value.trim());
    this.clearResult('year');
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
