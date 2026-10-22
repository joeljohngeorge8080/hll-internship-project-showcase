export const ACTIVITY_OPTIONS = [
  { value: 'conveyance', label: 'Conveyance' },
  { value: 'trainers_refreshment', label: 'Trainers Refreshment' },
  { value: 'lodging', label: 'Lodging' },
  { value: 'printing_stationery', label: 'Printing and Stationary' },
  { value: 'project_team_salary', label: 'Project Team Salary' },
  { value: 'procurement_materials', label: 'Procurement of Materials' },
  { value: 'courier_charges', label: 'Courier Charges' },
  { value: 'long_distance_travel', label: 'Long Distance Travel' },
  { value: 'beneficiary_refreshment', label: 'Beneficiary Refreshment' },
  { value: 'video_documentation', label: 'Video Documentation' },
  { value: 'digital_information_system', label: 'Digital Information System' },
  { value: 'rent', label: 'Rent' },
  { value: 'computer_hiring_charges', label: 'Computer Hiring Charges' },
  { value: 'coreteam_salary', label: 'Coreteam Salary' },
  { value: 'inauguration_expense', label: 'Inauguration Expense' },
  { value: 'cost_of_mcup', label: 'Cost of M-Cup' },
  { value: 'internet_charges', label: 'Internet Charges' },
  { value: 'other', label: 'Other' },
]

/** Display label for a stored activity value — the custom-typed name when
 * `value` is 'other', otherwise the matching option's label. */
export const activityLabelOf = (value, otherName) => {
  if (value === 'other') return (otherName || '').trim() || 'Other'
  return ACTIVITY_OPTIONS.find((a) => a.value === value)?.label || value
}

/** Lowercase, whitespace-collapsed, '&'→'and', punctuation-stripped compare key —
 * the normalisation used by both the exact-match tier and the alias table below,
 * so 'Printing & Stationary' and 'printing and stationary' land on the same key. */
export const normalizeActivityText = (raw) =>
  (raw || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** Explicit, reviewable map for known source-sheet spelling variants and typos
 * that don't normalise onto an ACTIVITY_OPTIONS label on their own (plan
 * §5, tier 2). Keys are already run through normalizeActivityText. */
export const ACTIVITY_ALIASES = {
  'projec team salary': 'project_team_salary', // typo in source sheets ("Projec")
  'vedio documentation': 'video_documentation', // typo in source sheets ("Vedio")
  'courier and postal': 'courier_charges',
}

/** Three-tier resolution of a raw Excel activity string to an ACTIVITY_OPTIONS
 * value (plan §5): exact normalised match, then the alias table, then null
 * (unmatched — caller must ask the PO to map it). Never guesses. */
export const resolveActivity = (raw) => {
  const key = normalizeActivityText(raw)
  if (!key) return null
  const exact = ACTIVITY_OPTIONS.find((a) => normalizeActivityText(a.label) === key)
  if (exact) return exact.value
  if (ACTIVITY_ALIASES[key]) return ACTIVITY_ALIASES[key]
  return null
}
