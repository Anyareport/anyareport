export const VALID_CATEGORIES = [
  'Public Concerns',
  'Blotter Cases',
  'Emergency Situations',
];

export const SUBCATEGORY_MAP = {
  'Public Concerns': ['Sanitation', 'Infrastructure'],
  'Blotter Cases': ['Civil', 'Criminal'],
  'Emergency Situations': ['Public', 'Private'],
};

export const VALID_SEVERITIES = ['Low', 'Medium', 'High', 'Critical'];

export function getReportClassificationError({ category, subcategory, severity }) {
  if (!VALID_CATEGORIES.includes(category)) {
    return 'Invalid report category';
  }
  if (!SUBCATEGORY_MAP[category].includes(subcategory)) {
    return 'Invalid subcategory for report category';
  }
  if (!VALID_SEVERITIES.includes(severity)) {
    return 'Invalid report severity';
  }
  if (category === 'Emergency Situations' && severity === 'Low') {
    return 'Emergency reports cannot have Low severity';
  }

  return null;
}
