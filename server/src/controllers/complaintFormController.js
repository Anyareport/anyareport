import ComplaintForm from '../models/ComplaintForm.js';
import { writeAudit } from '../services/auditLog.js';

const fields = [
  'complainantName',
  'contactNumber',
  'caseNo',
  'caseFor',
  'respondentName',
  'narrative',
  'relief',
  'madeDay',
  'madeMonth',
  'madeYear',
  'receivedDay',
  'receivedMonth',
  'receivedYear',
];

function readForm(body) {
  const form = {};
  for (const field of fields) {
    if (typeof body?.[field] !== 'string') {
      return { error: `Complaint form field "${field}" must be text` };
    }
    form[field] = body[field];
  }
  if (
    typeof body?.image !== 'string' ||
    !body.image.startsWith('data:image/jpeg;base64,') ||
    body.image.length > 5_000_000
  ) {
    return { error: 'A valid complaint form JPEG is required' };
  }
  form.image = body.image;
  return { form };
}

export async function listManualComplaintForms(req, res) {
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const query = search
    ? {
        $or: fields
          .filter((field) => ['complainantName', 'caseNo', 'caseFor'].includes(field))
          .map((field) => ({ [field]: new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') })),
      }
    : {};
  const forms = await ComplaintForm.find(query)
    .select('_id caseNo caseFor complainantName updatedAt')
    .sort({ updatedAt: -1 })
    .limit(200)
    .lean();
  res.json(
    forms.map((form) => ({
      ...form,
      referenceNumber: form.caseNo || null,
      category: form.caseFor,
      subcategory: null,
      source: 'manual',
    }))
  );
}

export async function getManualComplaintForm(req, res) {
  const form = await ComplaintForm.findById(req.params.id).lean();
  if (!form) return res.status(404).json({ error: 'Complaint form not found' });
  res.json(form);
}

export async function createManualComplaintForm(req, res) {
  const { form, error } = readForm(req.body);
  if (error) return res.status(400).json({ error });
  const saved = await ComplaintForm.create({ ...form, createdBy: req.firebaseUser.uid });
  await writeAudit('complaint_form_saved', { req, metadata: { manual: true, complaintFormId: saved._id } });
  res.status(201).json(saved);
}

export async function updateManualComplaintForm(req, res) {
  const { form, error } = readForm(req.body);
  if (error) return res.status(400).json({ error });
  const saved = await ComplaintForm.findByIdAndUpdate(
    req.params.id,
    { $set: form },
    { new: true, runValidators: true }
  );
  if (!saved) return res.status(404).json({ error: 'Complaint form not found' });
  await writeAudit('complaint_form_saved', {
    req,
    metadata: { manual: true, complaintFormId: saved._id },
  });
  res.json(saved);
}
