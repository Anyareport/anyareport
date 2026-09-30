import ReportReferenceCounter from '../models/ReportReferenceCounter.js';

export function formatReportReference(year, sequence) {
  return `AR-${year}-${String(sequence).padStart(4, '0')}`;
}

export async function getNextReportReference(date = new Date()) {
  const year = date.getUTCFullYear();
  const counterId = String(year);
  let counter;

  try {
    counter = await ReportReferenceCounter.findByIdAndUpdate(
      counterId,
      { $inc: { sequence: 1 } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
  } catch (error) {
    if (error.code !== 11000) throw error;

    counter = await ReportReferenceCounter.findByIdAndUpdate(
      counterId,
      { $inc: { sequence: 1 } },
      { new: true }
    );
  }

  if (!counter) throw new Error(`Could not allocate a report reference for ${year}`);
  return formatReportReference(year, counter.sequence);
}
