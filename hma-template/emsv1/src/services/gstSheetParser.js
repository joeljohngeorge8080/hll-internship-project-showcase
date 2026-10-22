// Pure parser for the standard HMA expenditure-statement sheet.
// Input is the raw rows array from XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
// the browser FileReader/XLSX wrapper lives in the upload modal, keeping this
// file import-free so scripts/verify-gst-sheet-parser.mjs can load it in node.

const normalizeHeader = (h) =>
  String(h ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

// normalized-header prefix → parsed field name
const HEADER_MAP = {
  isitgstbill: 'isGstBill',
  department: 'department',
  vertical: 'vertical',
  partyname: 'partyName',
  gstno: 'gstNo',
  invoicedate: 'invoiceDate',
  invoicenumber: 'invoiceNumber',
  totalvalueincludedtax: 'totalValue',
  gstrate: 'gstRate',
  cess: 'cessRate',
}

// Excel serial day 25569 = 1970-01-01 (1900 date system).
export const excelDateToISO = (value) => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return new Date(Math.round((value - 25569) * 86400 * 1000)).toISOString().slice(0, 10)
  }
  const s = String(value ?? '').trim()
  if (!s) return ''
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  return s
}

// '5%' → 5, '' → null, 'abc' → null
const toNumberOrNull = (v) => {
  if (v == null) return null
  const s = String(v).replace(/%\s*$/, '').trim()
  if (s === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

const text = (v) => String(v ?? '').trim()

export const parseGstSheet = (rows) => {
  const headerIdx = rows.findIndex((row) => {
    if (!Array.isArray(row)) return false
    const norms = row.map(normalizeHeader)
    return norms.some((n) => n.startsWith('slno')) && norms.some((n) => n.startsWith('isitgstbill'))
  })
  if (headerIdx === -1) return { error: 'HEADER_NOT_FOUND', entries: [] }

  const cols = {} // field name → column index (first match wins)
  rows[headerIdx].forEach((h, i) => {
    const norm = normalizeHeader(h)
    for (const [prefix, field] of Object.entries(HEADER_MAP)) {
      if (norm.startsWith(prefix) && cols[field] === undefined) cols[field] = i
    }
  })

  const entries = []
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i]
    if (!Array.isArray(row)) continue
    if (text(row[cols.isGstBill]).toLowerCase() !== 'yes') continue

    const totalValue = toNumberOrNull(row[cols.totalValue])
    const gstRate = toNumberOrNull(row[cols.gstRate])
    entries.push({
      department: text(row[cols.department]),
      vertical: text(row[cols.vertical]),
      partyName: text(row[cols.partyName]),
      gstNo: text(row[cols.gstNo]).toUpperCase(),
      invoiceDate: excelDateToISO(row[cols.invoiceDate]),
      invoiceNumber: text(row[cols.invoiceNumber]),
      totalValue: totalValue ?? 0,
      gstRate: gstRate ?? 0,
      cessRate: toNumberOrNull(row[cols.cessRate]) ?? 0,
      // a GST bill without a usable amount or rate needs a human look
      needsAttention: totalValue === null || gstRate === null,
    })
  }
  return { error: null, entries }
}
