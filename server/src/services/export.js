import { Parser } from 'json2csv';
import PDFDocument from 'pdfkit';
import User from '../models/User.js';

async function withSubmitterNames(reports) {
  const submitterUids = [...new Set(reports.map((report) => report.submittedBy).filter(Boolean))];
  const users = await User.find({ firebaseUid: { $in: submitterUids } })
    .select('firebaseUid name')
    .lean();
  const namesByUid = new Map(users.map((user) => [user.firebaseUid, user.name]));

  return reports.map((report) => ({
    ...report,
    submittedByName: namesByUid.get(report.submittedBy) ?? '',
  }));
}

export async function exportToCSV(reports) {
  const reportsWithNames = await withSubmitterNames(reports);
  const rows = reportsWithNames.map((report) => ({
    referenceNumber: report.referenceNumber ?? '',
    submittedBy: report.submittedByName,
    category: report.category ?? '',
    subcategory: report.subcategory ?? '',
    status: report.status ?? '',
    description: report.description ?? '',
    address: report.location?.address ?? '',
    submittedAt: report.createdAt ? new Date(report.createdAt).toISOString() : '',
  }));

  const parser = new Parser({
    fields: [
      'referenceNumber',
      'submittedBy',
      'category',
      'subcategory',
      'status',
      'description',
      'address',
      'submittedAt',
    ],
  });
  return `\uFEFF${parser.parse(rows)}`;
}

export function exportToPDF(reports) {
  return withSubmitterNames(reports).then(
    (reportsWithNames) =>
      new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        const chunks = [];

        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        doc.fontSize(16).text('Anyareport - Incident Export', { underline: true });
        doc.fontSize(9).text(`Exported: ${new Date().toLocaleString()}`);
        doc.moveDown();

        reportsWithNames.forEach((report, index) => {
          const reference = report.referenceNumber ? ` ${report.referenceNumber}` : '';
          doc
            .fontSize(10)
            .text(
              `${index + 1}.${reference} [${report.status}] ${report.category} (Submitted by: ${report.submittedByName})`
            );
          if (report.subcategory) doc.fontSize(9).text(`   Subcategory: ${report.subcategory}`);
          if (report.description) doc.fontSize(9).text(`   ${report.description}`);
          if (report.location?.address) {
            doc.fontSize(8).text(`   Location: ${report.location.address}`);
          }
          doc
            .fontSize(8)
            .text(
              `   ${report.createdAt ? new Date(report.createdAt).toLocaleString() : ''}`
            );
          doc.moveDown(0.5);
        });

        doc.end();
      })
  );
}
