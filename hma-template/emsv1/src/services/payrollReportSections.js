// payrollReportSections.js — Reports-hub section builder for the Payroll
// report. Covers all active employees (salary_details has no division
// restriction — HR edits it per-employee regardless of category, confirmed
// via MonthlySalaryDetailsTab.jsx), reusing computeEffectiveCTC (with any
// HR-pinned ctcOverrides) rather than reimplementing payroll math. Employees
// with no salary_details record for the requested month are reported as
// "No data entered", never a fabricated ₹0.
import { localEmployees } from './localEmployees'
import { localSalaryDetails } from './localSalaryDetails'
import { computeEffectiveCTC, STATE_PT_MAP } from '../modules/ems/staff-payroll/ctcUtils'

const CHUNK_SIZE = 20
const chunk = (arr, size) =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size),
  )

const effectivePtOf = (details) => {
  const derivedPT = details.stateForPT ? (STATE_PT_MAP[details.stateForPT] ?? 0) : 0
  return details.ptAuto ? derivedPT : Number(details.ptOverride) || 0
}

export const buildPayrollSections = async ({ year, month }) => {
  const { items: employees } = await localEmployees.list({ status: 'Active', pageSize: 2000 })

  const rowsByEmployee = []
  for (const batch of chunk(employees, CHUNK_SIZE)) {
    const details = await Promise.all(
      batch.map((e) => localSalaryDetails.get(e.employee_id, year, month)),
    )
    batch.forEach((emp, i) => rowsByEmployee.push({ emp, details: details[i] }))
  }

  const withCalc = rowsByEmployee.map(({ emp, details }) => {
    if (!details || !details.idealBasic) return { emp, details, calc: null }
    const calc = computeEffectiveCTC(
      {
        idealBasic: Number(details.idealBasic),
        da: Number(details.da),
        tnd: Number(details.tnd),
        tndw: Number(details.tndw),
        pt: effectivePtOf(details),
        recovery: Number(details.recovery),
        centreInchargeAllowance: Number(details.centreInchargeAllowance),
        rsoAllowance: Number(details.rsoAllowance) || 0,
      },
      details.ctcOverrides || {},
    )
    return { emp, details, calc }
  })

  const withData = withCalc.filter((r) => r.calc)
  const missingCount = withCalc.length - withData.length

  const totalGross = withData.reduce((s, r) => s + (r.calc.actualGross || 0), 0)
  const totalDeduction = withData.reduce((s, r) => s + (r.calc.totalDeduction || 0), 0)
  const totalNet = withData.reduce((s, r) => s + (r.calc.netSalary || 0), 0)
  const totalCtc = withData.reduce((s, r) => s + (r.calc.ctc || 0), 0)

  return [
    {
      key: 'perEmployee',
      title: 'Per-Employee Payroll Breakdown',
      headers: [
        'Employee',
        'Department',
        'Basic',
        'DA',
        'HRA',
        'Gross',
        'Deductions',
        'Net Salary',
        'CTC',
        'Status',
      ],
      rows: withCalc.map(({ emp, calc }) =>
        calc
          ? [
              emp.employee_name || emp.employee_id,
              emp.employment?.department || '—',
              calc.actualBasic,
              calc.actualDA,
              calc.actualHRA,
              calc.actualGross,
              calc.totalDeduction,
              calc.netSalary,
              calc.ctc,
              'OK',
            ]
          : [
              emp.employee_name || emp.employee_id,
              emp.employment?.department || '—',
              0,
              0,
              0,
              0,
              0,
              0,
              0,
              'No data entered',
            ],
      ),
      currencyCols: [2, 3, 4, 5, 6, 7, 8],
    },
    {
      key: 'orgTotals',
      title: 'Org Totals',
      kv: [
        ['Employees with Payroll Data', withData.length],
        ['Employees Missing This Month', missingCount],
        ['Total Gross', totalGross, 'currency'],
        ['Total Deductions', totalDeduction, 'currency'],
        ['Total Net Salary', totalNet, 'currency'],
        ['Total CTC', totalCtc, 'currency'],
      ],
    },
  ]
}

export const PAYROLL_SECTION_DEFS = [
  { key: 'perEmployee', label: 'Per-Employee Payroll Breakdown' },
  { key: 'orgTotals', label: 'Org Totals' },
]
