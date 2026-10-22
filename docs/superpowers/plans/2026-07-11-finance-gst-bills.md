# Finance — GST Bills (Input Tax Credit) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Finance" EMS sidebar section with a GST Bills page: upload the standard expenditure Excel, keep only "Is it GST Bill ? = Yes" rows, compute CGST/SGST/IGST/CESS + taxable value, validate GSTINs offline, and present an Excel-style grid that Heads can edit inline with Accounted/Eligibility flags, department + batch filters, and a totals row.

**Architecture:** Pure calculation and parsing services (no React/storage imports, node-verifiable) + a localStorage store following the existing `local*.js` conventions + one page component and one upload modal in a new `src/modules/ems/finance/` module. Wired in via `MODULE.FINANCE`, the permissions matrix, the EMS nav, and `ems.routes.js`.

**Tech Stack:** React 19, CoreUI 5, react-router 7, `xlsx` 0.18 (already installed), localStorage. No backend.

**Spec:** `docs/superpowers/specs/2026-07-11-finance-gst-bills-design.md` (repo-root docs).

## Global Constraints

- **Working directory for all commands and relative paths:** `hma-template/emsv1` (the Vite app). The spec/plan live in repo-root `docs/`.
- **No new npm dependencies.** `xlsx@^0.18.5` is already a dependency.
- **No test runner exists** (no Vitest/Jest — adding one is out of scope). Services are verified with node scripts committed under `scripts/`; UI is verified with `npm run lint`, `npm run build`, and manual steps.
- **`src/` uses ESM syntax but `package.json` has no `"type": "module"`**, so node can't import `src/**/*.js` directly. Verify scripts load them via `scripts/load-esm-source.mjs` (copies the file to a temp `.mjs` beside the script, imports it, deletes it). Pure services must therefore have **no imports at all** (no React, no xlsx, no storage).
- **Git commits: no AI attribution lines** (no `Co-Authored-By: Claude`, no `Generated with` footers) — user's standing preference.
- **UI must be Excel-plain**: bordered table cells, bold header, right-aligned numbers, no badges/decorative flourish (project convention).
- **Permission semantics:** `usePermission(moduleKey, 'edit')` returns true for `ACCESS.EDIT` and always true for the Admin role (hard bypass in `src/hooks/usePermission.js:25`). So "Heads edit, everyone else view" in practice means **Heads + Admin edit; CEO + HR view; PA/PO/Employee no access** — this matches every other EMS module and was accepted in the spec's access table.
- Money display format everywhere: `Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })`, with `'—'` for null/uncomputable.

---

### Task 1: GST calculation service (`gstCalculations.js`)

**Files:**
- Create: `src/services/gstCalculations.js`
- Create: `scripts/load-esm-source.mjs` (shared loader used by all verify scripts)
- Test: `scripts/verify-gst-calculations.mjs`

**Interfaces:**
- Consumes: nothing (pure, zero imports).
- Produces (used by Tasks 5–7):
  - `GST_STATE_CODES: Record<string, string>` — `'01'…'38', '97', '99'` → state name; `'32'` → `'Kerala'`.
  - `gstinChecksumChar(first14: string): string | null` — official mod-36 check character.
  - `validateGstin(gstin: unknown): boolean` — trims/uppercases; format regex + known state code + checksum. Blank/null → `false`.
  - `stateFromGstin(gstin: unknown): string | null` — state name for a *valid* GSTIN, else `null`.
  - `round2(n: number): number`
  - `computeGstFields({ gstNo, totalValue, gstRate, cessRate }): { gstinValid: boolean, state: string|null, taxableValue: number, gstAmount: number, cessAmount: number, cgst: number|null, sgst: number|null, igst: number|null }` — taxable = total ÷ (1 + (rate+cess)/100); Kerala (`32`) → cgst = sgst = half of GST amount, igst 0; other valid state → igst = full GST amount; invalid GSTIN → state/cgst/sgst/igst are `null` but taxableValue/gstAmount/cessAmount still computed.

- [ ] **Step 1: Write the shared ESM loader**

Create `scripts/load-esm-source.mjs`:

```js
// Loads an ESM-syntax source file from src/ into node.
// The package is CJS (no "type": "module"), so src .js files can't be
// imported directly — copy to a temp .mjs beside this script, import, delete.
import { copyFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

export const loadEsmSource = async (relPathFromProjectRoot) => {
  const src = join(here, '..', relPathFromProjectRoot)
  const base = relPathFromProjectRoot.split('/').pop()
  const tmp = join(here, `.tmp-${Date.now()}-${base}.mjs`)
  copyFileSync(src, tmp)
  try {
    return await import(`file://${tmp}`)
  } finally {
    rmSync(tmp, { force: true })
  }
}
```

- [ ] **Step 2: Write the failing verification script**

Create `scripts/verify-gst-calculations.mjs`:

```js
import assert from 'node:assert/strict'
import { loadEsmSource } from './load-esm-source.mjs'

const { gstinChecksumChar, validateGstin, stateFromGstin, computeGstFields, round2 } =
  await loadEsmSource('src/services/gstCalculations.js')

// ── GSTIN validation ────────────────────────────────────────────────
// Known-valid public example GSTIN (Maharashtra). If this fails but the
// self-constructed ones below pass, the checksum factor order is wrong.
assert.equal(validateGstin('27AAPFU0939F1ZV'), true, 'known valid GSTIN must validate')
assert.equal(validateGstin(' 27aapfu0939f1zv '), true, 'trim + uppercase tolerated')
assert.equal(validateGstin('27AAPFU0939F1ZZ'), false, 'tampered check digit fails')
assert.equal(validateGstin('27AAPFU0939F1Z'), false, 'wrong length fails')
assert.equal(validateGstin(''), false)
assert.equal(validateGstin(null), false)
assert.equal(validateGstin('XXAAPFU0939F1ZV'), false, 'non-numeric state code fails')

// unknown state code fails even with a correct checksum
const bad14 = '00AAPFU0939F1Z'
assert.equal(validateGstin(bad14 + gstinChecksumChar(bad14)), false)

// construct a valid Kerala GSTIN from the checksum helper
const kerala14 = '32AAPFU0939F1Z'
const KERALA_GSTIN = kerala14 + gstinChecksumChar(kerala14)
assert.equal(validateGstin(KERALA_GSTIN), true)
assert.equal(stateFromGstin(KERALA_GSTIN), 'Kerala')
assert.equal(stateFromGstin('27AAPFU0939F1ZV'), 'Maharashtra')
assert.equal(stateFromGstin('junk'), null)

// ── round2 ──────────────────────────────────────────────────────────
assert.equal(round2(1.005), 1.01)
assert.equal(round2(84.745762), 84.75)

// ── computeGstFields ────────────────────────────────────────────────
// intra-state: 118 total @ 18% → taxable 100, CGST 9, SGST 9, IGST 0
let c = computeGstFields({ gstNo: KERALA_GSTIN, totalValue: 118, gstRate: 18, cessRate: 0 })
assert.deepEqual(
  [c.gstinValid, c.state, c.taxableValue, c.gstAmount, c.cgst, c.sgst, c.igst, c.cessAmount],
  [true, 'Kerala', 100, 18, 9, 9, 0, 0],
)

// inter-state: same numbers → IGST gets the full GST amount
c = computeGstFields({ gstNo: '27AAPFU0939F1ZV', totalValue: 118, gstRate: 18, cessRate: 0 })
assert.deepEqual([c.state, c.taxableValue, c.cgst, c.sgst, c.igst], ['Maharashtra', 100, 0, 0, 18])

// cess: 106 total @ 5% GST + 1% cess → taxable 100, CGST 2.5, SGST 2.5, cess 1
c = computeGstFields({ gstNo: KERALA_GSTIN, totalValue: 106, gstRate: 5, cessRate: 1 })
assert.deepEqual([c.taxableValue, c.cgst, c.sgst, c.igst, c.cessAmount], [100, 2.5, 2.5, 0, 1])

// zero rate: whole amount taxable, zero tax
c = computeGstFields({ gstNo: KERALA_GSTIN, totalValue: 500, gstRate: 0, cessRate: 0 })
assert.deepEqual([c.taxableValue, c.cgst, c.sgst, c.igst, c.cessAmount], [500, 0, 0, 0, 0])

// invalid GSTIN: split is unknowable; taxable/gst/cess still computed
c = computeGstFields({ gstNo: 'BADGST', totalValue: 118, gstRate: 18, cessRate: 0 })
assert.deepEqual(
  [c.gstinValid, c.state, c.cgst, c.sgst, c.igst, c.taxableValue, c.gstAmount],
  [false, null, null, null, null, 100, 18],
)

// numeric-garbage inputs degrade to 0, never NaN
c = computeGstFields({ gstNo: KERALA_GSTIN, totalValue: 'abc', gstRate: undefined, cessRate: null })
assert.deepEqual([c.taxableValue, c.cgst, c.sgst, c.igst, c.cessAmount], [0, 0, 0, 0, 0])

// rounding never produces NaN and halves differ by < 1 paisa
c = computeGstFields({ gstNo: KERALA_GSTIN, totalValue: 100, gstRate: 18, cessRate: 0 })
assert.equal(c.cgst, c.sgst)
assert.ok(Math.abs(c.cgst + c.sgst - c.gstAmount) <= 0.01, 'split reconstructs GST amount within 1 paisa')

console.log('verify-gst-calculations: ALL PASS')
```

- [ ] **Step 3: Run it to verify it fails**

Run (from `hma-template/emsv1`): `node scripts/verify-gst-calculations.mjs`
Expected: FAIL — `ENOENT ... src/services/gstCalculations.js` (file doesn't exist yet).

- [ ] **Step 4: Implement `src/services/gstCalculations.js`**

```js
// Pure GST / input-tax-credit helpers for the Finance module.
// IMPORTANT: keep this file free of ALL imports (React, xlsx, storage) —
// it is loaded into plain node by scripts/verify-gst-calculations.mjs.

export const GST_STATE_CODES = {
  '01': 'Jammu & Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  10: 'Bihar',
  11: 'Sikkim',
  12: 'Arunachal Pradesh',
  13: 'Nagaland',
  14: 'Manipur',
  15: 'Mizoram',
  16: 'Tripura',
  17: 'Meghalaya',
  18: 'Assam',
  19: 'West Bengal',
  20: 'Jharkhand',
  21: 'Odisha',
  22: 'Chhattisgarh',
  23: 'Madhya Pradesh',
  24: 'Gujarat',
  25: 'Daman & Diu',
  26: 'Dadra & Nagar Haveli and Daman & Diu',
  27: 'Maharashtra',
  28: 'Andhra Pradesh (before division)',
  29: 'Karnataka',
  30: 'Goa',
  31: 'Lakshadweep',
  32: 'Kerala',
  33: 'Tamil Nadu',
  34: 'Puducherry',
  35: 'Andaman & Nicobar Islands',
  36: 'Telangana',
  37: 'Andhra Pradesh',
  38: 'Ladakh',
  97: 'Other Territory',
  99: 'Centre Jurisdiction',
}

export const KERALA_CODE = '32'

// 15 chars: state(2 digits) + PAN(5 letters, 4 digits, 1 letter) +
// entity(1) + 'Z' + check char.
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/
const CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'

export const normalizeGstin = (gstin) => String(gstin ?? '').trim().toUpperCase()

// Official GSTIN check character: alternating factors 1,2 over the first
// 14 chars in the base-36 charset; sum quotient+remainder of each product.
export const gstinChecksumChar = (first14) => {
  if (typeof first14 !== 'string' || first14.length !== 14) return null
  let sum = 0
  for (let i = 0; i < 14; i++) {
    const value = CHARSET.indexOf(first14[i])
    if (value < 0) return null
    const product = value * (i % 2 === 0 ? 1 : 2)
    sum += Math.floor(product / 36) + (product % 36)
  }
  return CHARSET[(36 - (sum % 36)) % 36]
}

export const validateGstin = (gstin) => {
  const g = normalizeGstin(gstin)
  if (!GSTIN_REGEX.test(g)) return false
  if (!GST_STATE_CODES[g.slice(0, 2)]) return false
  return gstinChecksumChar(g.slice(0, 14)) === g[14]
}

export const stateFromGstin = (gstin) => {
  const g = normalizeGstin(gstin)
  return validateGstin(g) ? GST_STATE_CODES[g.slice(0, 2)] : null
}

export const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100

const toNumber = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/**
 * Derive all computed grid columns for one GST bill entry.
 * Total value is GST-inclusive; taxable = total / (1 + (rate + cess)/100).
 * Kerala party (state code 32) → intra-state: CGST = SGST = GST/2.
 * Any other valid state → inter-state: IGST = full GST amount.
 * Invalid GSTIN → the split is unknowable: state/cgst/sgst/igst are null,
 * but taxable/gstAmount/cessAmount still compute (they need only numbers).
 */
export const computeGstFields = ({ gstNo, totalValue, gstRate, cessRate }) => {
  const total = toNumber(totalValue)
  const rate = toNumber(gstRate)
  const cess = toNumber(cessRate)
  const taxableValue = round2(total / (1 + (rate + cess) / 100))
  const gstAmount = round2((taxableValue * rate) / 100)
  const cessAmount = round2((taxableValue * cess) / 100)

  if (!validateGstin(gstNo)) {
    return { gstinValid: false, state: null, taxableValue, gstAmount, cessAmount, cgst: null, sgst: null, igst: null }
  }

  const stateCode = normalizeGstin(gstNo).slice(0, 2)
  const intraState = stateCode === KERALA_CODE
  const half = round2(gstAmount / 2)
  return {
    gstinValid: true,
    state: GST_STATE_CODES[stateCode],
    taxableValue,
    gstAmount,
    cessAmount,
    cgst: intraState ? half : 0,
    sgst: intraState ? half : 0,
    igst: intraState ? 0 : gstAmount,
  }
}
```

Note: numeric object keys ≥ 10 are fine unquoted (they stringify), and Prettier will strip quotes from them anyway; `'01'`-style keys must stay quoted.

- [ ] **Step 5: Run verification to verify it passes**

Run: `node scripts/verify-gst-calculations.mjs`
Expected: `verify-gst-calculations: ALL PASS`

- [ ] **Step 6: Lint and commit**

```bash
npm run lint
git add src/services/gstCalculations.js scripts/load-esm-source.mjs scripts/verify-gst-calculations.mjs
git commit -m "feat(finance): GST calculation helpers with GSTIN validation"
```

---

### Task 2: Excel sheet parser (`gstSheetParser.js`)

**Files:**
- Create: `src/services/gstSheetParser.js`
- Test: `scripts/verify-gst-sheet-parser.mjs`

**Interfaces:**
- Consumes: nothing (pure, zero imports). The browser-side FileReader/XLSX wrapper lives in Task 6's modal, NOT here.
- Produces (used by Task 6):
  - `excelDateToISO(value): string` — Excel serial number or `dd/mm/yyyy` string → `'YYYY-MM-DD'`; unparseable strings returned as-is; blank → `''`.
  - `parseGstSheet(rows: unknown[][]): { error: 'HEADER_NOT_FOUND' | null, entries: ParsedEntry[] }` where `rows` is `XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })` output and `ParsedEntry = { department, vertical, partyName, gstNo, invoiceDate, invoiceNumber: string, totalValue, gstRate, cessRate: number, needsAttention: boolean }`.

- [ ] **Step 1: Write the failing verification script**

Create `scripts/verify-gst-sheet-parser.mjs`:

```js
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
const header = ['SL NO', 'Project Name', 'Date', 'Phase', 'Person Engaged', 'Place', 'District',
  'State', 'Budget Head', 'Expense type', 'Justification', 'Bill No', 'Mode of Transport',
  'Actual bill / Voucher', 'Bill Amount', 'Eligible Amount', 'Balance Eligible Amount', 'Page No',
  'Exceed/Not exceed', 'Sanction(Yes/No)', 'Employee Name', 'Amount to be Settled', 'Status',
  'Is it GST Bill ?', 'Department', 'Vertical', 'Party Name', 'GST NO:', 'Invoice Date',
  'Invoice Number', 'Total Value(included tax)', 'GST Rate(%)', 'CESS(if any)']
const mk = (over) => {
  const row = new Array(header.length).fill('')
  Object.entries(over).forEach(([k, v]) => { row[header.indexOf(k)] = v })
  return row
}
const rows = [
  ['HLL MANAGEMENT ACADEMY'], // letterhead junk
  [''],
  header,
  mk({ 'SL NO': 1, 'Is it GST Bill ?': 'No', Department: 'HR' }),
  mk({ 'SL NO': 2, 'Is it GST Bill ?': 'Yes', Department: 'HR', Vertical: 'Training',
    'Party Name': 'Acme Traders', 'GST NO:': ' 32aapfu0939f1zq ', 'Invoice Date': 45998,
    'Invoice Number': 'INV-1', 'Total Value(included tax)': 118, 'GST Rate(%)': 18, 'CESS(if any)': '' }),
  mk({ 'SL NO': 3, 'Is it GST Bill ?': ' YES ', Department: 'Admin', 'Party Name': 'Beta Ltd',
    'GST NO:': '27AAPFU0939F1ZV', 'Invoice Date': '24/11/2025', 'Invoice Number': 'INV-2',
    'Total Value(included tax)': 'abc', 'GST Rate(%)': '5%', 'CESS(if any)': '1%' }),
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node scripts/verify-gst-sheet-parser.mjs`
Expected: FAIL — `ENOENT ... src/services/gstSheetParser.js`.

- [ ] **Step 3: Implement `src/services/gstSheetParser.js`**

```js
// Pure parser for the standard HMA expenditure-statement sheet.
// Input is the raw rows array from XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
// the browser FileReader/XLSX wrapper lives in the upload modal, keeping this
// file import-free so scripts/verify-gst-sheet-parser.mjs can load it in node.

const normalizeHeader = (h) => String(h ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')

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
```

- [ ] **Step 4: Run verification to verify it passes**

Run: `node scripts/verify-gst-sheet-parser.mjs`
Expected: `verify-gst-sheet-parser: ALL PASS`

- [ ] **Step 5: Lint and commit**

```bash
npm run lint
git add src/services/gstSheetParser.js scripts/verify-gst-sheet-parser.mjs
git commit -m "feat(finance): GST sheet parser for expense statement Excel"
```

---

### Task 3: localStorage store (`localGstBills.js`)

**Files:**
- Create: `src/services/localGstBills.js`
- Test: `scripts/verify-local-gst-bills.mjs`

**Interfaces:**
- Consumes: browser `localStorage` only (shimmed in the verify script).
- Produces (used by Tasks 5–7):
  - `localGstBills.batches.list(): Batch[]` — `Batch = { id, fileName, uploadedBy, uploadedAt }`
  - `localGstBills.batches.create({ fileName, uploadedBy }): Batch`
  - `localGstBills.batches.remove(id): void` — also deletes that batch's entries.
  - `localGstBills.entries.list(): Entry[]` — `Entry = { id, batchId, department, vertical, partyName, gstNo, invoiceDate, invoiceNumber, totalValue, gstRate, cessRate, needsAttention, accounted: 'Not Accounted'|'Accounted', eligibility: 'Eligible'|'Not Eligible', createdAt, updatedAt }`
  - `localGstBills.entries.createMany(batchId, rows): Entry[]` — stamps id/batchId/defaults/timestamps onto parsed rows.
  - `localGstBills.entries.update(id, patch): Entry | null` — shallow-merges patch, bumps `updatedAt`; `null` if id unknown.

- [ ] **Step 1: Write the failing verification script**

Create `scripts/verify-local-gst-bills.mjs`:

```js
import assert from 'node:assert/strict'
import { loadEsmSource } from './load-esm-source.mjs'

// minimal localStorage shim — must be installed BEFORE the module loads
const store = new Map()
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
}

const { localGstBills } = await loadEsmSource('src/services/localGstBills.js')

assert.deepEqual(localGstBills.batches.list(), [])
assert.deepEqual(localGstBills.entries.list(), [])

const batch = localGstBills.batches.create({ fileName: 'nov.xlsx', uploadedBy: 'Heads User' })
assert.ok(batch.id, 'batch gets an id')
assert.equal(batch.fileName, 'nov.xlsx')
assert.ok(batch.uploadedAt, 'batch gets a timestamp')
assert.equal(localGstBills.batches.list().length, 1)

const created = localGstBills.entries.createMany(batch.id, [
  { department: 'HR', vertical: 'T', partyName: 'Acme', gstNo: 'G1', invoiceDate: '2025-12-07',
    invoiceNumber: 'INV-1', totalValue: 118, gstRate: 18, cessRate: 0, needsAttention: false },
  { department: 'Core', vertical: '', partyName: 'Beta', gstNo: 'G2', invoiceDate: '',
    invoiceNumber: 'INV-2', totalValue: 50, gstRate: 5, cessRate: 0, needsAttention: false },
])
assert.equal(created.length, 2)
assert.equal(created[0].accounted, 'Not Accounted', 'default flag')
assert.equal(created[0].eligibility, 'Eligible', 'default flag')
assert.equal(created[0].batchId, batch.id)
assert.ok(created[0].id && created[0].createdAt && created[0].updatedAt)
assert.equal(localGstBills.entries.list().length, 2)

const updated = localGstBills.entries.update(created[0].id, { accounted: 'Accounted', totalValue: 120 })
assert.equal(updated.accounted, 'Accounted')
assert.equal(updated.totalValue, 120)
assert.equal(updated.partyName, 'Acme', 'unpatched fields preserved')
assert.equal(localGstBills.entries.list().find((e) => e.id === created[0].id).totalValue, 120,
  'update persisted')
assert.equal(localGstBills.entries.update('no-such-id', {}), null)

// removing a batch removes its entries too
localGstBills.batches.remove(batch.id)
assert.deepEqual(localGstBills.batches.list(), [])
assert.deepEqual(localGstBills.entries.list(), [])

console.log('verify-local-gst-bills: ALL PASS')
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node scripts/verify-local-gst-bills.mjs`
Expected: FAIL — `ENOENT ... src/services/localGstBills.js`.

- [ ] **Step 3: Implement `src/services/localGstBills.js`**

```js
// localStorage-backed store for the Finance GST Bills module.
// Batches = one Excel upload; entries = the GST=Yes rows it contained.
// Follows the conventions of localGeneralExpenses.js.

const KEYS = {
  batches: 'hma_gst_batches',
  entries: 'hma_gst_entries',
}

const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`

const now = () => new Date().toISOString()

const read = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]')
  } catch {
    return []
  }
}
const write = (key, data) => localStorage.setItem(key, JSON.stringify(data))

export const localGstBills = {
  batches: {
    list: () => read(KEYS.batches),
    create: ({ fileName, uploadedBy }) => {
      const batch = { id: uid(), fileName, uploadedBy: uploadedBy || '', uploadedAt: now() }
      write(KEYS.batches, [...read(KEYS.batches), batch])
      return batch
    },
    remove: (id) => {
      write(KEYS.batches, read(KEYS.batches).filter((b) => b.id !== id))
      write(KEYS.entries, read(KEYS.entries).filter((e) => e.batchId !== id))
    },
  },
  entries: {
    list: () => read(KEYS.entries),
    createMany: (batchId, rows) => {
      const ts = now()
      const created = rows.map((row) => ({
        id: uid(),
        batchId,
        ...row,
        accounted: 'Not Accounted',
        eligibility: 'Eligible',
        createdAt: ts,
        updatedAt: ts,
      }))
      write(KEYS.entries, [...read(KEYS.entries), ...created])
      return created
    },
    update: (id, patch) => {
      const all = read(KEYS.entries)
      const idx = all.findIndex((e) => e.id === id)
      if (idx === -1) return null
      all[idx] = { ...all[idx], ...patch, updatedAt: now() }
      write(KEYS.entries, all)
      return all[idx]
    },
  },
}

export default localGstBills
```

- [ ] **Step 4: Run verification to verify it passes**

Run: `node scripts/verify-local-gst-bills.mjs`
Expected: `verify-local-gst-bills: ALL PASS`

- [ ] **Step 5: Run all three verify scripts together (regression), lint, commit**

```bash
node scripts/verify-gst-calculations.mjs && node scripts/verify-gst-sheet-parser.mjs && node scripts/verify-local-gst-bills.mjs
npm run lint
git add src/services/localGstBills.js scripts/verify-local-gst-bills.mjs
git commit -m "feat(finance): localStorage store for GST bill batches and entries"
```

---

### Task 4: Module wiring — constants, permissions, nav, route, page skeleton

**Files:**
- Modify: `src/constants/modules.js` (EMS block, after `GENERAL_EXPENSES`)
- Modify: `src/constants/permissions.js` (after the `MODULE.GENERAL_EXPENSES` block, ~line 60)
- Modify: `src/modules/ems/_nav.jsx` (after the General Expenses group, ~line 112)
- Modify: `src/routes/ems.routes.js` (lazy import near the other module imports; route entry after the general-expenses routes)
- Create: `src/modules/ems/finance/GstBillsPage.jsx` (skeleton — replaced wholesale in Task 5)

**Interfaces:**
- Consumes: `ROLE`, `ACCESS`, `MODULE`, `usePermission` — all existing.
- Produces (used by Tasks 5–7): `MODULE.FINANCE === 'finance'`; permission row Heads=EDIT / CEO=VIEW / HR=VIEW / PA=NONE / PO=NONE (Admin edits via the hook's built-in bypass; Employee gets nothing by omission); nav group **Finance → GST Bills**; route `/ems/finance/gst-bills`.

- [ ] **Step 1: Add the module constant**

In `src/constants/modules.js`, after the line `GENERAL_EXPENSES: 'general_expenses',` add:

```js
  FINANCE: 'finance',
```

- [ ] **Step 2: Add the permission row**

In `src/constants/permissions.js`, immediately after the closing `},` of the `[MODULE.GENERAL_EXPENSES]` block, add:

```js
  // Finance: Heads maintain GST bills (Admin bypasses to edit); CEO/HR read-only
  [MODULE.FINANCE]: {
    [ROLE.CEO]: ACCESS.VIEW,
    [ROLE.HEADS]: ACCESS.EDIT,
    [ROLE.HR]: ACCESS.VIEW,
    [ROLE.PROJECT_ASSOCIATE]: ACCESS.NONE,
    [ROLE.PROJECT_OFFICER]: ACCESS.NONE,
  },
```

- [ ] **Step 3: Add the nav group**

In `src/modules/ems/_nav.jsx`:

a. Add `cilCalculator` to the existing `@coreui/icons` import list.

b. Immediately after the closing `},` of the `General Expenses` CNavGroup (after line ~112), add:

```jsx
  {
    component: CNavGroup,
    name: 'Finance',
    icon: <CIcon icon={cilCalculator} customClassName="nav-icon" />,
    roles: STAFF_ROLES,
    items: [{ component: CNavItem, name: 'GST Bills', to: '/ems/finance/gst-bills' }],
  },
```

- [ ] **Step 4: Add the route**

In `src/routes/ems.routes.js`:

a. Near the other lazy imports (after the `ExpenseAnalysis` import), add:

```js
const GstBillsPage = React.lazy(() => import('../modules/ems/finance/GstBillsPage'))
```

b. In the `emsRoutes` array, after the last `/ems/general-expenses/...` route entry, add:

```js
  {
    path: '/ems/finance/gst-bills',
    name: 'GST Bills',
    element: GstBillsPage,
    module: MODULE.FINANCE,
  },
```

- [ ] **Step 5: Create the page skeleton**

Create `src/modules/ems/finance/GstBillsPage.jsx`:

```jsx
import React from 'react'
import { CAlert, CCard, CCardBody, CCardHeader } from '@coreui/react'

import { usePermission } from '../../../hooks/usePermission'
import { MODULE } from '../../../constants/modules'

const GstBillsPage = () => {
  const canView = usePermission(MODULE.FINANCE, 'view')

  if (!canView) {
    return <CAlert color="warning">You do not have access to the Finance section.</CAlert>
  }

  return (
    <CCard>
      <CCardHeader>
        <strong>GST Bills — Input Tax Credit</strong>
      </CCardHeader>
      <CCardBody>Upload and grid arrive in the next tasks.</CCardBody>
    </CCard>
  )
}

export default GstBillsPage
```

- [ ] **Step 6: Verify — lint, build, manual nav check**

```bash
npm run lint
npm run build
```
Expected: both succeed with no new errors.

Manual: `npm start`, log in as an EMS staff user, confirm the sidebar shows **Finance → GST Bills** and the page renders the skeleton card at `/ems/finance/gst-bills`. Log in as (or switch role to) Project Associate/Employee and confirm the Finance group is absent.

- [ ] **Step 7: Commit**

```bash
git add src/constants/modules.js src/constants/permissions.js src/modules/ems/_nav.jsx src/routes/ems.routes.js src/modules/ems/finance/GstBillsPage.jsx
git commit -m "feat(finance): Finance section with GST Bills page wiring"
```

---

### Task 5: The grid — computed columns, filters, totals (read-only)

**Files:**
- Modify (replace wholesale): `src/modules/ems/finance/GstBillsPage.jsx`

**Interfaces:**
- Consumes: `computeGstFields` (Task 1), `localGstBills` (Task 3), `usePermission`/`MODULE`.
- Produces (extended in Tasks 6–7): the page exposes `reload()` internally; Task 6 adds the upload modal into the marked slot; Task 7 swaps static cells for editable ones. Column order (18 cols): SL, Department, Vertical, Party Name, GST No, Invoice Date, Invoice Number, Total Value (incl. tax), GST Rate %, CESS %, State, Taxable Value, CGST, SGST, IGST, CESS Amount, Accounted status, Eligibility.

- [ ] **Step 1: Replace `GstBillsPage.jsx` with the full read-only grid**

```jsx
import React, { useEffect, useMemo, useState } from 'react'
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormLabel,
  CFormSelect,
  CRow,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilCloudUpload } from '@coreui/icons'

import { usePermission } from '../../../hooks/usePermission'
import { MODULE } from '../../../constants/modules'
import { localGstBills } from '../../../services/localGstBills'
import { computeGstFields } from '../../../services/gstCalculations'

const money = (n) =>
  n == null
    ? '—'
    : Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const HEADERS = [
  'SL', 'Department', 'Vertical', 'Party Name', 'GST No', 'Invoice Date', 'Invoice Number',
  'Total Value (incl. tax)', 'GST Rate %', 'CESS %', 'State', 'Taxable Value', 'CGST', 'SGST',
  'IGST', 'CESS Amount', 'Accounted status', 'Eligibility',
]

const numCell = { textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }

const GstBillsPage = () => {
  const canView = usePermission(MODULE.FINANCE, 'view')
  const canEdit = usePermission(MODULE.FINANCE, 'edit')

  const [entries, setEntries] = useState([])
  const [batches, setBatches] = useState([])
  const [deptFilter, setDeptFilter] = useState('all')
  const [batchFilter, setBatchFilter] = useState('all')

  const reload = () => {
    setEntries(localGstBills.entries.list())
    setBatches(localGstBills.batches.list())
  }
  useEffect(reload, [])

  const departments = useMemo(() => {
    const seen = new Map()
    entries.forEach((e) => {
      const d = (e.department || '').trim()
      if (d && !seen.has(d.toLowerCase())) seen.set(d.toLowerCase(), d)
    })
    return [...seen.values()].sort((x, y) => x.localeCompare(y))
  }, [entries])

  const rows = useMemo(
    () =>
      entries
        .filter((e) => deptFilter === 'all' || (e.department || '').trim().toLowerCase() === deptFilter)
        .filter((e) => batchFilter === 'all' || e.batchId === batchFilter)
        .map((e) => ({ ...e, computed: computeGstFields(e) })),
    [entries, deptFilter, batchFilter],
  )

  const totals = useMemo(
    () =>
      rows.reduce(
        (t, r) => ({
          totalValue: t.totalValue + (Number(r.totalValue) || 0),
          taxableValue: t.taxableValue + (r.computed.taxableValue || 0),
          cgst: t.cgst + (r.computed.cgst || 0),
          sgst: t.sgst + (r.computed.sgst || 0),
          igst: t.igst + (r.computed.igst || 0),
          cessAmount: t.cessAmount + (r.computed.cessAmount || 0),
        }),
        { totalValue: 0, taxableValue: 0, cgst: 0, sgst: 0, igst: 0, cessAmount: 0 },
      ),
    [rows],
  )

  if (!canView) {
    return <CAlert color="warning">You do not have access to the Finance section.</CAlert>
  }

  return (
    <CCard>
      <CCardHeader className="d-flex justify-content-between align-items-center">
        <strong>GST Bills — Input Tax Credit</strong>
        {canEdit && (
          <CButton color="primary" size="sm" disabled title="Upload arrives in the next task">
            <CIcon icon={cilCloudUpload} className="me-1" />
            Upload Excel
          </CButton>
        )}
      </CCardHeader>
      <CCardBody>
        <CRow className="mb-3 g-2 align-items-end">
          <CCol xs="auto">
            <CFormLabel htmlFor="gst-dept-filter" className="mb-0 small">
              Department
            </CFormLabel>
            <CFormSelect
              id="gst-dept-filter"
              size="sm"
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
            >
              <option value="all">All departments</option>
              {departments.map((d) => (
                <option key={d.toLowerCase()} value={d.toLowerCase()}>
                  {d}
                </option>
              ))}
            </CFormSelect>
          </CCol>
          <CCol xs="auto">
            <CFormLabel htmlFor="gst-batch-filter" className="mb-0 small">
              Upload
            </CFormLabel>
            <CFormSelect
              id="gst-batch-filter"
              size="sm"
              value={batchFilter}
              onChange={(e) => setBatchFilter(e.target.value)}
            >
              <option value="all">All uploads</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.fileName} ({new Date(b.uploadedAt).toLocaleDateString('en-IN')})
                </option>
              ))}
            </CFormSelect>
          </CCol>
        </CRow>

        {rows.length === 0 ? (
          <CAlert color="info" className="mb-0">
            No GST bills yet. {canEdit ? 'Upload the expenditure statement Excel to begin.' : ''}
          </CAlert>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table table-bordered table-sm align-middle mb-0">
              <thead>
                <tr>
                  {HEADERS.map((h) => (
                    <th key={h} className="table-light text-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id}>
                    <td style={numCell}>{i + 1}</td>
                    <td>{r.department}</td>
                    <td>{r.vertical}</td>
                    <td>{r.partyName}</td>
                    <td className="text-nowrap">
                      {r.gstNo}
                      {!r.computed.gstinValid && (
                        <div className="text-danger small">Invalid GST No</div>
                      )}
                    </td>
                    <td className="text-nowrap">{r.invoiceDate}</td>
                    <td>{r.invoiceNumber}</td>
                    <td style={numCell} className={r.needsAttention ? 'table-danger' : undefined}>
                      {money(r.totalValue)}
                    </td>
                    <td style={numCell}>{r.gstRate}</td>
                    <td style={numCell}>{r.cessRate}</td>
                    <td className="text-nowrap">{r.computed.state ?? '—'}</td>
                    <td style={numCell}>{money(r.computed.taxableValue)}</td>
                    <td style={numCell}>{money(r.computed.cgst)}</td>
                    <td style={numCell}>{money(r.computed.sgst)}</td>
                    <td style={numCell}>{money(r.computed.igst)}</td>
                    <td style={numCell}>{money(r.computed.cessAmount)}</td>
                    <td className="text-nowrap">{r.accounted}</td>
                    <td className="text-nowrap">{r.eligibility}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="fw-semibold table-light">
                  <td colSpan={7}>Totals ({rows.length} bills)</td>
                  <td style={numCell}>{money(totals.totalValue)}</td>
                  <td colSpan={3} />
                  <td style={numCell}>{money(totals.taxableValue)}</td>
                  <td style={numCell}>{money(totals.cgst)}</td>
                  <td style={numCell}>{money(totals.sgst)}</td>
                  <td style={numCell}>{money(totals.igst)}</td>
                  <td style={numCell}>{money(totals.cessAmount)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </CCardBody>
    </CCard>
  )
}

export default GstBillsPage
```

- [ ] **Step 2: Verify with seeded data — lint, build, manual**

```bash
npm run lint
npm run build
```

Manual: `npm start`, open the browser devtools console on the app and seed one batch:

```js
localStorage.setItem('hma_gst_batches', JSON.stringify([{ id: 'b1', fileName: 'seed.xlsx', uploadedBy: 'dev', uploadedAt: new Date().toISOString() }]))
localStorage.setItem('hma_gst_entries', JSON.stringify([
  { id: 'e1', batchId: 'b1', department: 'HR', vertical: 'Training', partyName: 'Acme', gstNo: '32AAPFU0939F1ZQ', invoiceDate: '2025-12-07', invoiceNumber: 'INV-1', totalValue: 118, gstRate: 18, cessRate: 0, needsAttention: false, accounted: 'Not Accounted', eligibility: 'Eligible', createdAt: '', updatedAt: '' },
  { id: 'e2', batchId: 'b1', department: 'Admin', vertical: '', partyName: 'Beta', gstNo: '27AAPFU0939F1ZV', invoiceDate: '2025-11-24', invoiceNumber: 'INV-2', totalValue: 105, gstRate: 5, cessRate: 0, needsAttention: false, accounted: 'Not Accounted', eligibility: 'Eligible', createdAt: '', updatedAt: '' },
  { id: 'e3', batchId: 'b1', department: 'Core', vertical: '', partyName: 'Gamma', gstNo: 'BADGSTIN', invoiceDate: '', invoiceNumber: 'INV-3', totalValue: 100, gstRate: 18, cessRate: 0, needsAttention: false, accounted: 'Not Accounted', eligibility: 'Eligible', createdAt: '', updatedAt: '' },
]))
location.reload()
```

Expected on `/ems/finance/gst-bills`: the Kerala GSTIN may show **Invalid GST No** only if its checksum char is wrong (`…F1ZQ` is a guess — that's fine, it demonstrates the marker); `27AAPFU0939F1ZV` row shows State=Maharashtra with IGST=5.00, CGST/SGST=0.00; `BADGSTIN` row shows the red marker with '—' in State/CGST/SGST/IGST; department filter narrows rows and the totals row updates.

- [ ] **Step 3: Commit**

```bash
git add src/modules/ems/finance/GstBillsPage.jsx
git commit -m "feat(finance): GST bills grid with computed tax columns, filters, totals"
```

---

### Task 6: Upload modal — preview, duplicates, import

**Files:**
- Create: `src/modules/ems/finance/components/GstUploadModal.jsx`
- Modify: `src/modules/ems/finance/GstBillsPage.jsx` (wire the modal to the Upload button)

**Interfaces:**
- Consumes: `parseGstSheet` (Task 2), `localGstBills` (Task 3), `validateGstin` (Task 1), `xlsx` package (browser side only).
- Produces: `<GstUploadModal visible onClose onImported uploadedBy />` — on confirm it creates one batch + its entries and calls `onImported()`.

- [ ] **Step 1: Create `src/modules/ems/finance/components/GstUploadModal.jsx`**

```jsx
import React, { useRef, useState } from 'react'
import PropTypes from 'prop-types'
import {
  CAlert,
  CButton,
  CFormCheck,
  CFormInput,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CSpinner,
} from '@coreui/react'
import * as XLSX from 'xlsx'

import { parseGstSheet } from '../../../../services/gstSheetParser'
import { localGstBills } from '../../../../services/localGstBills'
import { validateGstin } from '../../../../services/gstCalculations'

// Browser-side wrapper: File → raw rows array for parseGstSheet.
const readWorkbookRows = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('READ_FAILED'))
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        resolve(XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }))
      } catch {
        reject(new Error('READ_FAILED'))
      }
    }
    reader.readAsArrayBuffer(file)
  })

const dupKey = (x) => `${(x.gstNo || '').toUpperCase()}|${(x.invoiceNumber || '').toUpperCase()}`

// NOTE: React 19 — default props via parameter defaults, never defaultProps.
const GstUploadModal = ({ visible, onClose, onImported, uploadedBy = '' }) => {
  const fileRef = useRef(null)
  const [fileName, setFileName] = useState('')
  const [parsedEntries, setParsedEntries] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [skipDuplicates, setSkipDuplicates] = useState(true)

  const reset = () => {
    setParsedEntries(null)
    setError('')
    setFileName('')
    setSkipDuplicates(true)
    if (fileRef.current) fileRef.current.value = ''
  }

  const close = () => {
    reset()
    onClose()
  }

  const handleFile = async (e) => {
    const file = e.target.files[0]
    setParsedEntries(null)
    setError('')
    if (!file) return
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      setError('Only .xlsx and .xls files are accepted.')
      return
    }
    setBusy(true)
    setFileName(file.name)
    try {
      const rows = await readWorkbookRows(file)
      const result = parseGstSheet(rows)
      if (result.error === 'HEADER_NOT_FOUND') {
        setError(
          'Could not find the header row. The sheet must use the standard expenditure-statement columns ("SL NO" … "Is it GST Bill ?").',
        )
      } else if (result.entries.length === 0) {
        setError('No GST bills found in this file (no rows with "Is it GST Bill ?" = Yes).')
      } else {
        const existingKeys = new Set(
          localGstBills.entries
            .list()
            .filter((x) => x.gstNo && x.invoiceNumber)
            .map(dupKey),
        )
        setParsedEntries(
          result.entries.map((en) => ({
            ...en,
            duplicate: Boolean(en.gstNo && en.invoiceNumber && existingKeys.has(dupKey(en))),
          })),
        )
      }
    } catch {
      setError('Could not read the file. Make sure it is a valid Excel file.')
    } finally {
      setBusy(false)
    }
  }

  const dupCount = parsedEntries ? parsedEntries.filter((x) => x.duplicate).length : 0
  const importCount = parsedEntries
    ? parsedEntries.length - (skipDuplicates ? dupCount : 0)
    : 0

  const handleImport = () => {
    const toImport = parsedEntries
      .filter((x) => !(skipDuplicates && x.duplicate))
      .map(({ duplicate: _duplicate, ...rest }) => rest)
    if (toImport.length === 0) {
      setError('Nothing to import — every row is a duplicate of an existing entry.')
      return
    }
    const batch = localGstBills.batches.create({ fileName, uploadedBy })
    localGstBills.entries.createMany(batch.id, toImport)
    reset()
    onImported()
    onClose()
  }

  return (
    <CModal size="xl" scrollable visible={visible} onClose={close}>
      <CModalHeader>
        <CModalTitle>Upload GST bills Excel</CModalTitle>
      </CModalHeader>
      <CModalBody>
        <CFormInput
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFile}
          disabled={busy}
          className="mb-3"
        />
        {busy && <CSpinner size="sm" className="me-2" />}
        {error && <CAlert color="danger">{error}</CAlert>}

        {parsedEntries && (
          <>
            <p className="mb-2">
              Found <strong>{parsedEntries.length}</strong> GST bill(s) in <em>{fileName}</em>.
              {dupCount > 0 && (
                <>
                  {' '}
                  <span className="text-danger">{dupCount}</span> look like duplicates of existing
                  entries (same GST No + Invoice Number).
                </>
              )}
            </p>
            {dupCount > 0 && (
              <CFormCheck
                id="gst-skip-dups"
                label={`Skip the ${dupCount} duplicate row(s)`}
                checked={skipDuplicates}
                onChange={(e) => setSkipDuplicates(e.target.checked)}
                className="mb-2"
              />
            )}
            <div style={{ overflowX: 'auto', maxHeight: '50vh' }}>
              <table className="table table-bordered table-sm align-middle mb-0">
                <thead>
                  <tr>
                    {['#', 'Department', 'Vertical', 'Party Name', 'GST No', 'Invoice Date',
                      'Invoice Number', 'Total Value', 'GST Rate %', 'CESS %', 'Duplicate?'].map(
                      (h) => (
                        <th key={h} className="table-light text-nowrap">
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {parsedEntries.map((x, i) => (
                    <tr key={`${dupKey(x)}-${i}`} className={x.duplicate ? 'table-warning' : undefined}>
                      <td>{i + 1}</td>
                      <td>{x.department}</td>
                      <td>{x.vertical}</td>
                      <td>{x.partyName}</td>
                      <td className="text-nowrap">
                        {x.gstNo}
                        {!validateGstin(x.gstNo) && (
                          <div className="text-danger small">Invalid GST No</div>
                        )}
                      </td>
                      <td className="text-nowrap">{x.invoiceDate}</td>
                      <td>{x.invoiceNumber}</td>
                      <td className={x.needsAttention ? 'table-danger text-end' : 'text-end'}>
                        {x.totalValue}
                      </td>
                      <td className="text-end">{x.gstRate}</td>
                      <td className="text-end">{x.cessRate}</td>
                      <td>{x.duplicate ? 'Yes' : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CModalBody>
      <CModalFooter>
        <CButton color="secondary" variant="outline" onClick={close}>
          Cancel
        </CButton>
        <CButton color="primary" onClick={handleImport} disabled={!parsedEntries || busy}>
          Import {parsedEntries ? `${importCount} row(s)` : ''}
        </CButton>
      </CModalFooter>
    </CModal>
  )
}

GstUploadModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onImported: PropTypes.func.isRequired,
  uploadedBy: PropTypes.string,
}

export default GstUploadModal
```

- [ ] **Step 2: Wire the modal into `GstBillsPage.jsx`**

Three exact edits:

a. Add imports (after the `computeGstFields` import line):

```js
import GstUploadModal from './components/GstUploadModal'
import useAuth from '../../../hooks/useAuth'
```

b. Add modal state and the auth hook inside the component (next to the other `useState` calls). The user object comes from Redux and exposes `full_name` / `email` / `role` (see `src/components/header/AppHeaderDropdown.jsx:61`):

```js
const { user } = useAuth()
const [uploadOpen, setUploadOpen] = useState(false)
```

c. Replace the disabled placeholder button in the header:

```jsx
        {canEdit && (
          <CButton color="primary" size="sm" onClick={() => setUploadOpen(true)}>
            <CIcon icon={cilCloudUpload} className="me-1" />
            Upload Excel
          </CButton>
        )}
```

d. Render the modal just before the closing `</CCard>`:

```jsx
      <GstUploadModal
        visible={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onImported={reload}
        uploadedBy={user?.full_name || user?.email || ''}
      />
```

- [ ] **Step 3: Verify — lint, build, manual upload of the real file**

```bash
npm run lint
npm run build
```

Manual with `npm start`:
1. Upload `../../docs/format_csr.xlsx` (repo `docs/`) → expect the "No GST bills found" error, nothing imported.
2. Build a test file: open the real file in a spreadsheet app OR run this one-liner to create one with Yes rows:
```bash
node -e "
const XLSX = require('xlsx');
const wb = XLSX.readFile('../../docs/format_csr.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
// flip two rows to GST=Yes with invoice details (row 8-9, cols X..AG = 23..32)
const set = (r, c, v) => { ws[XLSX.utils.encode_cell({r, c})] = { t: typeof v === 'number' ? 'n' : 's', v } };
set(7, 23, 'Yes'); set(7, 24, 'HR'); set(7, 25, 'Travel'); set(7, 26, 'Acme Traders');
set(7, 27, '27AAPFU0939F1ZV'); set(7, 28, '24/11/2025'); set(7, 29, 'INV-1'); set(7, 30, 118); set(7, 31, 18); set(7, 32, '');
set(8, 23, 'Yes'); set(8, 24, 'Admin'); set(8, 26, 'Beta Ltd');
set(8, 27, '32AAPFU0939F1Z4'); set(8, 28, '01/12/2025'); set(8, 29, 'INV-2'); set(8, 30, 106); set(8, 31, 5); set(8, 32, '1%');
XLSX.writeFile(wb, 'test/gst-test.xlsx');
console.log('wrote test/gst-test.xlsx');
"
```
3. Upload `test/gst-test.xlsx` → preview shows 2 rows; import → grid shows both with computed columns: INV-1 (Maharashtra) gets IGST 18.00; INV-2 (`32AAPFU0939F1Z4` is checksum-valid Kerala) gets taxable 100.00, CGST 2.50, SGST 2.50, CESS 1.00. (The `test/` folder is untracked scratch space — don't commit the file.)
4. Upload the same file again → preview flags 2 duplicates, skip-checkbox checked; with skip on, Import reports nothing to import.

- [ ] **Step 4: Commit**

```bash
git add src/modules/ems/finance/components/GstUploadModal.jsx src/modules/ems/finance/GstBillsPage.jsx
git commit -m "feat(finance): Excel upload modal with preview and duplicate handling"
```

---

### Task 7: Inline editing, Accounted/Eligibility flags, batch management

**Files:**
- Create: `src/modules/ems/finance/components/EditableCell.jsx`
- Modify: `src/modules/ems/finance/GstBillsPage.jsx`

**Interfaces:**
- Consumes: `localGstBills.entries.update`, `localGstBills.batches.remove` (Task 3).
- Produces: final feature. `<EditableCell value onCommit type disabled listId />` — click-to-edit; Enter/blur commits, Esc cancels; `type="number"` rejects negative/non-numeric input by restoring the old value.

- [ ] **Step 1: Create `src/modules/ems/finance/components/EditableCell.jsx`**

```jsx
import React, { useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'

// Excel-style click-to-edit cell body. Renders plain text; clicking (when not
// disabled) swaps in an input. Enter/blur commits via onCommit, Esc cancels.
// type="number" rejects negative or non-numeric drafts (old value restored).
// NOTE: React 19 — default props via parameter defaults, never defaultProps.
const EditableCell = ({ value = '', onCommit, type = 'text', disabled = false, listId }) => {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const startEdit = () => {
    if (disabled) return
    setDraft(value == null ? '' : String(value))
    setEditing(true)
  }

  if (!editing) {
    return (
      <div
        role={disabled ? undefined : 'button'}
        tabIndex={disabled ? undefined : 0}
        onClick={startEdit}
        onKeyDown={(e) => e.key === 'Enter' && startEdit()}
        style={{ minHeight: '1.4rem', minWidth: '3rem', cursor: disabled ? 'default' : 'text' }}
      >
        {value == null || value === '' ? ' ' : String(value)}
      </div>
    )
  }

  const commit = () => {
    setEditing(false)
    if (type === 'number') {
      const n = Number(draft)
      if (!Number.isFinite(n) || n < 0) return // invalid → keep the old value
      if (n !== Number(value)) onCommit(n)
      return
    }
    const v = String(draft).trim()
    if (v !== String(value ?? '')) onCommit(v)
  }

  return (
    <input
      ref={inputRef}
      className="form-control form-control-sm"
      style={{ minWidth: '6rem' }}
      type={type === 'date' ? 'date' : 'text'}
      inputMode={type === 'number' ? 'decimal' : undefined}
      list={listId}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit()
        if (e.key === 'Escape') setEditing(false)
      }}
    />
  )
}

EditableCell.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onCommit: PropTypes.func.isRequired,
  type: PropTypes.oneOf(['text', 'number', 'date']),
  disabled: PropTypes.bool,
  listId: PropTypes.string,
}

export default EditableCell
```

- [ ] **Step 2: Wire editing into `GstBillsPage.jsx`**

Exact edits:

a. Add the import (`CFormSelect` is already in the `@coreui/react` import list from Task 5 — add it there if missing):

```js
import EditableCell from './components/EditableCell'
```

b. Add the update handler inside the component (after `reload`):

```js
const updateEntry = (id, patch) => {
  localGstBills.entries.update(id, patch)
  reload()
}
```

c. Replace the static input-column cells in the `<tbody>` row with editable versions (computed cells stay as they are). The full replacement `<tr>`:

```jsx
                  <tr key={r.id}>
                    <td style={numCell}>{i + 1}</td>
                    <td>
                      <EditableCell
                        value={r.department}
                        disabled={!canEdit}
                        onCommit={(v) => updateEntry(r.id, { department: v })}
                      />
                    </td>
                    <td>
                      <EditableCell
                        value={r.vertical}
                        disabled={!canEdit}
                        onCommit={(v) => updateEntry(r.id, { vertical: v })}
                      />
                    </td>
                    <td>
                      <EditableCell
                        value={r.partyName}
                        disabled={!canEdit}
                        onCommit={(v) => updateEntry(r.id, { partyName: v })}
                      />
                    </td>
                    <td className="text-nowrap">
                      <EditableCell
                        value={r.gstNo}
                        disabled={!canEdit}
                        onCommit={(v) => updateEntry(r.id, { gstNo: v.toUpperCase() })}
                      />
                      {!r.computed.gstinValid && (
                        <div className="text-danger small">Invalid GST No</div>
                      )}
                    </td>
                    <td className="text-nowrap">
                      <EditableCell
                        value={r.invoiceDate}
                        type="date"
                        disabled={!canEdit}
                        onCommit={(v) => updateEntry(r.id, { invoiceDate: v })}
                      />
                    </td>
                    <td>
                      <EditableCell
                        value={r.invoiceNumber}
                        disabled={!canEdit}
                        onCommit={(v) => updateEntry(r.id, { invoiceNumber: v })}
                      />
                    </td>
                    <td style={numCell} className={r.needsAttention ? 'table-danger' : undefined}>
                      <EditableCell
                        value={r.totalValue}
                        type="number"
                        disabled={!canEdit}
                        onCommit={(v) =>
                          updateEntry(r.id, { totalValue: v, needsAttention: false })
                        }
                      />
                    </td>
                    <td style={numCell}>
                      <EditableCell
                        value={r.gstRate}
                        type="number"
                        listId="gst-rate-options"
                        disabled={!canEdit}
                        onCommit={(v) => updateEntry(r.id, { gstRate: v, needsAttention: false })}
                      />
                    </td>
                    <td style={numCell}>
                      <EditableCell
                        value={r.cessRate}
                        type="number"
                        disabled={!canEdit}
                        onCommit={(v) => updateEntry(r.id, { cessRate: v })}
                      />
                    </td>
                    <td className="text-nowrap">{r.computed.state ?? '—'}</td>
                    <td style={numCell}>{money(r.computed.taxableValue)}</td>
                    <td style={numCell}>{money(r.computed.cgst)}</td>
                    <td style={numCell}>{money(r.computed.sgst)}</td>
                    <td style={numCell}>{money(r.computed.igst)}</td>
                    <td style={numCell}>{money(r.computed.cessAmount)}</td>
                    <td>
                      <CFormSelect
                        size="sm"
                        disabled={!canEdit}
                        value={r.accounted}
                        onChange={(e) => updateEntry(r.id, { accounted: e.target.value })}
                        aria-label="Accounted status"
                      >
                        <option>Not Accounted</option>
                        <option>Accounted</option>
                      </CFormSelect>
                    </td>
                    <td>
                      <CFormSelect
                        size="sm"
                        disabled={!canEdit}
                        value={r.eligibility}
                        onChange={(e) => updateEntry(r.id, { eligibility: e.target.value })}
                        aria-label="Eligibility"
                      >
                        <option>Eligible</option>
                        <option>Not Eligible</option>
                      </CFormSelect>
                    </td>
                  </tr>
```

d. Add the GST-rate suggestion datalist just inside the outer `<CCard>` (before `<CCardHeader>` or after it — anywhere valid):

```jsx
      <datalist id="gst-rate-options">
        {[0, 3, 5, 18, 40, 50].map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>
```

e. Add batch management below the filter `<CRow>` (Heads only, only when batches exist):

```jsx
        {canEdit && batches.length > 0 && (
          <div className="mb-3 small">
            {batches.map((b) => (
              <div key={b.id} className="d-flex align-items-center gap-2 py-1 border-bottom">
                <span>
                  {b.fileName} — uploaded{' '}
                  {new Date(b.uploadedAt).toLocaleDateString('en-IN')}
                  {b.uploadedBy ? ` by ${b.uploadedBy}` : ''} (
                  {entries.filter((e) => e.batchId === b.id).length} entries)
                </span>
                <CButton
                  color="danger"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (
                      window.confirm(
                        `Delete upload "${b.fileName}" and all its entries? This cannot be undone.`,
                      )
                    ) {
                      localGstBills.batches.remove(b.id)
                      if (batchFilter === b.id) setBatchFilter('all')
                      reload()
                    }
                  }}
                >
                  Delete
                </CButton>
              </div>
            ))}
          </div>
        )}
```

- [ ] **Step 3: Verify — regression scripts, lint, build, full manual pass**

```bash
node scripts/verify-gst-calculations.mjs && node scripts/verify-gst-sheet-parser.mjs && node scripts/verify-local-gst-bills.mjs
npm run lint
npm run build
```

Manual (as a Heads or Admin user, with data from Task 6's test upload):
1. Click a Party Name cell → input appears; change it, press Enter → persists after reload (localStorage).
2. Edit Total Value to a negative number → rejected, old value kept. Edit to a valid number → Taxable/CGST/SGST/IGST recompute live.
3. Edit a GST No to garbage → red "Invalid GST No" appears and State/CGST/SGST/IGST become '—'; fix it back → split returns.
4. Change GST Rate via the input (datalist suggests 0/3/5/18/40/50) → recompute.
5. Flip Accounted → Accounted and Eligibility → Not Eligible; reload page → values kept.
6. Delete a batch via its Delete button → its rows vanish; confirm dialog appears first.
7. Switch to a view-only role (CEO/HR): cells don't open editors, dropdowns disabled, no Upload button, no Delete buttons.

- [ ] **Step 4: Commit**

```bash
git add src/modules/ems/finance/components/EditableCell.jsx src/modules/ems/finance/GstBillsPage.jsx
git commit -m "feat(finance): inline editing, accounting flags, batch management"
```

---

## Final acceptance checklist (maps to the spec)

- [ ] Sidebar shows **Finance → GST Bills** for Admin/CEO/Heads/HR only.
- [ ] Heads (and Admin) can upload/edit; CEO/HR are read-only everywhere on the page.
- [ ] Uploading `docs/format_csr.xlsx` reports "No GST bills found" (it has zero Yes rows).
- [ ] A file with Yes rows imports only those rows as a new batch; re-upload flags duplicates.
- [ ] Computed columns follow: taxable = total ÷ (1 + (rate+cess)/100); Kerala GSTIN → CGST=SGST=GST/2; other state → IGST=GST; CESS = taxable × cess%.
- [ ] Invalid GSTIN shows red marker; State/CGST/SGST/IGST show '—'; taxable/CESS still computed.
- [ ] Department + upload filters work; totals row reflects the filtered rows.
- [ ] Accounted defaults to "Not Accounted"; Eligibility defaults to "Eligible"; both editable by Heads.
- [ ] All three `scripts/verify-*.mjs` pass; `npm run lint` and `npm run build` clean.
