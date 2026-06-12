import { Component, signal } from '@angular/core';

import { CsvData, parseCsv, toCsv } from './csv';
import {
  compareLibraries,
  splitByStatus,
  splitByYear,
  splitChunks,
  storygraphToGoodreads,
} from './conversion';

interface LoadedFile {
  name: string;
  data: CsvData;
}

interface OutputFile {
  name: string;
  csv: string;
  count: number;
}

type Tab = 'convert' | 'compare' | 'split' | 'year';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly tabs: { id: Tab; label: string; hint: string }[] = [
    { id: 'convert', label: 'Convertir', hint: 'StoryGraph → Goodreads' },
    { id: 'compare', label: 'Comparar', hint: 'Encontrar libros nuevos' },
    { id: 'split', label: 'Dividir', hint: 'Por tamaño o estado' },
    { id: 'year', label: 'Por año', hint: 'Separar por año' },
  ];

  protected readonly tab = signal<Tab>('convert');
  protected readonly error = signal('');

  // Convertir
  protected readonly convertFile = signal<LoadedFile | null>(null);
  protected readonly convertSplit = signal(false);
  protected readonly convertChunkSize = signal(100);
  protected readonly convertCounts = signal<[string, number][] | null>(null);
  protected readonly convertOutputs = signal<OutputFile[]>([]);

  // Comparar
  protected readonly compareNewFile = signal<LoadedFile | null>(null);
  protected readonly compareExistingFile = signal<LoadedFile | null>(null);
  protected readonly compareOutput = signal<OutputFile | null>(null);

  // Dividir
  protected readonly splitFile = signal<LoadedFile | null>(null);
  protected readonly splitMode = signal<'chunks' | 'status'>('chunks');
  protected readonly splitChunkSize = signal(50);
  protected readonly splitOutputs = signal<OutputFile[]>([]);

  // Por año
  protected readonly yearFile = signal<LoadedFile | null>(null);
  protected readonly yearFilter = signal('');
  protected readonly yearOutputs = signal<OutputFile[]>([]);

  protected selectTab(tab: Tab): void {
    this.tab.set(tab);
    this.error.set('');
  }

  private async readFile(event: Event): Promise<LoadedFile | null> {
    this.error.set('');
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return null;
    }
    try {
      const data = parseCsv(await file.text());
      if (data.headers.length === 0) {
        this.error.set(`El archivo "${file.name}" está vacío o no es un CSV válido.`);
        return null;
      }
      return { name: file.name, data };
    } catch {
      this.error.set(`No se pudo leer el archivo "${file.name}".`);
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

  protected runConvert(): void {
    const file = this.convertFile();
    if (!file) {
      return;
    }
    this.error.set('');
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
      this.error.set(`Error durante la conversión: ${e instanceof Error ? e.message : e}`);
    }
  }

  protected runCompare(): void {
    const newFile = this.compareNewFile();
    const existingFile = this.compareExistingFile();
    if (!newFile || !existingFile) {
      return;
    }
    this.error.set('');
    try {
      const result = compareLibraries(newFile.data, existingFile.data);
      this.compareOutput.set(this.toOutput('libros_nuevos.csv', result));
    } catch (e) {
      this.error.set(`Error durante la comparación: ${e instanceof Error ? e.message : e}`);
    }
  }

  protected runSplit(): void {
    const file = this.splitFile();
    if (!file) {
      return;
    }
    this.error.set('');
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
    this.error.set('');
    const filter = this.yearFilter();
    if (filter && !/^\d{4}$/.test(filter)) {
      this.error.set('El año debe tener 4 dígitos, por ejemplo 2025.');
      return;
    }
    const base = this.baseName(file.name);
    const parts = splitByYear(file.data, filter ? +filter : undefined);
    if (parts.length === 0) {
      this.error.set(`No hay ningún libro asociado al año ${filter}.`);
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
      // Pausa breve para que el navegador no bloquee descargas consecutivas
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }
}
