import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { loadEsmSource } from './load-esm-source.mjs'

const require = createRequire(import.meta.url)
const XLSX = require('xlsx') // CJS require avoids ESM-interop issues

const { parseGstSheet, excelDateToISO } = await loadEsmSource('src/services/gstSheetParser.js')

const here = dirname(fileURLToPath(import.meta.url))

// ── 1. The real sample file: letterhead skipped, but zero GST=Yes rows ──
const samplePath = join(here, '..', '..', '..', 'docs', 'format_csr.xlsx')
const wb = XLSX.readFile(samplePath)
const realRows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' })
let r = parseGstSheet(realRows)
assert.equal(r.error, null, 'header row must be found past the 6-row letterhead')
assert.equal(r.entries.length, 0, 'sample file has only GST=No rows')

// ── 2. Synthetic sheet with Yes rows and messy values ──
const header = [
  'SL NO',
  'Project Name',
  'Date',
  'Phase',
  'Person Engaged',
  'Place',
  'District',
  'State',
  'Budget Head',
  'Expense type',
  'Justification',
  'Bill No',
  'Mode of Transport',
  'Actual bill / Voucher',
  'Bill Amount',
  'Eligible Amount',
  'Balance Eligible Amount',
  'Page No',
  'Exceed/Not exceed',
  'Sanction(Yes/No)',
  'Employee Name',
  'Amount to be Settled',
  'Status',
  'Is it GST Bill ?',
  'Department',
  'Vertical',
  'Party Name',
  'GST NO:',
  'Invoice Date',
  'Invoice Number',
  'Total Value(included tax)',
  'GST Rate(%)',
  'CESS(if any)',
]
const mk = (over) => {
  const row = new Array(header.length).fill('')
  Object.entries(over).forEach(([k, v]) => {
    row[header.indexOf(k)] = v
  })
  return row
}
const rows = [
  ['HLL MANAGEMENT ACADEMY'], // letterhead junk
  [''],
  header,
  mk({ 'SL NO': 1, 'Is it GST Bill ?': 'No', Department: 'HR' }),
  mk({
    'SL NO': 2,
    'Is it GST Bill ?': 'Yes',
    Department: 'HR',
    Vertical: 'Training',
    'Party Name': 'Acme Traders',
    'GST NO:': ' 32aapfu0939f1zq ',
    'Invoice Date': 45998,
    'Invoice Number': 'INV-1',
    'Total Value(included tax)': 118,
    'GST Rate(%)': 18,
    'CESS(if any)': '',
  }),
  mk({
    'SL NO': 3,
    'Is it GST Bill ?': ' YES ',
    Department: 'Admin',
    'Party Name': 'Beta Ltd',
    'GST NO:': '27AAPFU0939F1ZV',
    'Invoice Date': '24/11/2025',
    'Invoice Number': 'INV-2',
    'Total Value(included tax)': 'abc',
    'GST Rate(%)': '5%',
    'CESS(if any)': '1%',
  }),
]
r = parseGstSheet(rows)
assert.equal(r.error, null)
assert.equal(r.entries.length, 2, 'only Yes rows imported')

const [a, b] = r.entries
assert.equal(a.department, 'HR')
assert.equal(a.vertical, 'Training')
assert.equal(a.partyName, 'Acme Traders')
assert.equal(a.gstNo, '32AAPFU0939F1ZQ', 'GSTIN trimmed + uppercased')
assert.equal(a.invoiceDate, '2025-12-07', 'Excel serial 45998 converted')
assert.equal(a.invoiceNumber, 'INV-1')
assert.equal(a.totalValue, 118)
assert.equal(a.gstRate, 18)
assert.equal(a.cessRate, 0, 'blank cess is 0, not flagged')
assert.equal(a.needsAttention, false)

assert.equal(b.invoiceDate, '2025-11-24', 'dd/mm/yyyy string converted')
assert.equal(b.totalValue, 0, 'non-numeric total degrades to 0')
assert.equal(b.needsAttention, true, '...and is flagged for attention')
assert.equal(b.gstRate, 5, "'5%' string parsed")
assert.equal(b.cessRate, 1, "'1%' string parsed")

// ── 3. Error paths ──
assert.equal(parseGstSheet([['random'], ['junk', 'rows']]).error, 'HEADER_NOT_FOUND')
assert.equal(parseGstSheet([]).error, 'HEADER_NOT_FOUND')

// ── 4. excelDateToISO edge cases ──
assert.equal(excelDateToISO(''), '')
assert.equal(excelDateToISO(null), '')
assert.equal(excelDateToISO('not a date'), 'not a date', 'unparseable kept as-is')
assert.equal(excelDateToISO('2025-12-07'), '2025-12-07')

console.log('verify-gst-sheet-parser: ALL PASS')
