// Parses Pace Attendance Software "Monthly Status Report (Detailed Work Duration)" Excel.
//
// Format: transposed block layout — NOT row-per-record.
//   Row 0:  Title "Monthly Status Report (Detailed Work Duration)"
//   Row 2:  Date range "Nov 01 2025  To  Nov 29 2025"
//   Row 6:  Day headers  ["Days", null, "1 St", "2 S", null, "3 M", ...]
//              OR (no spacer variant): ["Days", "1 M", "2 T", ...]
//   Row 8:  Department label
//   Then repeating employee blocks (9 rows each + 1 blank separator):
//     Employee: | (null)... | "THLLXXXX : FULL NAME" | ... | " Total Work Duration: ..."
//     Status    | (null)... | day1_status | day2_status | ...
//     InTime    | (null)... | day1_intime | ...
//     OutTime   | (null)... | day1_outtime | ...
//     Duration  | (null)... | day1_duration | ...
//     Late By   | (null)... | day1_lateby | ...
//     Early By  | (null)... | day1_earlyby | ...
//     OT        | (null)... | day1_ot | ...
//     Shift     | (null)... | day1_shift | ...
//     (blank)
//
// Two layout variants exist: with spacer columns (most files) and without (some files).
// The employee name column is auto-detected so both variants parse correctly.
//
// Returns { rows, errors, warnings, detectedYear, detectedMonth }

import * as XLSX from 'xlsx'

const MONTH_MAP = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
}

const STATUS_NORMALIZE = {
  // Standard Pace statuses
  P: 'Present',
  A: 'Absent',
  HD: 'Half Day',
  WO: 'Weekly Off',
  L: 'On Leave',
  H: 'Holiday',
  // "Weekly Off Present" — employee worked on their scheduled day off
  WOP: 'Present',
  // "Weekly Off Half Present" — worked half a day on their day off
  'WO½P': 'Half Day',
  // "Half Present" — attended for half a day
  '½P': 'Half Day',
  // Long-form variants
  LEAVE: 'On Leave',
  HOLIDAY: 'Holiday',
  PRESENT: 'Present',
  ABSENT: 'Absent',
  'HALF DAY': 'Half Day',
  'WEEKLY OFF': 'Weekly Off',
  'ON LEAVE': 'On Leave',
}

const normalizeStatus = (raw) => {
  if (!raw) return null
  const trimmed = String(raw).trim()
  // Try exact match first, then uppercase match
  return STATUS_NORMALIZE[trimmed] || STATUS_NORMALIZE[trimmed.toUpperCase()] || null
}

// Pace's own "weekly off" code family — WO (didn't work), WOP ("Weekly Off
// Present" — worked a full day on their off day), WO½P ("Weekly Off Half
// Present" — worked half a day on it). All three represent the SAME
// scheduled weekly-off calendar day; only the normalized `status` above
// differs (Weekly Off / Present / Half Day) based on whether they attended.
// Kept as a separate flag (not folded into `status`) so "Weekly Off" reporting
// can show WO+WOP+WO½P together without disturbing present_count/payroll math,
// which must keep treating a worked WOP/WO½P day as attendance.
const WEEKLY_OFF_CODES = new Set(['WO', 'WOP', 'WO½P', 'WEEKLY OFF'])
const isWeeklyOffCode = (raw) => {
  if (!raw) return false
  const trimmed = String(raw).trim()
  return WEEKLY_OFF_CODES.has(trimmed) || WEEKLY_OFF_CODES.has(trimmed.toUpperCase())
}

// "8:25" or "00:00" → "08:25" | null for "00:00" (zero means no activity)
const normTime = (val) => {
  if (val == null || val === '') return null
  const s = String(val).trim()
  if (!s || s === '00:00' || s === '0:00') return null
  const m = s.match(/^(\d{1,2}):(\d{2})/)
  if (!m) return null
  return `${m[1].padStart(2, '0')}:${m[2]}`
}

const normDuration = normTime

// Zero-pad to "HH:MM"
const pad2 = (n) => String(n).padStart(2, '0')

// Scan cols 1-8 for "EMPID : Full Name" — handles both spacer and non-spacer layouts
const findEmpCell = (row) => {
  for (let c = 1; c <= 8; c++) {
    const v = String(row[c] || '').trim()
    if (/^\S+\s*:\s*.+/.test(v)) return v
  }
  return ''
}

export const parseAttendanceExcel = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array', raw: true })
        const ws = wb.Sheets[wb.SheetNames[0]]

        // Read as array-of-arrays so we have precise column indices
        const sheet = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null })

        if (sheet.length < 10) {
          return resolve({
            rows: [],
            errors: ['File is empty or unrecognised format.'],
            warnings: [],
          })
        }

        // ── 1. Detect year + month from date range row ─────────────────────────
        let detectedYear = null
        let detectedMonth = null

        for (let i = 0; i < Math.min(10, sheet.length); i++) {
          const row = sheet[i]
          for (const cell of row) {
            if (!cell) continue
            const s = String(cell)
            // "Nov 01 2025  To  Nov 29 2025"
            const m = s.match(/([A-Za-z]{3})\s+\d+\s+(\d{4})/)
            if (m) {
              detectedMonth = MONTH_MAP[m[1].toLowerCase()] || null
              detectedYear = parseInt(m[2])
              break
            }
          }
          if (detectedYear) break
        }

        // ── 2. Build column→day mapping from the "Days" header row ───────────────
        let colToDay = {} // colIndex → dayOfMonth (1-31)
        let daysRowIdx = -1

        for (let i = 0; i < Math.min(15, sheet.length); i++) {
          if (sheet[i][0] === 'Days') {
            daysRowIdx = i
            sheet[i].forEach((cell, colIdx) => {
              if (!cell) return
              const m = String(cell).match(/^(\d+)\s/)
              if (m) colToDay[colIdx] = parseInt(m[1])
            })
            break
          }
        }

        if (Object.keys(colToDay).length === 0) {
          return resolve({
            rows: [],
            errors: [
              'Could not find the "Days" header row. ' +
                'Make sure this is a Pace Attendance "Monthly Status Report (Detailed Work Duration)" file.',
            ],
            warnings: [],
          })
        }

        // ── 3. Walk rows, collect employee blocks ─────────────────────────────────
        const rows = []
        const errors = []
        const warnings = []

        // Block structure per employee (9 data rows + 1 blank):
        //   offset 0: Employee row — col auto-detected → "EMPID : Full Name"
        //   offset 1-8: Status, InTime, OutTime, Duration, Late By, Early By, OT, Shift

        const ROW_LABELS = [
          'Status',
          'InTime',
          'OutTime',
          'Duration',
          'Late By',
          'Early By',
          'OT',
          'Shift',
        ]

        let i = daysRowIdx + 1
        while (i < sheet.length) {
          const row = sheet[i]
          if (row[0] !== 'Employee:') {
            i++
            continue
          }

          // Auto-detect employee column to support both spacer and non-spacer file variants
          const empCell = findEmpCell(row)
          const empMatch = empCell.match(/^(\S+)\s*:\s*(.+)$/)
          if (!empMatch) {
            warnings.push(
              `Row ${i + 1}: Could not parse Employee ID from "${empCell}" — block skipped`,
            )
            i += 10
            continue
          }

          const employeeId = empMatch[1].trim()
          const employeeName = empMatch[2].trim()

          // Collect the 8 sub-rows by their row label
          const blockRows = {}
          for (let offset = 1; offset <= 8; offset++) {
            const subRow = sheet[i + offset]
            if (!subRow) break
            const label = subRow[0]
            if (label && ROW_LABELS.includes(label)) {
              blockRows[label] = subRow
            }
          }

          if (!blockRows['Status']) {
            warnings.push(`Row ${i + 1} (${employeeId}): Missing Status row — block skipped`)
            i += 10
            continue
          }

          // For each day column, emit one record
          Object.entries(colToDay).forEach(([colIdxStr, dayOfMonth]) => {
            const colIdx = parseInt(colIdxStr)
            const statusRaw = blockRows['Status']?.[colIdx]
            const status = normalizeStatus(statusRaw)

            if (!status) {
              if (statusRaw != null) {
                warnings.push(
                  `${employeeId} day ${dayOfMonth}: unknown status "${statusRaw}" — skipped`,
                )
              }
              return
            }

            // Build ISO date
            let date = null
            if (detectedYear && detectedMonth) {
              date = `${detectedYear}-${pad2(detectedMonth)}-${pad2(dayOfMonth)}`
            }
            if (!date) {
              warnings.push(
                `${employeeId} day ${dayOfMonth}: could not determine year/month — skipped`,
              )
              return
            }

            const inTime = normTime(blockRows['InTime']?.[colIdx])
            const outTime = normTime(blockRows['OutTime']?.[colIdx])
            const duration = normDuration(blockRows['Duration']?.[colIdx])
            const lateBy = normTime(blockRows['Late By']?.[colIdx])
            const earlyBy = normTime(blockRows['Early By']?.[colIdx])
            const overtime = normTime(blockRows['OT']?.[colIdx])
            const shift = String(blockRows['Shift']?.[colIdx] || '').trim()

            rows.push({
              employee_id: employeeId,
              employee_name: employeeName,
              date,
              status,
              is_weekly_off_type: isWeeklyOffCode(statusRaw),
              in_time: inTime,
              out_time: outTime,
              work_duration: duration,
              late_by: lateBy,
              early_by: earlyBy,
              overtime,
              shift,
            })
          })

          i += 10 // skip past this 9-row block + blank separator
        }

        if (rows.length === 0 && errors.length === 0) {
          errors.push(
            'No attendance records could be parsed. ' +
              'Ensure the file is a Pace "Monthly Status Report (Detailed Work Duration)".',
          )
        }

        resolve({ rows, errors, warnings, detectedYear, detectedMonth })
      } catch (err) {
        reject(new Error(`Failed to parse Excel: ${err.message}`))
      }
    }
    reader.readAsArrayBuffer(file)
  })
