// Fills the scanned "Complaint" form (Office of the Lupong Tagapamayapa) by
// drawing text on top of public/complaint-form.jpg (1814 x 2576 px).
// x = left edge, y = text baseline, both in pixels on the scan.
// If the print ever looks off, nudge the numbers below.

export interface ComplaintFormValues {
  complainantName: string;
  contactNumber: string;
  caseNo: string;
  caseFor: string;
  respondentName: string;
  narrative: string;
  relief: string;
  madeDay: string;
  madeMonth: string;
  madeYear: string; // last two digits, printed after "20"
  receivedDay: string;
  receivedMonth: string;
  receivedYear: string; // last two digits, printed after "20"
}

/** True for each wrapped block whose text is longer than its printed lines. */
export type ComplaintOverflow = Record<keyof typeof BLOCKS, boolean>;

export const noComplaintOverflow: ComplaintOverflow = {
  complainantName: false,
  respondentName: false,
  caseFor: false,
  narrative: false,
  relief: false,
};

export const emptyComplaintValues: ComplaintFormValues = {
  complainantName: '',
  contactNumber: '',
  caseNo: '',
  caseFor: '',
  respondentName: '',
  narrative: '',
  relief: '',
  madeDay: '',
  madeMonth: '',
  madeYear: '',
  receivedDay: '',
  receivedMonth: '',
  receivedYear: '',
};

type DatePrefix = 'made' | 'received';

/** Splits a date into the day / month / 2-digit year strings the form prints. */
export function complaintDateParts<P extends DatePrefix>(prefix: P, date = new Date()) {
  return {
    [`${prefix}Day`]: String(date.getDate()),
    [`${prefix}Month`]: date.toLocaleString('en-US', { month: 'long' }),
    [`${prefix}Year`]: String(date.getFullYear()).slice(2),
  } as Record<`${P}${'Day' | 'Month' | 'Year'}`, string>;
}

export function todayComplaintDate(date = new Date()) {
  return { ...complaintDateParts('made', date), ...complaintDateParts('received', date) };
}

/** A blank form with today's date filled in. */
export const blankComplaintValues = (): ComplaintFormValues => ({
  ...emptyComplaintValues,
  ...todayComplaintDate(),
});

const FORM_URL = `${import.meta.env.BASE_URL}complaint-form.jpg`;
const INK = '#0a1a8c';
const FONT_SIZE = 30;
const MIN_FONT_SIZE = 18;
const fontOf = (size: number) => `${size}px Arial, Helvetica, sans-serif`;

// Baselines sit ~4px above each printed underline so descenders don't touch it.
const FIELD_POSITIONS = {
  contactNumber: { x: 262, y: 743, maxWidth: 390 },
  caseNo: { x: 1150, y: 610, maxWidth: 340 },
  madeDay: { x: 250, y: 1852, maxWidth: 50 },
  madeMonth: { x: 415, y: 1852, maxWidth: 290 },
  madeYear: { x: 785, y: 1852, maxWidth: 50 },
  receivedDay: { x: 428, y: 2011, maxWidth: 80 },
  receivedMonth: { x: 625, y: 2011, maxWidth: 185 },
  receivedYear: { x: 878, y: 2011, maxWidth: 60 },
} as const;

// Wrapped blocks: text flows onto the next printed line when it runs out of width.
// ys = one baseline per printed line. The complainant's name takes the two
// "Complainant/s" (or "Respondent/s") lines, so a long name continues on the second line.
const BLOCKS = {
  complainantName: { x: 95, maxWidth: 340, ys: [613, 656] },
  respondentName: { x: 95, maxWidth: 340, ys: [886, 925] },
  caseFor: { x: 940, maxWidth: 520, ys: [655, 697] },
  narrative: { x: 95, maxWidth: 1640, ys: [1214, 1255, 1296, 1337, 1379] },
  relief: { x: 95, maxWidth: 1640, ys: [1548, 1592, 1634, 1677] },
} as const;

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load the complaint form image.'));
    img.src = src;
  });
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    lines.push(line);
  }
  return lines;
}

/** Shrinks the font a little so a long value still fits on its line. */
function drawFitted(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number
) {
  if (!text) return;
  let size = FONT_SIZE;
  ctx.font = fontOf(size);
  while (size > MIN_FONT_SIZE && ctx.measureText(text).width > maxWidth) {
    ctx.font = fontOf(--size);
  }
  ctx.fillText(text, x, y);
  ctx.font = fontOf(FONT_SIZE);
}

export async function renderComplaintCanvas(values: ComplaintFormValues) {
  const base = await loadImage(FORM_URL);
  const canvas = document.createElement('canvas');
  canvas.width = base.naturalWidth;
  canvas.height = base.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not supported in this browser.');

  ctx.drawImage(base, 0, 0);
  ctx.fillStyle = INK;
  ctx.textBaseline = 'alphabetic';
  ctx.font = fontOf(FONT_SIZE);

  (Object.keys(FIELD_POSITIONS) as (keyof typeof FIELD_POSITIONS)[]).forEach((key) => {
    const { x, y, maxWidth } = FIELD_POSITIONS[key];
    drawFitted(ctx, values[key].trim(), x, y, maxWidth);
  });

  const overflow = { ...noComplaintOverflow };
  (Object.keys(BLOCKS) as (keyof typeof BLOCKS)[]).forEach((key) => {
    const { x, maxWidth, ys } = BLOCKS[key];
    const text = values[key].trim();
    if (!text) return;
    const lines = wrapText(ctx, text, maxWidth);
    overflow[key] = lines.length > ys.length;
    lines.slice(0, ys.length).forEach((line, i) => ctx.fillText(line, x, ys[i]));
  });

  return { canvas, overflow };
}

export function canvasToJpegBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not create the image.'))),
      'image/jpeg',
      0.92
    );
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Opens the browser print dialog with the filled form at A4 size. */
export function printComplaintCanvas(canvas: HTMLCanvasElement) {
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(frame);

  const doc = frame.contentDocument;
  if (!doc) {
    frame.remove();
    throw new Error('Could not open the print view.');
  }
  doc.open();
  doc.write(`<!DOCTYPE html><html><head><title>Complaint</title><style>
    @page { size: A4; margin: 0; }
    html, body { margin: 0; padding: 0; }
    img { display: block; width: 210mm; height: 297mm; }
  </style></head><body><img id="form" src="${canvas.toDataURL('image/jpeg', 0.92)}" /></body></html>`);
  doc.close();

  const img = doc.getElementById('form') as HTMLImageElement;
  const run = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    window.setTimeout(() => frame.remove(), 60000);
  };
  if (img.complete) run();
  else img.onload = run;
}

export function buildComplaintFilename(values: ComplaintFormValues) {
  const slug = (values.complainantName || 'complaint')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `complaint-${slug || 'form'}.jpg`;
}