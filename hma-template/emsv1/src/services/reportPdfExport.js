// reportPdfExport.js — PDF writer for the Reports hub's new reports
// (Forecast Expense, Attendance, Payroll). New capability for this
// codebase — no PDF generation existed anywhere before. Uses jsPDF +
// jspdf-autotable, matching the navy/blue visual system the Excel/Word
// writers already use so all HMA reports read as one family.
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { fmt, safeFileName } from './reportExportStyles'

const NAVY_RGB = [31, 78, 121]
const BLUE_RGB = [46, 117, 182]
const LIGHT_RGB = [238, 244, 251]

const drawHeader = (doc, title, subtitle) => {
  const pageWidth = doc.internal.pageSize.getWidth()
  doc.setFillColor(...NAVY_RGB)
  doc.rect(0, 0, pageWidth, subtitle ? 22 : 16, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text(title, 14, 11)
  if (subtitle) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text(subtitle, 14, 18)
  }
  doc.setTextColor(0, 0, 0)
}

export const exportSectionsToPdf = (sections, { title, subtitle, filename }) => {
  const doc = new jsPDF()
  const headerHeight = subtitle ? 22 : 16
  drawHeader(doc, title, subtitle)

  let cursorY = headerHeight + 8

  sections.forEach((section) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...BLUE_RGB)
    doc.text(section.title, 14, cursorY)
    doc.setTextColor(0, 0, 0)
    cursorY += 4

    if (section.kv?.length) {
      autoTable(doc, {
        startY: cursorY,
        margin: { top: headerHeight + 4 },
        head: [],
        body: section.kv.map(([label, value, type]) => [
          label,
          type === 'currency' ? fmt(value) : (value ?? '—'),
        ]),
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 2 },
        columnStyles: { 0: { fontStyle: 'bold', fillColor: [242, 242, 242], cellWidth: 60 } },
        didDrawPage: () => drawHeader(doc, title, subtitle),
      })
      cursorY = (doc.lastAutoTable?.finalY || cursorY) + 8
    }

    if (section.headers?.length) {
      const currencyCols = section.currencyCols || []
      autoTable(doc, {
        startY: cursorY,
        margin: { top: headerHeight + 4 },
        head: [section.headers],
        body: section.rows.length
          ? section.rows.map((row) =>
              row.map((cell, c) => (currencyCols.includes(c) ? fmt(cell) : (cell ?? '—'))),
            )
          : [
              [
                {
                  content: 'No data',
                  colSpan: section.headers.length,
                  styles: { halign: 'center' },
                },
              ],
            ],
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: BLUE_RGB, textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: LIGHT_RGB },
        didParseCell: (data) => {
          if (data.section === 'body' && currencyCols.includes(data.column.index)) {
            data.cell.styles.halign = 'right'
          }
        },
        didDrawPage: () => drawHeader(doc, title, subtitle),
      })
      cursorY = (doc.lastAutoTable?.finalY || cursorY) + 8
    }

    if (!section.kv?.length && !section.headers?.length) {
      doc.setFontSize(9)
      doc.text('No data', 14, cursorY)
      cursorY += 8
    }

    if (cursorY > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage()
      drawHeader(doc, title, subtitle)
      cursorY = headerHeight + 8
    }
  })

  doc.save(`${safeFileName(filename || title)}.pdf`)
}
