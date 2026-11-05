import { Parser } from 'json2csv';

function formatCsvString(value) {
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows, fields) {
  const parser = new Parser({
    fields,
    eol: '\r\n',
    withBOM: true,
    formatters: { string: formatCsvString, header: (value) => String(value) },
  });
  return parser.parse(rows);
}

export function toIsoTimestamp(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}
