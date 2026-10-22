import React, { useState } from 'react'
import PropTypes from 'prop-types'
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CFormCheck,
  CFormLabel,
  CFormSelect,
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilCloudDownload, cilBolt } from '@coreui/icons'
import * as XLSX from 'xlsx-js-style'
import { localProjectDocuments } from '../../../services/localProjectDocuments'
import { buildSections } from '../../../services/reportSections'
import { generateNarrative } from '../../../services/aiReport'

const SECTIONS = [
  { key: 'overview', label: 'Overview' },
  { key: 'project_officer', label: 'Project Officer' },
  { key: 'activity', label: 'Activity' },
  { key: 'project_financials', label: 'Project Financials' },
  { key: 'project_milestones', label: 'Project Milestones' },
  { key: 'budget_payroll', label: 'Budget & Payroll' },
  { key: 'monthly_plan', label: 'Monthly Plan' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'upload', label: 'Upload' },
]

const fmt = (n) =>
  (n || n === 0) && !isNaN(n)
    ? `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
    : '—'

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN') : '—')

const safeFileName = (name) => (name || 'project').replace(/[^\w\d-]+/g, '_').slice(0, 60)

// Downloads each image-typed upload from Supabase Storage and inlines it as
// a base64 data URI so the Word export can embed the actual photo instead of
// just listing the file name. Non-image files (PDFs, docs, …) are left out —
// they still show up in the Upload section's file table.
const fetchUploadImages = async (documents) => {
  const imageDocs = (documents || []).filter((d) => (d.mime_type || '').startsWith('image/'))
  const images = await Promise.all(
    imageDocs.map(async (d) => {
      try {
        const url = await localProjectDocuments.getDownloadUrl(d.storage_path)
        const res = await fetch(url)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const blob = await res.blob()
        const dataUri = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result)
          reader.onerror = () => reject(reader.error)
          reader.readAsDataURL(blob)
        })
        return {
          name: d.file_name,
          dataUri,
          uploadedBy: d.uploaded_by_name,
          uploadedAt: d.uploaded_at,
        }
      } catch {
        // Skip images that fail to load (expired link, network error, etc.)
        // rather than failing the whole report.
        return null
      }
    }),
  )
  return images.filter(Boolean)
}

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

// Cell styles shared with MonthlyPlanPanel's export so both reports read as
// one visual system (navy/blue palette, thin grey borders, alt-row tint).
const edge = { style: 'thin', color: { rgb: 'B0B7C3' } }
const border = { top: edge, bottom: edge, left: edge, right: edge }
const NAVY = '1F4E79'
const BLUE = '2E75B6'
const xlsxStyles = {
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
  total: { font: { bold: true, sz: 10 }, fill: { fgColor: { rgb: 'D9E2F3' } }, border },
}
const rowFill = (isAlt) => (isAlt ? { fill: { fgColor: { rgb: 'EEF4FB' } } } : {})
const MONEY = '#,##0'
const txt = (v, s) => ({ v: v === null || v === undefined || v === '' ? '—' : v, t: 's', s })
const num = (v, s) => ({ v: Number(v) || 0, t: 'n', z: MONEY, s })

const exportExcel = (sections, project) => {
  const wb = XLSX.utils.book_new()
  const projectName = project.name || project.project_code || 'Project'

  // Cover sheet — project header facts plus a linked index of the sheets
  // that follow, so opening the workbook doesn't just drop the reader on a
  // bare "Overview" tab with no context.
  const coverFacts = [
    ['Project Code', project.project_code],
    ['Funding Agency', project.funding_agency],
    ['Status', project.status],
    ['Location', project.location],
  ].filter(([, v]) => v)
  const coverAoa = [
    [txt(projectName, xlsxStyles.title), txt('', xlsxStyles.title)],
    [txt('Project Report', xlsxStyles.sectionHead), txt('', xlsxStyles.sectionHead)],
    [],
    ...coverFacts.map(([label, value]) => [
      txt(label, xlsxStyles.label),
      txt(value, xlsxStyles.value),
    ]),
    [],
    [
      txt(
        `Report generated on ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`,
        { font: { italic: true, sz: 9, color: { rgb: '666666' } } },
      ),
      txt('', {}),
    ],
    [],
    [txt('Contents', xlsxStyles.sectionHead), txt('', xlsxStyles.sectionHead)],
    ...sections.map((s) => [txt(s.title, xlsxStyles.value), txt('', xlsxStyles.value)]),
  ]
  const coverMerges = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } },
    {
      s: { r: coverAoa.length - sections.length - 1, c: 0 },
      e: { r: coverAoa.length - sections.length - 1, c: 1 },
    },
  ]
  const coverWs = XLSX.utils.aoa_to_sheet(coverAoa)
  coverWs['!merges'] = coverMerges
  coverWs['!cols'] = [{ wch: 26 }, { wch: 34 }]
  XLSX.utils.book_append_sheet(wb, coverWs, 'Cover')

  sections.forEach((section) => {
    const aoa = []
    const merges = []
    const colCount = section.headers?.length || 2
    const mergeFullRow = () =>
      merges.push({ s: { r: aoa.length, c: 0 }, e: { r: aoa.length, c: colCount - 1 } })

    mergeFullRow()
    aoa.push([
      txt(section.title, xlsxStyles.title),
      ...Array(colCount - 1).fill(txt('', xlsxStyles.title)),
    ])
    aoa.push([])

    if (section.kv) {
      section.kv.forEach(([label, value, type]) => {
        aoa.push([
          txt(label, xlsxStyles.label),
          type === 'currency' ? num(value, xlsxStyles.value) : txt(value, xlsxStyles.value),
        ])
      })
    } else {
      aoa.push(section.headers.map((h) => txt(h, xlsxStyles.tableHead)))

      const currencyCols = section.currencyCols || []
      const summaryRows = section.summaryRows || []
      if (section.rows.length) {
        section.rows.forEach((row, i) => {
          const isAlt = i % 2 === 1
          const cellStyle = summaryRows.includes(i)
            ? xlsxStyles.total
            : { font: { sz: 10 }, border, ...rowFill(isAlt) }
          aoa.push(
            row.map((cell, c) =>
              currencyCols.includes(c) ? num(cell, cellStyle) : txt(cell, cellStyle),
            ),
          )
        })
        // Sections that already close out their own subtotal/grand-total
        // rows (e.g. Monthly Plan) skip this — summing every row here would
        // double-count those rows' own totals.
        if (currencyCols.length && !summaryRows.length) {
          aoa.push(
            section.headers.map((_, c) => {
              if (c === 0) return txt('TOTAL', xlsxStyles.total)
              if (!currencyCols.includes(c)) return txt('', xlsxStyles.total)
              const sum = section.rows.reduce((s, row) => s + (Number(row[c]) || 0), 0)
              return num(sum, xlsxStyles.total)
            }),
          )
        }
      } else {
        merges.push({ s: { r: aoa.length, c: 0 }, e: { r: aoa.length, c: colCount - 1 } })
        aoa.push([txt('No data', xlsxStyles.value)])
      }
    }

    const ws = XLSX.utils.aoa_to_sheet(aoa)
    ws['!merges'] = merges
    ws['!cols'] = Array(colCount).fill({ wch: 22 })
    XLSX.utils.book_append_sheet(wb, ws, section.title.slice(0, 31))
  })

  XLSX.writeFile(wb, `${safeFileName(projectName)}_report.xlsx`)
}

// `uploadImages` is the array from fetchUploadImages() — passed in
// separately (rather than fetched here) so exportWord stays synchronous and
// the caller controls when the network round-trips happen.
const exportWord = (sections, project, uploadImages) => {
  const escapeHtml = (v) =>
    String(v ?? '—')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')

  const projectName = project.name || project.project_code || 'Project'
  const displayValue = (value, type) => (type === 'currency' ? fmt(value) : value)
  const generatedOn = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const coverFacts = [
    ['Project Code', project.project_code],
    ['Funding Agency', project.funding_agency],
    ['Status', project.status],
    ['Location', project.location],
  ].filter(([, v]) => v)

  const coverHtml = `<div class="cover">
    <h1>${escapeHtml(projectName)}</h1>
    <p class="subtitle">Project Report</p>
    <table class="cover-facts">${coverFacts
      .map(
        ([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`,
      )
      .join('')}</table>
    <p class="generated">Report generated on ${generatedOn}</p>
  </div>`

  const tocHtml = `<div class="toc">
    <h2>Contents</h2>
    <ol>${sections.map((s) => `<li><a href="#sec-${s.key}">${escapeHtml(s.title)}</a></li>`).join('')}</ol>
  </div>`

  const photoGalleryHtml = (key) => {
    if (key !== 'upload' || !uploadImages?.length) return ''
    return `<div class="gallery">${uploadImages
      .map(
        (img) => `<figure>
          <img src="${img.dataUri}" alt="${escapeHtml(img.name)}" />
          <figcaption>${escapeHtml(img.name)} — uploaded by ${escapeHtml(
            img.uploadedBy || 'Unknown',
          )} on ${escapeHtml(fmtDate(img.uploadedAt))}</figcaption>
        </figure>`,
      )
      .join('')}</div>`
  }

  const sectionHtml = sections
    .map((section) => {
      const rows = section.kv
        ? section.kv.map(
            ([label, value, type]) =>
              `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(displayValue(value, type))}</td></tr>`,
          )
        : [
            `<tr>${section.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr>`,
            ...(section.rows.length
              ? section.rows.map((row, i) => {
                  const currencyCols = section.currencyCols || []
                  const isSummary = (section.summaryRows || []).includes(i)
                  return `<tr${isSummary ? ' class="summary"' : ''}>${row
                    .map(
                      (cell, c) =>
                        `<td${currencyCols.includes(c) ? ' class="num"' : ''}>${escapeHtml(
                          currencyCols.includes(c) ? fmt(cell) : cell,
                        )}</td>`,
                    )
                    .join('')}</tr>`
                })
              : [`<tr><td colspan="${section.headers.length}">No data</td></tr>`]),
          ]
      return `<h2 id="sec-${section.key}">${escapeHtml(section.title)}</h2><table>${rows.join(
        '',
      )}</table>${photoGalleryHtml(section.key)}`
    })
    .join('')

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(
    projectName,
  )} Report</title><style>
    body{font-family:Calibri,Arial,sans-serif;color:#1a1a1a;}
    h1{font-size:26pt;color:#1F4E79;margin:0 0 6px;}
    .cover{text-align:center;padding:120px 24px 60px;page-break-after:always;}
    .cover .subtitle{font-size:14pt;color:#2E75B6;margin:0 0 40px;}
    .cover-facts{border-collapse:collapse;width:60%;margin:0 auto 40px;}
    .cover-facts th,.cover-facts td{border:1px solid #B0B7C3;padding:6px 10px;font-size:10pt;text-align:left;}
    .cover-facts th{background:#EEF4FB;width:40%;}
    .cover .generated{font-size:9pt;color:#666;}
    .toc{page-break-after:always;padding-top:12px;}
    .toc h2{background:#2E75B6;}
    .toc ol{font-size:11pt;line-height:1.9;}
    .toc a{color:#1F4E79;text-decoration:none;}
    h2{font-size:13pt;color:#ffffff;background:#2E75B6;padding:6px 10px;margin:22px 0 0;}
    table{border-collapse:collapse;width:100%;margin:0 0 16px;}
    th,td{border:1px solid #B0B7C3;padding:5px 8px;font-size:10pt;text-align:left;}
    th{background:#EEF4FB;font-weight:bold;}
    td.num{text-align:right;}
    tr:nth-child(even) td{background:#F7FAFD;}
    tr.summary td{background:#D9E2F3;font-weight:bold;}
    .gallery{display:flex;flex-wrap:wrap;gap:16px;margin:0 0 20px;}
    .gallery figure{width:280px;margin:0;text-align:center;}
    .gallery img{max-width:280px;max-height:280px;border:1px solid #B0B7C3;padding:4px;background:#fff;}
    .gallery figcaption{font-size:8.5pt;color:#555;margin-top:4px;}
  </style></head><body>${coverHtml}${tocHtml}${sectionHtml}</body></html>`

  const blob = new Blob(['﻿', html], { type: 'application/msword' })
  downloadBlob(blob, `${safeFileName(projectName)}_report.doc`)
}

const ReportBuilderPanel = ({ project, officers, onGenerate }) => {
  const [selected, setSelected] = useState([])
  const [format, setFormat] = useState('excel')
  const [generating, setGenerating] = useState(false)
  const [summarizing, setSummarizing] = useState(false)
  const [summaryError, setSummaryError] = useState('')
  const [narrative, setNarrative] = useState('')
  const [showNarrative, setShowNarrative] = useState(false)

  const allChecked = selected.length === SECTIONS.length

  const toggleSection = (key) => {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }

  const toggleAll = () => {
    setSelected(allChecked ? [] : SECTIONS.map((s) => s.key))
  }

  const handleGenerate = async () => {
    if (!project || !selected.length) return
    setGenerating(true)
    try {
      const allSections = await buildSections(project, officers)
      const chosen = allSections.filter((s) => selected.includes(s.key))
      if (format === 'excel') {
        exportExcel(chosen, project)
      } else {
        const uploadSection = chosen.find((s) => s.key === 'upload')
        const uploadImages = uploadSection ? await fetchUploadImages(uploadSection.documents) : []
        exportWord(chosen, project, uploadImages)
      }
      onGenerate?.(selected)
    } finally {
      setGenerating(false)
    }
  }

  const handleSummarize = async () => {
    if (!project || !selected.length) return
    setSummarizing(true)
    setSummaryError('')
    try {
      const allSections = await buildSections(project, officers)
      const chosen = allSections.filter((s) => selected.includes(s.key))
      const text = await generateNarrative(chosen)
      setNarrative(text)
      setShowNarrative(true)
    } catch (err) {
      setSummaryError(err?.message || 'Failed to generate summary. Please try again.')
    } finally {
      setSummarizing(false)
    }
  }

  return (
    <CCard className="border-0 shadow-sm" style={{ borderRadius: '10px' }}>
      <CCardHeader className="bg-transparent fw-semibold">Report</CCardHeader>
      <CCardBody>
        <p className="text-body-secondary small mb-3">
          Select the sections to include, then generate the report.
        </p>

        <CFormCheck
          id="report-section-all"
          label={<span className="fw-semibold">All</span>}
          checked={allChecked}
          onChange={toggleAll}
          className="mb-2 pb-2 border-bottom"
        />

        {SECTIONS.map((section) => (
          <CFormCheck
            key={section.key}
            id={`report-section-${section.key}`}
            label={section.label}
            checked={selected.includes(section.key)}
            onChange={() => toggleSection(section.key)}
            className="mb-2"
          />
        ))}

        {!selected.length && (
          <CAlert color="light" className="small py-2 mt-2 mb-3">
            Select at least one section to generate a report.
          </CAlert>
        )}

        <CFormLabel htmlFor="report-format" className="small fw-semibold mt-2">
          Download as
        </CFormLabel>
        <CFormSelect
          id="report-format"
          size="sm"
          className="mb-3"
          value={format}
          onChange={(e) => setFormat(e.target.value)}
        >
          <option value="excel">Excel (.xlsx)</option>
          <option value="word">Word (.doc)</option>
        </CFormSelect>

        <CButton
          color="primary"
          size="sm"
          disabled={!selected.length || generating}
          onClick={handleGenerate}
        >
          <CIcon icon={cilCloudDownload} className="me-1" />
          {generating ? 'Generating…' : 'Generate Report'}
        </CButton>
        <CButton
          color="secondary"
          variant="outline"
          size="sm"
          className="ms-2"
          disabled={!selected.length || summarizing}
          onClick={handleSummarize}
        >
          <CIcon icon={cilBolt} className="me-1" />
          {summarizing ? 'Summarizing…' : 'AI Summary'}
        </CButton>

        {summaryError && (
          <CAlert color="danger" className="small py-2 mt-3 mb-0">
            {summaryError}
          </CAlert>
        )}
      </CCardBody>

      <CModal visible={showNarrative} onClose={() => setShowNarrative(false)} size="lg">
        <CModalHeader>
          <CModalTitle>AI Summary</CModalTitle>
        </CModalHeader>
        <CModalBody style={{ whiteSpace: 'pre-wrap' }}>{narrative}</CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={() => navigator.clipboard.writeText(narrative)}>
            Copy
          </CButton>
          <CButton color="primary" onClick={() => setShowNarrative(false)}>
            Close
          </CButton>
        </CModalFooter>
      </CModal>
    </CCard>
  )
}

ReportBuilderPanel.propTypes = {
  project: PropTypes.object,
  officers: PropTypes.array,
  onGenerate: PropTypes.func,
}

export default ReportBuilderPanel
