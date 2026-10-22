// Parses a project officer's per-project Excel ledger (plan:
// docs/plans/actual-phase-ledger-upload.md §1, §4). One workbook holds one
// sheet per project; the PO picks which sheet is theirs (see listSheets).
//
// Every sheet follows the same shape:
//   R0     Project title
//   R1-6   Summary block (Project Value, Amount Received, ...) — NOT imported,
//          these are the officer's own running totals, not transaction rows.
//   R?     HEADER ROW — located by scanning for a row whose col 0 trims to
//          "date" (found at index 7 in the reference workbook, never hardcoded).
//   R?+1.. Transaction rows. Real data is interleaved with blank spacer rows
//          the officer inserts between groups, and followed at the very end
//          by trailing subtotal/total rows that carry a bare Amount with no
//          Date/Particulars/Activity. Spacer rows are skipped silently and
//          scanning continues — stopping at the FIRST blank row would be
//          wrong: on the reference workbook's largest sheet a single spacer
//          row appears after only 9 of ~111 real rows. Trailing total rows
//          are dropped because they fail the "date required" rule below,
//          not because of any special end-of-data detection.
//
// Columns are resolved by header text, case-insensitively, never by a fixed
// index — the Activity column moves: most sheets call it "Activity" or
// "Activities", one has no Remarks column at all and instead splits it into
// "Main Activities" (always empty) + "Sub Activities" (the real values, one
// column further right than every other sheet). When both exist, the column
// with more non-empty values among the data rows wins.
//
// Returns from parseSheet(): { rows, errors, warnings, meta }
// Returns from listSheets(): [{ name, dataRowCount, hasActivityColumn }]

import * as XLSX from 'xlsx'
import { resolveActivity } from '../modules/pms/project-associate/budget-plan/activityOptions'

const ACTIVITY_HEADER_CANDIDATES = ['activity', 'activities', 'main activities', 'sub activities']

const PHASE_MAP = {
  'design & initiation phase': 'design',
  'implementation phase': 'implementation',
  'monitoring & evaluation phase': 'monitoring',
}

const KNOWN_BUDGET_HEADS = [
  'project expense',
  'hr expense',
  'coreteam salary',
  'administrative expense',
]

const normHeader = (h) =>
  String(h ?? '')
    .trim()
    .toLowerCase()
const cellText = (v) => (v === null || v === undefined ? '' : String(v).trim())

const readWorkbook = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.onload = (e) => {
      try {
        resolve(XLSX.read(e.target.result, { type: 'array', raw: true }))
      } catch (err) {
        reject(new Error(`Failed to parse Excel: ${err.message}`))
      }
    }
    reader.readAsArrayBuffer(file)
  })

/** Excel serial date (1900 date system, incl. the Feb-1900 leap-year quirk
 * Excel itself has) → 'YYYY-MM-DD'. */
const serialToIso = (serial) => {
  const ms = Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000
  const d = new Date(ms)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

/** Accepts DD-MM-YYYY / DD.MM.YYYY / DD/MM/YYYY text, or a real Excel
 * date-cell number. Day-first, matching gstSheetParser.js's convention —
 * ledgers are always filled in by Indian officers, never US-locale input.
 * Anything else → null (caller warns + excludes the row).
 *
 * Returns { iso, ambiguous }. Text cells are never ambiguous — the regex
 * always reads day-first, unconditionally, regardless of any locale.
 * Numeric (real date-typed) cells ARE at risk: Excel decides day vs month
 * itself, using whatever locale authored the file, before this code ever
 * sees the value — so for any numeric cell where the decoded day is ≤12
 * (i.e. it could plausibly have been read as a month), we can't tell
 * whether Excel's own auto-recognition already silently swapped it. We
 * don't guess either way (guessing wrong corrupts a correctly-entered
 * date); we flag it so the officer can eyeball and correct it. */
const parseLedgerDate = (raw) => {
  if (typeof raw === 'number') {
    const iso = serialToIso(raw)
    if (!iso) return { iso: null, ambiguous: false }
    const day = Number(iso.slice(8, 10))
    return { iso, ambiguous: day <= 12 }
  }
  const s = cellText(raw)
  if (!s) return { iso: null, ambiguous: false }
  const m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/)
  if (!m) return { iso: null, ambiguous: false }
  const [, dd, mm, yyyy] = m
  const day = Number(dd)
  const month = Number(mm)
  if (month < 1 || month > 12 || day < 1 || day > 31) return { iso: null, ambiguous: false }
  return {
    iso: `${yyyy}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    ambiguous: false,
  }
}

/** Strips spaces/commas/₹; '-' or blank → 0; anything non-numeric → NaN
 * (caller warns + excludes the row). */
const parseLedgerAmount = (raw) => {
  if (typeof raw === 'number') return raw
  const s = cellText(raw).replace(/[₹,\s]/g, '')
  if (s === '' || s === '-') return 0
  const n = Number(s)
  return Number.isFinite(n) ? n : NaN
}

const resolvePhase = (raw) => {
  const s = cellText(raw)
  if (!s) return { phase: '', unknown: false }
  const mapped = PHASE_MAP[s.toLowerCase()]
  return mapped ? { phase: mapped, unknown: false } : { phase: s, unknown: true }
}

/** Locates the header row, resolves every column by header text, and
 * collects every non-blank row after it (spacer rows skipped, not counted).
 * Shared by listSheets (cheap) and parseSheet (full validation). */
const analyzeSheet = (wb, sheetName) => {
  const ws = wb.Sheets[sheetName]
  if (!ws) return null
  const grid = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null })

  let headerRowIdx = -1
  for (let i = 0; i < grid.length; i++) {
    if (normHeader(grid[i]?.[0]) === 'date') {
      headerRowIdx = i
      break
    }
  }
  if (headerRowIdx === -1) return { grid, headerRowIdx: -1 }

  const header = grid[headerRowIdx]
  const colOf = (name) => header.findIndex((h) => normHeader(h) === name)

  const dateCol = colOf('date')
  const particularsCol = colOf('particulars')
  const amountCol = colOf('amount')
  const statusCols = header.reduce(
    (acc, h, i) => (normHeader(h) === 'status' ? [...acc, i] : acc),
    [],
  )
  const budgetHeadCol = colOf('budget head')
  const phaseCol = colOf('phase')
  const remarksCol = colOf('remarks')

  const activityCandidates = header.reduce(
    (acc, h, i) => (ACTIVITY_HEADER_CANDIDATES.includes(normHeader(h)) ? [...acc, i] : acc),
    [],
  )

  const dataStart = headerRowIdx + 1
  const relevantCols = [dateCol, particularsCol, amountCol, ...activityCandidates].filter(
    (c) => c >= 0,
  )
  const contentRows = []
  for (let i = dataStart; i < grid.length; i++) {
    const row = grid[i]
    const hasContent = relevantCols.some((c) => cellText(row[c]) !== '')
    if (hasContent) contentRows.push({ idx: i, row })
  }

  // P3: when both an activity-ish column exists (e.g. Main Activities +
  // Sub Activities), the one with more non-empty values among data rows wins.
  let activityCol = null
  if (activityCandidates.length === 1) {
    activityCol = activityCandidates[0]
  } else if (activityCandidates.length > 1) {
    activityCol = activityCandidates.reduce((best, c) => {
      const count = contentRows.filter((r) => cellText(r.row[c]) !== '').length
      const bestCount = contentRows.filter((r) => cellText(r.row[best]) !== '').length
      return count > bestCount ? c : best
    }, activityCandidates[0])
  }

  return {
    grid,
    headerRowIdx,
    dateCol,
    particularsCol,
    amountCol,
    statusCol: statusCols[0] ?? -1,
    paidCol: statusCols[1] ?? -1,
    budgetHeadCol,
    phaseCol,
    remarksCol,
    activityCol,
    contentRows,
  }
}

/** Lists every sheet with a row count and whether it has a usable Activity
 * column, so the picker (plan §3 step 2) can grey out the 5 activity-less
 * sheets before the PO wastes a click on them. */
export const listSheets = async (file) => {
  const wb = await readWorkbook(file)
  return wb.SheetNames.map((name) => {
    const a = analyzeSheet(wb, name)
    if (!a || a.headerRowIdx === -1) {
      return { name, dataRowCount: 0, hasActivityColumn: false }
    }
    return {
      name,
      dataRowCount: a.contentRows.length,
      hasActivityColumn: a.activityCol !== null && a.activityCol >= 0,
    }
  })
}

/** Parses one sheet into { rows, errors, warnings, ambiguousDates, meta }. */
export const parseSheet = async (file, sheetName) => {
  const wb = await readWorkbook(file)
  const a = analyzeSheet(wb, sheetName)
  const errors = []
  const warnings = []
  const ambiguousDates = []

  if (!a)
    return {
      rows: [],
      errors: [`Sheet "${sheetName}" was not found in this file.`],
      warnings,
      meta: {},
    }
  if (a.headerRowIdx === -1) {
    return {
      rows: [],
      errors: [`Could not find the header row (a "Date" column) in "${sheetName}".`],
      warnings,
      meta: {},
    }
  }
  if (a.activityCol === null || a.activityCol < 0) {
    return {
      rows: [],
      errors: [
        `This sheet has no Activity column, so its rows cannot be grouped by activity. ` +
          `Pick a different sheet for this project, or ask the officer to add one.`,
      ],
      warnings,
      meta: { sheetName },
    }
  }

  const rows = []
  a.contentRows.forEach(({ idx, row }) => {
    const excelRow = idx + 1

    const { iso: date, ambiguous: dateAmbiguous } = parseLedgerDate(row[a.dateCol])
    if (!date) {
      warnings.push(`Row ${excelRow}: missing or unrecognised date — row excluded.`)
      return
    }
    if (dateAmbiguous) {
      ambiguousDates.push(
        `Row ${excelRow}: date "${date}" came from an Excel date cell where day/month could ` +
          `be swapped (Excel may have misread it) — please verify against the source sheet.`,
      )
    }

    const amount = parseLedgerAmount(row[a.amountCol])
    if (Number.isNaN(amount)) {
      warnings.push(
        `Row ${excelRow}: amount "${cellText(row[a.amountCol])}" is not numeric — row excluded.`,
      )
      return
    }

    const activityRaw = cellText(row[a.activityCol])
    if (!activityRaw) {
      warnings.push(`Row ${excelRow}: no Activity value — row excluded.`)
      return
    }
    const activity = resolveActivity(activityRaw)

    const status = cellText(row[a.statusCol])
    const budgetHead = cellText(row[a.budgetHeadCol])
    if (budgetHead && !KNOWN_BUDGET_HEADS.includes(budgetHead.toLowerCase())) {
      warnings.push(`Row ${excelRow}: unusual Budget Head value "${budgetHead}" — kept as-is.`)
    }
    const { phase, unknown: unknownPhase } = resolvePhase(row[a.phaseCol])
    if (unknownPhase) {
      warnings.push(`Row ${excelRow}: unrecognised Phase "${phase}" — kept as-is.`)
    }

    rows.push({
      rowIndex: excelRow,
      date,
      dateAmbiguous,
      month: date.slice(0, 7),
      particulars: cellText(row[a.particularsCol]),
      amount,
      status,
      committed: status.toLowerCase() === 'committed',
      paid: a.paidCol >= 0 ? cellText(row[a.paidCol]) : '',
      budgetHead,
      phase,
      activityRaw,
      activity,
      remarks: a.remarksCol >= 0 ? cellText(row[a.remarksCol]) : '',
    })
  })

  if (rows.length === 0 && errors.length === 0) {
    errors.push(`No usable transaction rows were found in "${sheetName}".`)
  }

  return {
    rows,
    errors,
    warnings,
    ambiguousDates,
    meta: { sheetName, headerRowIdx: a.headerRowIdx },
  }
}
