import PDFDocument from 'pdfkit';
import User from '../models/User.js';
import { toCsv, toIsoTimestamp } from './csvExport.js';
import { getReportStatusLabel } from './reportWorkflow.js';

async function withSubmitterNames(reports) {
  const submitterUids = [...new Set(reports.map((report) => report.submittedBy).filter(Boolean))];
  const users = await User.find({ firebaseUid: { $in: submitterUids } })
    .select('firebaseUid name')
    .lean();
  const namesByUid = new Map(users.map((user) => [user.firebaseUid, user.name]));

  return reports.map((report) => ({
    ...report,
    submittedByName: report.isGuest ? 'Anonymous account' : namesByUid.get(report.submittedBy) ?? '',
  }));
}

function getIncidentLabel(report) {
  const aiTitle = report.aiTitle?.trim();
  if (aiTitle) return aiTitle;

  const description = report.description?.trim();
  if (description) {
    return description.length > 80 ? `${description.slice(0, 80).trimEnd()}…` : description;
  }

  return report.subcategory || report.category || '';
}

function getLocationLabel(report) {
  return report.location?.address?.trim().replace(/,?\s*Don Mariano Marcos\s*$/i, '').trim() ?? '';
}

export async function exportToCSV(reports) {
  const reportsWithNames = await withSubmitterNames(reports);
  const rows = reportsWithNames.map((report) => ({
    referenceNumber: report.referenceNumber ?? '',
    submittedBy: report.submittedByName,
    reportedBy: report.reportedBy ?? '',
    category: report.category ?? '',
    subcategory: report.subcategory ?? '',
    severity: report.severity ?? '',
    status: report.status ? getReportStatusLabel(report.status) : '',
    incident: getIncidentLabel(report),
    description: report.description ?? '',
    location: getLocationLabel(report),
    submittedAt: toIsoTimestamp(report.createdAt),
    resolvedAt: toIsoTimestamp(report.resolution?.resolvedAt),
  }));

  return toCsv(rows, [
    { label: 'Reference Number', value: 'referenceNumber' },
    { label: 'Incident', value: 'incident' },
    { label: 'Category', value: 'category' },
    { label: 'Subcategory', value: 'subcategory' },
    { label: 'Severity', value: 'severity' },
    { label: 'Status', value: 'status' },
    { label: 'Location', value: 'location' },
    { label: 'Description', value: 'description' },
    { label: 'Submitted By', value: 'submittedBy' },
    { label: 'Reported By', value: 'reportedBy' },
    { label: 'Submitted At', value: 'submittedAt' },
    { label: 'Resolved At', value: 'resolvedAt' },
  ]);
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
        doc.fontSize(9).text(`Exported: ${toIsoTimestamp(new Date())}`);
        doc.moveDown();

        reportsWithNames.forEach((report, index) => {
          const reference = report.referenceNumber ? ` ${report.referenceNumber}` : '';
          doc
            .fontSize(10)
            .text(
              `${index + 1}.${reference} [${report.status ? getReportStatusLabel(report.status) : ''}] ${report.category} (Submitted by: ${report.submittedByName})`
            );
          if (report.subcategory) doc.fontSize(9).text(`   Subcategory: ${report.subcategory}`);
          doc.fontSize(9).text(`   Incident: ${getIncidentLabel(report)}`);
          if (report.severity) doc.fontSize(9).text(`   Severity: ${report.severity}`);
          if (report.description) doc.fontSize(9).text(`   Description: ${report.description}`);
          if (getLocationLabel(report)) {
            doc.fontSize(8).text(`   Location: ${getLocationLabel(report)}`);
          }
          doc.fontSize(8).text(`   Submitted At: ${toIsoTimestamp(report.createdAt)}`);
          if (report.resolution?.resolvedAt) {
            doc.fontSize(8).text(`   Resolved At: ${toIsoTimestamp(report.resolution.resolvedAt)}`);
          }
          doc.moveDown(0.5);
        });

        doc.end();
      })
  );
}
