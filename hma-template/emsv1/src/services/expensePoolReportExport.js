// expensePoolReportExport.js — Excel writer for the Expence Booking report
// (HR / Admin / Core pools). Visual system (navy/blue palette, thin grey
// borders) matches the Staff Report and PMS project report so all HMA
// reports read as one family.
import * as XLSX from 'xlsx-js-style'

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN') : '—')

const edge = { style: 'thin', color: { rgb: 'B0B7C3' } }
const border = { top: edge, bottom: edge, left: edge, right: edge }
const NAVY = '1F4E79'
const BLUE = '2E75B6'
const styles = {
  title: {
    font: { bold: true, sz: 16, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: NAVY } },
    alignment: { horizontal: 'center', vertical: 'center' },
  },
  sectionHead: {
    font: { bold: true, sz: 12, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: BLUE } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border,
  },
  label: { font: { bold: true, sz: 10 }, fill: { fgColor: { rgb: 'F2F2F2' } }, border },
  value: { font: { sz: 10 }, border, alignment: { horizontal: 'left' } },
  tableHead: {
    font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: BLUE } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border,
  },
}
const rowFill = (isAlt) => (isAlt ? { fill: { fgColor: { rgb: 'EEF4FB' } } } : {})
const MONEY = '#,##0'
const txt = (v, s) => ({ v: v === null || v === undefined || v === '' ? '—' : v, t: 's', s })
const num = (v, s) => ({ v: Number(v) || 0, t: 'n', z: MONEY, s })

const REVENUE_SOURCE_LABELS = {
  hr_revenue: 'HR Revenue',
  lsgb_revenue: 'LSGB Revenue',
  admin_pool: 'Admin 5% Share',
}

const sourceLabels = (expense, poolFundLabel) =>
  (expense.revenue_sources || [])
    .map((s) => (s === 'project_pool' ? poolFundLabel : REVENUE_SOURCE_LABELS[s] || s))
    .join(', ')

const EXPENSE_HEADERS = [
  'Date',
  'Expense',
  'Vendor',
  'Revenue Source(s)',
  'Amount',
  'Bill No',
  'Notes',
]
const COL_WIDTHS = [
  { wch: 12 },
  { wch: 24 },
  { wch: 18 },
  { wch: 26 },
  { wch: 14 },
  { wch: 14 },
  { wch: 26 },
]

// Builds one sheet for a pool: a revenue summary block, then the expense table.
const buildPoolSheet = (pool) => {
  const { label, poolFundLabel, revenueRows, expenses } = pool
  const aoa = []
  const merges = []
  const headerCols = EXPENSE_HEADERS.length

  merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: headerCols - 1 } })
  aoa.push([
    txt(`${label} Pool — Expence Booking Report`, styles.title),
    ...Array(headerCols - 1).fill(txt('', styles.title)),
  ])

  merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: headerCols - 1 } })
  aoa.push([
    txt('Revenue Summary', styles.sectionHead),
    ...Array(headerCols - 1).fill(txt('', styles.sectionHead)),
  ])

  const totalBooked = expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0)
  ;[...revenueRows, ['Total Booked', totalBooked]].forEach(([rowLabel, value]) => {
    merges.push({ s: { r: aoa.length, c: 1 }, e: { r: aoa.length, c: headerCols - 1 } })
    aoa.push([
      txt(rowLabel, styles.label),
      num(value, styles.value),
      ...Array(headerCols - 2).fill(txt('', styles.value)),
    ])
  })

  aoa.push([])

  merges.push({ s: { r: aoa.length, c: 0 }, e: { r: aoa.length, c: headerCols - 1 } })
  aoa.push([
    txt('Booked Expenses', styles.sectionHead),
    ...Array(headerCols - 1).fill(txt('', styles.sectionHead)),
  ])
  aoa.push(EXPENSE_HEADERS.map((h) => txt(h, styles.tableHead)))

  expenses.forEach((exp, i) => {
    const isAlt = i % 2 === 1
    const cellStyle = { font: { sz: 10 }, border, ...rowFill(isAlt) }
    aoa.push([
      txt(fmtDate(exp.date), cellStyle),
      txt(exp.label, cellStyle),
      txt(exp.vendor, cellStyle),
      txt(sourceLabels(exp, poolFundLabel), cellStyle),
      num(exp.amount, cellStyle),
      txt(exp.bill_no, cellStyle),
      txt(exp.notes, cellStyle),
    ])
  })

  if (!expenses.length) {
    merges.push({ s: { r: aoa.length, c: 0 }, e: { r: aoa.length, c: headerCols - 1 } })
    aoa.push([
      txt('No expenses booked.', { font: { sz: 10, italic: true }, border }),
      ...Array(headerCols - 1).fill(txt('', { border })),
    ])
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!merges'] = merges
  ws['!cols'] = COL_WIDTHS
  return ws
}

// pools: [{ key, label, poolFundLabel, revenueRows: [[label, value], ...], expenses: [...] }]
export const exportExpensePoolReport = (pools) => {
  const wb = XLSX.utils.book_new()
  pools.forEach((pool) => {
    XLSX.utils.book_append_sheet(wb, buildPoolSheet(pool), pool.label)
  })
  XLSX.writeFile(wb, `Expence_Booking_Report_${new Date().toISOString().slice(0, 10)}.xlsx`)
}
