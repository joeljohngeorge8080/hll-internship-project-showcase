# Finance — GST Bills (Input Tax Credit) — Design

**Date:** 2026-07-11
**Status:** Approved by user (Option A)

## Purpose

The finance team needs to identify GST bills from the company's expense
statements so HMA can claim input tax credit (ITC). They upload the standard
expenditure-statement Excel (see `docs/format_csr.xlsx`); the system extracts
only the rows marked as GST bills, computes the tax split
(CGST/SGST/IGST/CESS + taxable value), validates GST numbers, and presents
everything in an editable Excel-style grid with per-row accounting flags.

## Scope

- New EMS sidebar section **"Finance"** with one page: **GST Bills** at
  `/ems/finance/gst-bills`.
- Excel upload → parse → filter GST rows → computed grid → inline editing →
  localStorage persistence.
- **In scope:** upload batches, GSTIN offline validation, tax computation,
  department + batch filters, totals row, Accounted/Eligibility flags.
- **Out of scope:** backend/API, bill/PDF attachments, GSTN portal lookups,
  changes to existing expense modules, new npm dependencies.

## Access control

| Role | Capability |
|---|---|
| Heads | Full: upload, edit cells, set Accounted/Eligibility, delete batches |
| All other roles | Read-only view (upload button and editing disabled) |

Uses the existing `ROLE` constants and permission-gating patterns
(`src/constants/roles.js`, `src/constants/permissions.js`).

## Architecture (Option A — existing module pattern)

- `src/modules/ems/finance/GstBillsPage.jsx` — page: toolbar (upload,
  filters), grid, totals row.
- `src/modules/ems/finance/components/GstUploadModal.jsx` — file pick,
  parse preview, duplicate handling, import confirm.
- `src/services/localGstBills.js` — localStorage CRUD, following the
  `local*.js` service conventions (same shape as `localGeneralExpenses.js`).
- `src/services/gstCalculations.js` — pure functions: GSTIN validation
  (regex + mod-36 checksum + state-code check), state lookup from GSTIN,
  taxable/CGST/SGST/IGST/CESS computation. Unit-testable, no storage access.
- Route entries in `src/routes/ems.routes.js`; nav item "Finance" in the EMS
  sidebar nav config, gated like other sections.
- Uses the already-installed `xlsx` package for parsing. No new dependencies.

## Upload & parsing

1. Accept `.xlsx` / `.xls`.
2. Find the header row: first row containing both `SL NO` and a cell matching
   `Is it GST Bill` (case/whitespace/punctuation tolerant). This skips the
   6-row letterhead in `format_csr.xlsx` and tolerates format drift.
3. Map columns by header name (not position): Department, Vertical,
   Party Name, GST NO, Invoice Date, Invoice Number,
   Total Value(included tax), GST Rate(%), CESS(if any). Other columns
   (Project Name, Bill No, etc.) are ignored.
4. Keep only rows where **Is it GST Bill ? = "Yes"** (case-insensitive,
   trimmed).
5. Convert Excel serial dates (e.g. `45998`) to `YYYY-MM-DD`.
6. Save as a **batch**: `{ id, fileName, uploadedAt, uploadedBy }`; entries
   reference `batchId`. Batches append — previous data and its edits/flags
   are never touched by a new upload.
7. **Duplicates:** a parsed row whose (GST No, Invoice Number) matches an
   existing entry is flagged in the preview; the user chooses per upload to
   import or skip flagged rows (skip is default).
8. Preview before commit: show parsed GST rows + count + duplicate flags;
   nothing is stored until the user confirms.
9. Empty/whole-file failure cases: no header row found, zero GST rows —
   clear error message, nothing stored.

## Entry data model (localStorage)

```js
{
  id, batchId,
  department, vertical, partyName, gstNo,
  invoiceDate, invoiceNumber,
  totalValue,        // number, GST-inclusive
  gstRate,           // number (percent)
  cessRate,          // number (percent), 0 if blank
  accounted,         // 'Not Accounted' (default) | 'Accounted'
  eligibility,       // 'Eligible' (default) | 'Not Eligible'
  createdAt, updatedAt
}
```

Computed on render (never stored, so edits can't desync):
`gstinValid`, `state`, `taxableValue`, `cgst`, `sgst`, `igst`, `cessAmount`.

## Computation rules

Let `r = gstRate`, `c = cessRate`, `T = totalValue` (tax-inclusive).

- **Taxable Value** = `T / (1 + (r + c) / 100)` → round 2 dp.
- **GST amount** = `Taxable × r / 100`.
- **CESS amount** = `Taxable × c / 100` (CESS is a % of taxable value).
- **Intra-state (party GSTIN state code = 32, Kerala):**
  CGST = SGST = GST amount / 2; IGST = 0.
- **Inter-state (any other valid state code):** IGST = GST amount;
  CGST = SGST = 0.
- **State** = looked up from GSTIN first two digits via the full official
  GST state-code map (01–38 + 97/99 where applicable).
- GST Rate cell is a dropdown offering 0, 3, 5, 18, 40, 50, and also shows
  the file-supplied value if it differs; the user may type any non-negative
  number.
- All derived values recompute live on any edit to totalValue, gstRate,
  cessRate, or gstNo.

## GSTIN validation (offline)

- Format: `^[0-3][0-9][A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$`
  (15 chars; uppercase before checking).
- State code must exist in the state-code map.
- 15th character must satisfy the official mod-36 checksum.
- Invalid GSTIN: row still imports/saves, GST No cell gets a red
  "Invalid GST No" marker, and State/CGST/SGST/IGST render as "—" (the
  intra/inter split is unknowable from a bad GSTIN). Taxable Value and CESS
  Amount still compute — they depend only on totals and rates. Fixing the
  GSTIN inline restores the split immediately.
- Blank GSTIN is treated the same as invalid.

## Grid (Excel-style)

Plain CoreUI table styled like a spreadsheet: bordered cells, bold header
row, right-aligned tabular numbers, no badges or decorative UI
(per the PMS/EMS "Excel-plain" convention).

Columns, in order:

| # | Column | Editable (Heads) | Source |
|---|---|---|---|
| 1 | SL | no | row index within current view |
| 2 | Department | yes (text) | file |
| 3 | Vertical | yes (text) | file |
| 4 | Party Name | yes (text) | file |
| 5 | GST No | yes (text, validated) | file |
| 6 | Invoice Date | yes (date) | file |
| 7 | Invoice Number | yes (text) | file |
| 8 | Total Value (incl. tax) | yes (number) | file |
| 9 | GST Rate % | yes (dropdown/number) | file |
| 10 | CESS % | yes (number) | file |
| 11 | State | no (computed) | GSTIN |
| 12 | Taxable Value | no (computed) | formula |
| 13 | CGST | no (computed) | formula |
| 14 | SGST | no (computed) | formula |
| 15 | IGST | no (computed) | formula |
| 16 | CESS Amount | no (computed) | formula |
| 17 | Accounted status | yes (dropdown) | default "Not Accounted" |
| 18 | Eligibility | yes (dropdown) | default "Eligible" |

- Click a cell to edit in place (input replaces cell content); Enter/blur
  commits, Esc cancels. Persist to localStorage on commit.
- Number edits validate non-negative numeric; invalid input is rejected with
  the previous value restored.
- Non-Heads roles: cells render as plain text, dropdowns disabled.

## Filters & totals

- Filter bar above the grid: **Department** (All + distinct department
  values present in data — HR, Admin, Core, etc., matched case-insensitively)
  and **Upload batch** (All + one per batch, labeled fileName + date).
- Totals row pinned at the bottom: sums of Total Value, Taxable Value, CGST,
  SGST, IGST, CESS Amount for the **currently filtered** rows.
- Batch management (Heads only): a batch list with entry counts and a delete
  action (confirm dialog) that removes the batch and its entries.

## Error handling

- Unreadable/corrupt file → toast/alert "Could not read file", nothing stored.
- Header row not found → explicit message naming the expected headers.
- Zero GST rows → "No GST bills found in this file", nothing stored.
- Non-numeric Total Value / GST Rate in the file → import with value 0 and
  mark the cell needing attention (red outline) rather than dropping the row.

## Testing

The repo currently has no test runner (no Vitest/Jest). Adding one is a new
dependency and out of scope unless separately approved. Verification plan:

- `gstCalculations.js` is pure (no imports of storage/React), so it can be
  exercised with a plain `node` script during development: GSTIN checksum
  valid/invalid, state-code mapping, intra vs inter split, taxable/CESS
  rounding, zero-rate, blank cess.
- Parser verified by uploading `docs/format_csr.xlsx` itself: header-row
  detection past the 6-row letterhead, Yes-filtering, serial-date
  conversion, duplicate detection on a second upload of the same file.
- Manual verification in the running app: edit cells as Heads, confirm
  read-only for another role, filter by department, check totals row.
