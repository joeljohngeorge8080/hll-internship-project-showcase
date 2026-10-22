// reportExcelExport.js — generic Excel writer for the Reports hub's new
// reports (Forecast Expense, Attendance, Payroll). Same section-rendering
// loop as employeeReportExport.js:exportEmployeeExcel, generalized to take a
// title/subtitle instead of an employee object.
import * as XLSX from 'xlsx-js-style'
import { styles, border, rowFill, txt, num, safeFileName } from './reportExportStyles'

export const exportSectionsToExcel = (sections, { title, subtitle, filename }) => {
  const wb = XLSX.utils.book_new()
  const aoa = []
  const merges = []

  aoa.push([txt(title, styles.title), txt('', styles.title)])
  merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } })
  if (subtitle) {
    aoa.push([txt(subtitle, styles.sectionHead), txt('', styles.sectionHead)])
    merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: 1 } })
  }
  aoa.push([])

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
  XLSX.utils.book_append_sheet(wb, ws, safeFileName(title).slice(0, 31))
  XLSX.writeFile(wb, `${safeFileName(filename || title)}.xlsx`)
}
