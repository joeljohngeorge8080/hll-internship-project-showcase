// reportExportStyles.js — shared visual system for the 3 new Reports-hub
// writers (Excel/Word/PDF). Existing writers (employeeReportExport.js,
// expensePoolReportExport.js) keep their own copies of this palette
// unmodified — this file exists so new report code doesn't duplicate it a
// 3rd/4th time, not to migrate the older ones.
export const NAVY = '1F4E79'
export const BLUE = '2E75B6'

export const edge = { style: 'thin', color: { rgb: 'B0B7C3' } }
export const border = { top: edge, bottom: edge, left: edge, right: edge }

export const styles = {
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

export const rowFill = (isAlt) => (isAlt ? { fill: { fgColor: { rgb: 'EEF4FB' } } } : {})
export const MONEY = '#,##0'
export const txt = (v, s) => ({ v: v === null || v === undefined || v === '' ? '—' : v, t: 's', s })
export const num = (v, s) => ({ v: Number(v) || 0, t: 'n', z: MONEY, s })

export const fmt = (n) =>
  (n || n === 0) && !isNaN(n)
    ? `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
    : '—'
export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN') : '—')
export const safeFileName = (name) => (name || 'report').replace(/[^\w\d-]+/g, '_').slice(0, 60)

export const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
