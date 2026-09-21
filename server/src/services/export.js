import { Parser } from 'json2csv';
import PDFDocument from 'pdfkit';
import { getUsernameByUid } from './userLookup.js';


export async function exportToCSV(reports) {
  const rows = await Promise.all(reports.map(async (report) => ({
    id: report._id?.toString() ?? '',
    submittedBy: await getUsernameByUid(report.submittedBy) ?? '',
    category: report.category ?? '',
    status: report.status ?? '',
    description: report.description ?? '',
    address: report.location?.address ?? '',
    submittedAt: report.createdAt ? new Date(report.createdAt).toISOString() : '',
  })));

  const parser = new Parser({
    fields: ['id','submittedBy', 'category', 'status', 'description', 'address', 'submittedAt'],
  });
  return `\uFEFF${parser.parse(rows)}`;
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
      doc.fontSize(10).text(`${i + 1}. [${r.status}] ${r.category} (Submitted by: ${r.submittedBy})`);
      doc.fontSize(9).text(`   ${r.description.slice(0, 120)}`);
      doc.fontSize(8).text(`   ${r.createdAt?.toLocaleString() ?? ''}`);
      doc.moveDown(0.5);
    });

    doc.end();
  });
}
