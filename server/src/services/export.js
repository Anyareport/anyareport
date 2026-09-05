import { Parser } from 'json2csv';
import PDFDocument from 'pdfkit';

export function exportToCSV(reports) {
  const rows = reports.map((r) => ({
    id: r._id.toString(),
    category: r.category,
    committee: r.committee || '',
    status: r.status,
    description: r.description,
    latitude: r.location?.coordinates?.[1] ?? '',
    longitude: r.location?.coordinates?.[0] ?? '',
    submittedAt: r.createdAt?.toISOString() ?? '',
  }));

  const parser = new Parser();
  return parser.parse(rows);
}

export function exportToPDF(reports) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(16).text('Anyareport — Incident Export', { underline: true });
    doc.moveDown();

    reports.forEach((r, i) => {
      doc.fontSize(10).text(`${i + 1}. [${r.status}] ${r.category}`);
      doc.fontSize(9).text(`   ${r.description.slice(0, 120)}`);
      doc.fontSize(8).text(`   Committee: ${r.committee || 'N/A'} | ${r.createdAt?.toLocaleString() ?? ''}`);
      doc.moveDown(0.5);
    });

    doc.end();
  });
}
