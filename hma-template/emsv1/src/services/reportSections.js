import { localProjectExpenses } from './localProjectExpenses'
import { localProjectDocuments } from './localProjectDocuments'

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN') : '—')

// "2026-01" -> "Jan 2026" — matches MonthlyPlanPanel's own month labelling.
const monthLabel = (ym) => {
  if (!ym) return '—'
  const [y, m] = ym.split('-')
  return new Date(y, m - 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
}

// Mirrors MonthlyPlanPanel's PHASE_OPTIONS so the report reads the same
// phase names the Monthly Plan tab shows, not the raw stored code.
const PHASE_LABELS = {
  design: 'Design',
  implementation: 'Implementation',
  monitoring: 'Monitoring',
}
const phaseLabelOf = (v) => PHASE_LABELS[v] || v || '—'

const fmtSize = (bytes) => {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Table rows carry raw values (numbers stay numbers) plus a `currencyCols`
// index list, so the Excel export can emit real, summable number cells
// instead of pre-formatted "₹1,234" strings — the Word export still renders
// everything through fmt()/fmtDate() for display.
// Builds { key, title, kv } | { key, title, headers, rows, currencyCols } sections
// from the project's own record plus the small set of local services that hold
// data the project object doesn't (per-pool expenses, uploaded documents).
export const buildSections = async (project, officers) => {
  const out = []

  out.push({
    key: 'overview',
    title: 'Overview',
    kv: [
      ['Project Code', project.project_code],
      ['Project Type', project.project_type],
      ['Funding Agency', project.funding_agency],
      ['Implementing Partner', project.implementing_partner],
      ['Location', project.location],
      ['Status', project.status],
      ['Start Date', fmtDate(project.start_date)],
      ['End Date', fmtDate(project.end_date)],
      ['Description', project.description],
      ['Remarks', project.remarks],
    ].filter(([, v]) => v),
  })

  out.push({
    key: 'project_officer',
    title: 'Project Officer',
    headers: ['Name', 'Designation', 'Email', 'Phone'],
    rows: (officers || []).map((o) => [o.name, o.designation, o.email, o.phone]),
  })

  out.push({
    key: 'activity',
    title: 'Activity',
    headers: ['Description', 'Status', 'Target Date', 'Risk / Challenges'],
    rows: (project.activities || []).map((a) => [
      a.description,
      a.status,
      fmtDate(a.target_date),
      a.risk_challenges,
    ]),
  })

  const balance =
    (project.project_value || 0) -
    (project.expense_accounted || 0) -
    (project.committed_expense || 0)
  out.push({
    key: 'project_financials',
    title: 'Project Financials',
    kv: [
      ['Project Value', project.project_value, 'currency'],
      ['Amount Received', project.amount_received, 'currency'],
      ['Amount Spent', project.amount_spent, 'currency'],
      ['Expense Accounted', project.expense_accounted, 'currency'],
      ['Committed Expense', project.committed_expense, 'currency'],
      ['Balance', balance, 'currency'],
    ],
  })

  out.push({
    key: 'project_milestones',
    title: 'Project Milestones',
    headers: [
      'Installment',
      '%',
      'Amount',
      'Start Date',
      'End Date',
      'Payment Received',
      'UC Target Date',
      'Actual UC Submission',
      'UC Status',
    ],
    currencyCols: [2],
    rows: (project.installments || []).map((inst) => [
      inst.label,
      inst.percentage != null ? `${inst.percentage}%` : '—',
      parseFloat(inst.amount) || 0,
      fmtDate(inst.start_date),
      fmtDate(inst.end_date || inst.target_date),
      inst.payment_received_date ? fmtDate(inst.payment_received_date) : 'Not received',
      fmtDate(inst.uc_target_date),
      inst.actual_uc_submission_date ? fmtDate(inst.actual_uc_submission_date) : 'Not submitted',
      inst.uc_status || 'Pending',
    ]),
  })

  const poolTotal = (pool) =>
    localProjectExpenses
      .list({ projectId: project.id, pool })
      .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0)
  out.push({
    key: 'budget_payroll',
    title: 'Budget & Payroll',
    kv: [
      ['Admin Pool %', project.admin_pct ?? 5],
      ['HR Pool %', project.hr_pct ?? 5],
      ['Core Pool %', project.core_pct ?? 5],
      ['Admin Pool Spent', poolTotal('admin'), 'currency'],
      ['HR Pool Spent', poolTotal('hr'), 'currency'],
      ['Core Pool Spent', poolTotal('core'), 'currency'],
    ],
  })

  // Detailed rows per task, plus a subtotal row closing out each month and a
  // grand-total row closing out the table — "briefed" so a reader can scan
  // month-by-month totals without adding up every task line by hand.
  const monthlyPlanRows = []
  const monthlyPlanSummaryRows = []
  let grandPlanned = 0
  let grandActual = 0
  ;(project.monthly_plan || []).forEach((m) => {
    let monthPlanned = 0
    let monthActual = 0
    ;(m.phases || []).forEach((ph) => {
      const planned = parseFloat(ph.amount) || 0
      const actual = parseFloat(ph.actual) || 0
      monthPlanned += planned
      monthActual += actual
      monthlyPlanRows.push([
        monthLabel(m.month),
        phaseLabelOf(ph.phase),
        ph.label,
        planned,
        actual,
        planned - actual,
      ])
    })
    grandPlanned += monthPlanned
    grandActual += monthActual
    monthlyPlanSummaryRows.push(monthlyPlanRows.length)
    monthlyPlanRows.push([
      `${monthLabel(m.month)} — Subtotal`,
      '',
      '',
      monthPlanned,
      monthActual,
      monthPlanned - monthActual,
    ])
  })
  if (monthlyPlanRows.length) {
    monthlyPlanSummaryRows.push(monthlyPlanRows.length)
    monthlyPlanRows.push([
      'GRAND TOTAL',
      '',
      '',
      grandPlanned,
      grandActual,
      grandPlanned - grandActual,
    ])
  }
  out.push({
    key: 'monthly_plan',
    title: 'Monthly Plan',
    headers: ['Month', 'Phase', 'Task', 'Planned', 'Actual', 'Variance'],
    currencyCols: [3, 4, 5],
    summaryRows: monthlyPlanSummaryRows,
    rows: monthlyPlanRows,
  })

  out.push({
    key: 'expenses',
    title: 'Expenses',
    headers: ['Date', 'Pool', 'Month', 'Label', 'Amount', 'Logged By'],
    currencyCols: [4],
    rows: localProjectExpenses
      .list({ projectId: project.id })
      .map((e) => [
        fmtDate(e.createdAt),
        e.pool,
        e.month,
        e.label,
        parseFloat(e.amount) || 0,
        e.createdBy,
      ]),
  })

  const documents = await localProjectDocuments.list(project.id).catch(() => [])
  out.push({
    key: 'upload',
    title: 'Upload',
    headers: ['File Name', 'Type', 'Size', 'Uploaded By', 'Date'],
    rows: (documents || []).map((d) => [
      d.file_name,
      d.mime_type || 'Unknown',
      fmtSize(d.size_bytes),
      d.uploaded_by_name,
      fmtDate(d.uploaded_at),
    ]),
    // Raw document rows (not just table cells) — the Word export uses this
    // to fetch and embed actual image bytes, keyed off mime_type.
    documents: documents || [],
  })

  return out
}

export default buildSections
