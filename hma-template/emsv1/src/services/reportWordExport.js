// reportWordExport.js — generic Word writer for the Reports hub's new
// reports. Same HTML-string-as-.doc-Blob trick as
// employeeReportExport.js:exportEmployeeWord, generalized to take a
// title/subtitle instead of an employee object.
import { fmt, safeFileName, downloadBlob } from './reportExportStyles'

const escapeHtml = (v) =>
  String(v ?? '—')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

export const exportSectionsToWord = (sections, { title, subtitle, filename }) => {
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
    title,
  )}</title><style>
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
    <h1>${escapeHtml(title)}</h1>
    ${subtitle ? `<p class="subtitle">${escapeHtml(subtitle)}</p>` : ''}
    <p class="generated">Report generated on ${generatedOn}</p>
    ${sectionHtml}
  </body></html>`

  const blob = new Blob(['﻿', html], { type: 'application/msword' })
  downloadBlob(blob, `${safeFileName(filename || title)}.doc`)
}
