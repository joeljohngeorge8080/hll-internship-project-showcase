// employeeReportSections.js — builds the checklist-selectable report sections
// for Staff & Payroll, mirroring reportSections.js's shape (kv facts and/or
// a headers/rows table per section) so both the individual employee report
// and the HR consolidated sheet read from one place.
import supabase from './supabase'
import { localAttendance } from './localAttendance'
import { computeCTC } from '../modules/ems/staff-payroll/ctcUtils'

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN') : '—')

const resolveManagerName = async (reportingToId) => {
  if (!reportingToId) return ''
  const { data } = await supabase
    .from('employees')
    .select('employee_id, first_name, last_name')
    .eq('id', reportingToId)
    .maybeSingle()
  if (!data) return ''
  return `${data.employee_id} — ${[data.first_name, data.last_name].filter(Boolean).join(' ')}`
}

/** Document metadata only (no file bytes) — employee_documents rows for this employee. */
const listDocuments = async (employeeId) => {
  const { data, error } = await supabase
    .from('employee_documents')
    .select('doc_type, storage_path, uploaded_at')
    .eq('employee_id', employeeId)
    .order('uploaded_at', { ascending: false })
  if (error) return []
  return data || []
}

const idealCtcOf = (employee) => {
  const salary = parseFloat(employee.current_salary || 0)
  if (!salary) return 0
  return computeCTC({ idealBasic: salary, tnd: 30, tndw: 30 }).ctc || 0
}

export const REPORT_SECTIONS = [
  { key: 'personal', label: 'Personal Info' },
  { key: 'employment', label: 'Employment' },
  { key: 'contact', label: 'Contact' },
  { key: 'address', label: 'Address' },
  { key: 'projects', label: 'Projects' },
  { key: 'salary', label: 'Salary & CTC' },
  { key: 'documents', label: 'Documents Summary' },
  { key: 'attendance', label: 'Attendance (current month)' },
]

/** Builds every possible section for one employee; caller filters by selected keys. */
export const buildEmployeeSections = async (employee) => {
  const managerName = await resolveManagerName(employee.employment?.reporting_to)
  const documents = await listDocuments(employee.id)
  const now = new Date()
  const attendanceSummary = await localAttendance.getSummary(
    employee.employee_id,
    now.getFullYear(),
    now.getMonth() + 1,
  )
  const currentAssignment =
    (employee.project_assignments || []).find((a) => a.status === 'Active') || null

  return [
    {
      key: 'personal',
      title: 'Personal Info',
      kv: [
        ['Employee ID', employee.employee_id],
        ['Full Name', employee.employee_name],
        ['Gender', employee.gender],
        ['Date of Birth', fmtDate(employee.date_of_birth)],
        ['Marital Status', employee.marital_status],
        ['Blood Group', employee.blood_group],
        ['Category', employee.employee_category],
        ['Status', employee.status],
        ['Joined Date', fmtDate(employee.joined_date)],
        ['Exit Date', employee.exit_date ? fmtDate(employee.exit_date) : ''],
      ].filter(([, v]) => v),
    },
    {
      key: 'employment',
      title: 'Employment',
      kv: [
        ['Designation', employee.employment?.designation],
        ['Department', employee.employment?.department],
        ['Reporting To', managerName],
        ['Working Region', employee.employment?.working_region],
        ['Working State', employee.employment?.working_state],
        ['Start Date', fmtDate(employee.employment?.start_date)],
        ['End Date', employee.employment?.end_date ? fmtDate(employee.employment.end_date) : ''],
      ].filter(([, v]) => v),
    },
    {
      key: 'contact',
      title: 'Contact',
      kv: [
        ['Personal Email', employee.contact?.personal_email],
        ['Working Email', employee.contact?.working_email],
        ['Mobile', employee.contact?.mobile],
        ['Phone', employee.contact?.phone],
        ['Emergency Contact', employee.contact?.emergency_contact],
      ].filter(([, v]) => v),
    },
    {
      key: 'address',
      title: 'Address',
      kv: [
        ['Resident Location', employee.address?.resident_location],
        ['State', employee.address?.state],
        ['Present Address', employee.address?.present_address],
        ['Permanent Address', employee.address?.permanent_address],
      ].filter(([, v]) => v),
    },
    {
      key: 'projects',
      title: 'Projects',
      headers: ['Project', 'Assigned Date', 'End Date', 'Status', 'Assigned By', 'Remarks'],
      rows: (employee.project_assignments || []).map((a) => [
        a.project_name,
        fmtDate(a.assigned_date),
        a.end_date ? fmtDate(a.end_date) : '—',
        a.status,
        a.assigned_by || '—',
        a.remarks || '—',
      ]),
    },
    {
      key: 'salary',
      title: 'Salary & CTC',
      kv: [
        ['Current Salary', employee.current_salary, 'currency'],
        ['Ideal CTC (Full Attendance)', idealCtcOf(employee), 'currency'],
      ],
      tableTitle: 'Salary History',
      headers: ['Effective Date', 'Previous Salary', 'New Salary', 'Increment %', 'Remarks'],
      currencyCols: [1, 2],
      rows: (employee.salary_history || []).map((s) => [
        fmtDate(s.effective_date),
        s.previous_salary,
        s.new_salary,
        s.increment_percentage != null ? `${s.increment_percentage}%` : '—',
        s.remarks || '—',
      ]),
    },
    {
      key: 'documents',
      title: 'Documents Summary',
      headers: ['Document Type', 'File', 'Uploaded'],
      rows: documents.map((d) => [
        d.doc_type || 'Other',
        (d.storage_path || '').split('/').pop(),
        fmtDate(d.uploaded_at),
      ]),
    },
    {
      key: 'attendance',
      title: 'Attendance (current month)',
      kv: attendanceSummary
        ? [
            ['Present', attendanceSummary.present_count],
            ['Absent', attendanceSummary.absent_count],
            ['Half Day', attendanceSummary.half_day_count],
            ['Late Days', attendanceSummary.late_days],
            ['On Leave', attendanceSummary.leave_count],
            ['Current Project', currentAssignment?.project_name || '—'],
          ]
        : [['Current Project', currentAssignment?.project_name || '—']],
    },
  ]
}

export default buildEmployeeSections
