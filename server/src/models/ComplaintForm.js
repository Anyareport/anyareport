import mongoose from 'mongoose';

const complaintFormSchema = new mongoose.Schema(
  {
    complainantName: { type: String, default: '' },
    contactNumber: { type: String, default: '' },
    caseNo: { type: String, default: '' },
    caseFor: { type: String, default: '' },
    respondentName: { type: String, default: '' },
    narrative: { type: String, default: '' },
    relief: { type: String, default: '' },
    madeDay: { type: String, default: '' },
    madeMonth: { type: String, default: '' },
    madeYear: { type: String, default: '' },
    receivedDay: { type: String, default: '' },
    receivedMonth: { type: String, default: '' },
    receivedYear: { type: String, default: '' },
    image: { type: String, required: true },
    createdBy: { type: String, required: true },
  },
  { timestamps: true }
);

export default mongoose.model('ComplaintForm', complaintFormSchema);
