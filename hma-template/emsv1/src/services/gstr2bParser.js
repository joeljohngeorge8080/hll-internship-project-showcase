// Pure parser for the government "GSTR-2B" download (Goods and Services
// Tax - GSTR-2B, "Taxable inward supplies received from registered
// persons" sheet). Input is the raw rows array from
// XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }).
//
// The sheet has a two-row header: a main header row (merged cells, e.g.
// "Invoice Details" spanning several columns) followed by a sub-header row
// with the actual per-column labels (e.g. "Invoice number", "Invoice
// Date"). We build the column map from whichever of the two rows has a
// label at each index, preferring the more specific sub-header row.

import { excelDateToISO } from './gstSheetParser'

const normalizeHeader = (h) =>
  String(h ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

// normalized-header prefix → parsed field name
const HEADER_MAP = {
  gstinofsupplier: 'gstin',
  tradelegalname: 'tradeName',
  invoicenumber: 'invoiceNumber',
  invoicetype: 'invoiceType',
  invoicedate: 'invoiceDate',
  invoicevalue: 'invoiceValue',
  placeofsupply: 'placeOfSupply',
  taxablevalue: 'taxableValue',
  integratedtax: 'integratedTax',
  centraltax: 'centralTax',
  stateuttax: 'stateTax',
  cess: 'cess',
  itcavailability: 'itcAvailability',
  reason: 'reason',
}

const toNumberOrNull = (v) => {
  if (v == null) return null
  const s = String(v).trim()
  if (s === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

const text = (v) => String(v ?? '').trim()

export const parseGstr2bSheet = (rows) => {
  const mainHeaderIdx = rows.findIndex(
    (row) => Array.isArray(row) && normalizeHeader(row[0]).startsWith('gstinofsupplier'),
  )
  if (mainHeaderIdx === -1) return { error: 'HEADER_NOT_FOUND', entries: [] }

  const subHeaderRow = rows[mainHeaderIdx + 1] || []
  const mainHeaderRow = rows[mainHeaderIdx] || []
  const colCount = Math.max(mainHeaderRow.length, subHeaderRow.length)

  const cols = {} // field name → column index (first match wins)
  for (let i = 0; i < colCount; i++) {
    const label = normalizeHeader(subHeaderRow[i]) || normalizeHeader(mainHeaderRow[i])
    if (!label) continue
    for (const [prefix, field] of Object.entries(HEADER_MAP)) {
      if (label.startsWith(prefix) && cols[field] === undefined) cols[field] = i
    }
  }
  if (cols.gstin === undefined || cols.invoiceNumber === undefined) {
    return { error: 'COLUMNS_NOT_FOUND', entries: [] }
  }

  const entries = []
  for (let i = mainHeaderIdx + 2; i < rows.length; i++) {
    const row = rows[i]
    if (!Array.isArray(row)) continue
    const gstin = text(row[cols.gstin])
    if (!gstin) continue

    entries.push({
      gstin: gstin.toUpperCase(),
      tradeName: text(row[cols.tradeName]),
      invoiceNumber: text(row[cols.invoiceNumber]),
      invoiceType: text(row[cols.invoiceType]),
      invoiceDate: excelDateToISO(row[cols.invoiceDate]),
      invoiceValue: toNumberOrNull(row[cols.invoiceValue]) ?? 0,
      placeOfSupply: text(row[cols.placeOfSupply]),
      taxableValue: toNumberOrNull(row[cols.taxableValue]) ?? 0,
      integratedTax: toNumberOrNull(row[cols.integratedTax]) ?? 0,
      centralTax: toNumberOrNull(row[cols.centralTax]) ?? 0,
      stateTax: toNumberOrNull(row[cols.stateTax]) ?? 0,
      cess: toNumberOrNull(row[cols.cess]) ?? 0,
      itcAvailability: text(row[cols.itcAvailability]),
      reason: text(row[cols.reason]),
    })
  }
  return { error: null, entries }
}
