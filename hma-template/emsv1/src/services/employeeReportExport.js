// employeeReportExport.js — Excel/Word writers for the Staff & Payroll report
// builder (individual employee) and the HR consolidated multi-employee sheet.
// Visual system (navy/blue palette, thin grey borders) matches the PMS
// project report (ReportBuilderPanel.jsx) so all HMA reports read as one family.
import * as XLSX from 'xlsx-js-style'
import supabase from './supabase'
import { localAttendance } from './localAttendance'
import { computeCTC } from '../modules/ems/staff-payroll/ctcUtils'

const fmt = (n) =>
  (n || n === 0) && !isNaN(n)
    ? `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
    : '—'
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN') : '—')
const safeFileName = (name) => (name || 'report').replace(/[^\w\d-]+/g, '_').slice(0, 60)

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

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

// ── Individual employee report ─────────────────────────────────────────────

export const exportEmployeeExcel = (sections, employee) => {
  const wb = XLSX.utils.book_new()
  const name = employee.employee_name || employee.employee_id || 'Employee'
  const aoa = []
  const merges = []

  aoa.push([txt(name, styles.title), txt(employee.employee_id, styles.title)])
  aoa.push([txt('Staff Report', styles.sectionHead), txt('', styles.sectionHead)])
  aoa.push([])
  merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } })
  merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: 1 } })

  sections.forEach((section) => {
    merges.push({ s: { r: aoa.length, c: 0 }, e: { r: aoa.length, c: 1 } })
    aoa.push([txt(section.title, styles.sectionHead), txt('', styles.sectionHead)])

    if (section.kv?.length) {
      section.kv.forEach(([label, value, type]) => {
        aoa.push([
          txt(label, styles.label),
          type === 'currency' ? num(value, styles.value) : txt(value, styles.value),
        ])
      })
    }
    if (section.headers?.length) {
      if (section.tableTitle) {
        merges.push({ s: { r: aoa.length, c: 0 }, e: { r: aoa.length, c: 1 } })
        aoa.push([txt(section.tableTitle, styles.label), txt('', styles.label)])
      }
      const colCount = section.headers.length
      merges.push({
        s: { r: aoa.length, c: 0 },
        e: { r: aoa.length, c: Math.max(1, colCount - 1) },
      })
      aoa.push(section.headers.map((h) => txt(h, styles.tableHead)))
      const currencyCols = section.currencyCols || []
      if (section.rows.length) {
        section.rows.forEach((row, i) => {
          const isAlt = i % 2 === 1
          const cellStyle = { font: { sz: 10 }, border, ...rowFill(isAlt) }
          aoa.push(
            row.map((cell, c) =>
              currencyCols.includes(c) ? num(cell, cellStyle) : txt(cell, cellStyle),
            ),
          )
        })
      } else {
        merges.push({ s: { r: aoa.length, c: 0 }, e: { r: aoa.length, c: colCount - 1 } })
        aoa.push([txt('No data', styles.value)])
      }
    }
    if (!section.kv?.length && !section.headers?.length) {
      merges.push({ s: { r: aoa.length, c: 0 }, e: { r: aoa.length, c: 1 } })
      aoa.push([txt('No data', styles.value)])
    }
    aoa.push([])
  })

  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!merges'] = merges
  ws['!cols'] = [{ wch: 28 }, { wch: 36 }]
  XLSX.utils.book_append_sheet(wb, ws, 'Staff Report')
  XLSX.writeFile(wb, `${safeFileName(name)}_report.xlsx`)
}

export const exportEmployeeWord = (sections, employee) => {
  const escapeHtml = (v) =>
    String(v ?? '—')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  const name = employee.employee_name || employee.employee_id || 'Employee'
  const generatedOn = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const sectionHtml = sections
    .map((section) => {
      const kvRows = (section.kv || []).map(
        ([label, value, type]) =>
          `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(type === 'currency' ? fmt(value) : value)}</td></tr>`,
      )
      const tableHtml = section.headers?.length
        ? `${section.tableTitle ? `<h3>${escapeHtml(section.tableTitle)}</h3>` : ''}<table><tr>${section.headers
            .map((h) => `<th>${escapeHtml(h)}</th>`)
            .join('')}</tr>${
            section.rows.length
              ? section.rows
                  .map((row) => {
                    const currencyCols = section.currencyCols || []
                    return `<tr>${row
                      .map(
                        (cell, c) =>
                          `<td${currencyCols.includes(c) ? ' class="num"' : ''}>${escapeHtml(
                            currencyCols.includes(c) ? fmt(cell) : cell,
                          )}</td>`,
                      )
                      .join('')}</tr>`
                  })
                  .join('')
              : `<tr><td colspan="${section.headers.length}">No data</td></tr>`
          }</table>`
        : ''
      const kvTable = kvRows.length ? `<table>${kvRows.join('')}</table>` : ''
      return `<h2>${escapeHtml(section.title)}</h2>${kvTable}${tableHtml}`
    })
    .join('')

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(
    name,
  )} Report</title><style>
    body{font-family:Calibri,Arial,sans-serif;color:#1a1a1a;}
    h1{font-size:24pt;color:#1F4E79;margin:0 0 4px;}
    .subtitle{font-size:12pt;color:#2E75B6;margin:0 0 4px;}
    .generated{font-size:9pt;color:#666;margin:0 0 20px;}
    h2{font-size:13pt;color:#ffffff;background:#2E75B6;padding:6px 10px;margin:20px 0 0;}
    h3{font-size:10.5pt;color:#1F4E79;margin:10px 0 4px;}
    table{border-collapse:collapse;width:100%;margin:0 0 10px;}
    th,td{border:1px solid #B0B7C3;padding:5px 8px;font-size:10pt;text-align:left;}
    th{background:#EEF4FB;font-weight:bold;width:35%;}
    table th{width:35%;}
    table tr th{width:auto;}
    td.num{text-align:right;}
    tr:nth-child(even) td{background:#F7FAFD;}
  </style></head><body>
    <h1>${escapeHtml(name)}</h1>
    <p class="subtitle">${escapeHtml(employee.employee_id)} — Staff Report</p>
    <p class="generated">Report generated on ${generatedOn}</p>
    ${sectionHtml}
  </body></html>`

  const blob = new Blob(['﻿', html], { type: 'application/msword' })
  downloadBlob(blob, `${safeFileName(name)}_report.doc`)
}

// ── HR consolidated multi-employee sheet ────────────────────────────────────

const idealCtcOf = (employee) => {
  const salary = parseFloat(employee.current_salary || 0)
  if (!salary) return 0
  return computeCTC({ idealBasic: salary, tnd: 30, tndw: 30 }).ctc || 0
}

const CONSOLIDATED_COLUMNS = {
  personal: [
    { label: 'Employee ID', get: (e) => e.employee_id },
    { label: 'Full Name', get: (e) => e.employee_name },
    { label: 'Gender', get: (e) => e.gender },
    { label: 'Date of Birth', get: (e) => fmtDate(e.date_of_birth) },
    { label: 'Category', get: (e) => e.employee_category },
    { label: 'Status', get: (e) => e.status },
    { label: 'Joined Date', get: (e) => fmtDate(e.joined_date) },
  ],
  employment: [
    { label: 'Designation', get: (e) => e.employment?.designation },
    { label: 'Department', get: (e) => e.employment?.department },
    { label: 'Working Region', get: (e) => e.employment?.working_region },
    { label: 'Working State', get: (e) => e.employment?.working_state },
  ],
  contact: [
    { label: 'Working Email', get: (e) => e.contact?.working_email },
    { label: 'Mobile', get: (e) => e.contact?.mobile },
  ],
  address: [
    { label: 'Resident Location', get: (e) => e.address?.resident_location },
    { label: 'State', get: (e) => e.address?.state },
  ],
  projects: [
    {
      label: 'Current Project',
      get: (e) =>
        (e.project_assignments || []).find((a) => a.status === 'Active')?.project_name || '—',
    },
  ],
  salary: [
    { label: 'Current Salary', get: (e) => Number(e.current_salary) || 0, currency: true },
    { label: 'Ideal CTC', get: (e) => idealCtcOf(e), currency: true },
  ],
  documents: [{ label: 'Documents on File', get: (e) => e._documentsCount ?? 0 }],
  attendance: [
    { label: 'Present (this month)', get: (e) => e._attendance?.present_count ?? '—' },
    { label: 'Absent (this month)', get: (e) => e._attendance?.absent_count ?? '—' },
  ],
}

/** Batches document counts (one query) and attendance summaries (local, per-employee)
 *  onto each employee object as `_documentsCount` / `_attendance` before export. */
const enrichForConsolidated = async (employees, selectedKeys) => {
  if (selectedKeys.includes('documents')) {
    const ids = employees.map((e) => e.id)
    const { data } = await supabase
      .from('employee_documents')
      .select('employee_id')
      .in('employee_id', ids)
    const counts = {}
    ;(data || []).forEach((d) => {
      counts[d.employee_id] = (counts[d.employee_id] || 0) + 1
    })
    employees.forEach((e) => {
      e._documentsCount = counts[e.id] || 0
    })
  }
  if (selectedKeys.includes('attendance')) {
    const now = new Date()
    await Promise.all(
      employees.map(async (e) => {
        e._attendance = await localAttendance.getSummary(
          e.employee_id,
          now.getFullYear(),
          now.getMonth() + 1,
        )
      }),
    )
  }
  return employees
}

export const exportConsolidatedExcel = async (employees, selectedKeys) => {
  const enriched = await enrichForConsolidated(employees, selectedKeys)

  const columns = selectedKeys.flatMap((key) => CONSOLIDATED_COLUMNS[key] || [])
  const headers = ['#', ...columns.map((c) => c.label)]

  const aoa = []
  const merges = [{ s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } }]
  aoa.push([
    txt('HR Consolidated Staff Report', styles.title),
    ...Array(headers.length - 1).fill(txt('', styles.title)),
  ])
  aoa.push(headers.map((h) => txt(h, styles.tableHead)))

  const currencyColIdx = []
  columns.forEach((c, i) => {
    if (c.currency) currencyColIdx.push(i + 1) // +1 offsets the '#' column
  })

  enriched.forEach((e, i) => {
    const isAlt = i % 2 === 1
    const cellStyle = { font: { sz: 10 }, border, ...rowFill(isAlt) }
    aoa.push([
      txt(i + 1, cellStyle),
      ...columns.map((c, ci) =>
        currencyColIdx.includes(ci + 1) ? num(c.get(e), cellStyle) : txt(c.get(e), cellStyle),
      ),
    ])
  })

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!merges'] = merges
  ws['!cols'] = [{ wch: 5 }, ...columns.map(() => ({ wch: 20 }))]
  XLSX.utils.book_append_sheet(wb, ws, 'Staff Report')
  XLSX.writeFile(wb, `HR_Consolidated_Staff_Report_${new Date().toISOString().slice(0, 10)}.xlsx`)
}

export const CONSOLIDATED_SECTIONS = [
  { key: 'personal', label: 'Personal Info' },
  { key: 'employment', label: 'Employment' },
  { key: 'contact', label: 'Contact' },
  { key: 'address', label: 'Address' },
  { key: 'projects', label: 'Projects' },
  { key: 'salary', label: 'Salary & CTC' },
  { key: 'documents', label: 'Documents Summary' },
  { key: 'attendance', label: 'Attendance (current month)' },
]
