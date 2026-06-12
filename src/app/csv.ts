/**
 * CSV parser and serializer (RFC 4180): quoted fields, commas and
 * line breaks inside fields, and leading BOM.
 */

export type Row = Record<string, string>;

export interface CsvData {
  headers: string[];
  rows: Row[];
}

export function parseCsv(text: string): CsvData {
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }

  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      record.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') {
        i++;
      }
      record.push(field);
      field = '';
      records.push(record);
      record = [];
    } else {
      field += c;
    }
  }
  if (field !== '' || record.length > 0) {
    record.push(field);
    records.push(record);
  }

  const nonEmpty = records.filter((r) => r.length > 1 || r[0].trim() !== '');
  if (nonEmpty.length === 0) {
    return { headers: [], rows: [] };
  }

  const [headers, ...dataRecords] = nonEmpty;
  const rows = dataRecords.map((rec) => {
    const row: Row = {};
    headers.forEach((h, idx) => (row[h] = rec[idx] ?? ''));
    return row;
  });
  return { headers, rows };
}

function escapeField(value: string): string {
  return /[",\r\n]/.test(value) ? '"' + value.replaceAll('"', '""') + '"' : value;
}

export function toCsv(data: CsvData): string {
  const lines = [data.headers.map(escapeField).join(',')];
  for (const row of data.rows) {
    lines.push(data.headers.map((h) => escapeField(row[h] ?? '')).join(','));
  }
  return lines.join('\r\n') + '\r\n';
}
