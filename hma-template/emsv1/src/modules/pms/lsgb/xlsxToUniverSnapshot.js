/**
 * xlsxToUniverSnapshot.js — converts a parsed SheetJS workbook into Univer's
 * native IWorkbookData snapshot shape.
 *
 * Univer's own xlsx importer (`@univerjs-pro/exchange-client`) is a paid Pro
 * package (proprietary license, depends on @univerjs-pro/collaboration and
 * @univerjs-pro/license) — the official free-tier guidance is to parse the
 * file with an external library and hand-build IWorkbookData, then load it
 * via the Facade API. That's what this file does, using the `xlsx` package
 * already in this repo.
 *
 * Fidelity: cell values, formulas (so Univer's own formula engine
 * recalculates them), merged cells, and column widths carry over. Cell
 * background/font styling and explicit number formats are not mapped —
 * best-effort, not full parity with the Pro importer.
 */
import * as XLSX from 'xlsx'

const uid = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

const colWidthFromChars = (wch) => (wch ? Math.round(wch * 7 + 5) : undefined)

const buildSheetData = (ws, name, sheetId) => {
  const ref = ws['!ref'] || 'A1'
  const range = XLSX.utils.decode_range(ref)
  const rowCount = Math.max(range.e.r + 1, 30)
  const columnCount = Math.max(range.e.c + 1, 10)

  const cellData = {}
  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c })
      const cell = ws[addr]
      if (!cell) continue

      const cellValue = {}
      if (cell.f) {
        // Univer's engine-formula recalculates from the formula string —
        // SheetJS's cell.f has no leading '='.
        cellValue.f = `=${cell.f}`
      } else if (cell.t === 'n' || cell.t === 'b') {
        cellValue.v = cell.v
      } else if (cell.t === 'd') {
        // No explicit date format is applied (see file header), so store the
        // readable formatted text SheetJS computes rather than a bare serial
        // number that would otherwise show as an unformatted integer.
        cellValue.v = cell.w ?? String(cell.v)
      } else {
        cellValue.v = cell.w ?? (cell.v == null ? '' : String(cell.v))
      }

      if (Object.keys(cellValue).length) {
        if (!cellData[r]) cellData[r] = {}
        cellData[r][c] = cellValue
      }
    }
  }

  const mergeData = (ws['!merges'] || []).map((m) => ({
    startRow: m.s.r,
    startColumn: m.s.c,
    endRow: m.e.r,
    endColumn: m.e.c,
  }))

  const columnData = {}
  ;(ws['!cols'] || []).forEach((col, i) => {
    const w = colWidthFromChars(col?.wch)
    if (w) columnData[i] = { w, hd: 0 }
  })

  return {
    id: sheetId,
    name,
    tabColor: '',
    hidden: 0,
    rowCount,
    columnCount,
    zoomRatio: 1,
    freeze: { startRow: -1, startColumn: -1, ySplit: 0, xSplit: 0 },
    scrollTop: 0,
    scrollLeft: 0,
    defaultColumnWidth: 100,
    defaultRowHeight: 24,
    mergeData,
    cellData,
    rowData: {},
    columnData,
    showGridlines: 1,
    rowHeader: { width: 46, hidden: 0 },
    columnHeader: { height: 20, hidden: 0 },
    rightToLeft: 0,
  }
}

/** Reads a File (.xlsx/.xls) and resolves to a Univer IWorkbookData snapshot. */
export const readWorkbookAsUniverSnapshot = (file, workbookName) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('READ_FAILED'))
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array', cellFormula: true })
        const sheets = {}
        const sheetOrder = []
        wb.SheetNames.forEach((name) => {
          const ws = wb.Sheets[name]
          if (!ws) return
          const sheetId = uid('sheet')
          sheets[sheetId] = buildSheetData(ws, name, sheetId)
          sheetOrder.push(sheetId)
        })
        if (sheetOrder.length === 0) {
          reject(new Error('EMPTY_WORKBOOK'))
          return
        }
        resolve({
          id: uid('workbook'),
          sheetOrder,
          name: workbookName || 'LSGB Projects',
          appVersion: '0.25.1',
          locale: 'enUS',
          styles: {},
          sheets,
        })
      } catch {
        reject(new Error('READ_FAILED'))
      }
    }
    reader.readAsArrayBuffer(file)
  })
