import React, { useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CDropdown,
  CDropdownMenu,
  CDropdownToggle,
  CFormCheck,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CRow,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilCloudUpload, cilCloudDownload, cilX } from '@coreui/icons'
import * as XLSX from 'xlsx-js-style'

import useAuth from '../../../../hooks/useAuth'
import { localGstBills } from '../../../../services/localGstBills'
import { computeGstFields } from '../../../../services/gstCalculations'
import GstUploadModal from './GstUploadModal'
import EditableCell from './EditableCell'

const money = (n) =>
  n == null
    ? '—'
    : Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const BASE_HEADERS = [
  'SL',
  'Department',
  'Vertical',
  'Party Name',
  'GST No',
  'Invoice Date',
  'Invoice Number',
  'Total Value (incl. tax)',
  'GST Rate %',
  'CESS %',
  'State',
  'Taxable Value',
  'CGST',
  'SGST',
  'IGST',
  'CESS Amount',
]
const FINANCE_HEADERS = ['Accounted status', 'Eligibility']

const SORT_OPTIONS = [
  { value: 'upload_asc', label: 'Upload date (oldest first)', key: 'createdAt', dir: 1 },
  { value: 'upload_desc', label: 'Upload date (newest first)', key: 'createdAt', dir: -1 },
  { value: 'invoice_asc', label: 'Invoice date (oldest first)', key: 'invoiceDate', dir: 1 },
  { value: 'invoice_desc', label: 'Invoice date (newest first)', key: 'invoiceDate', dir: -1 },
]

const numCell = { textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }

// Whole days between an ISO timestamp and now — used to flag how long a
// bill has sat "Not Accounted" so Finance/CEO can see accounting delay.
const daysSince = (isoDate) => {
  if (!isoDate) return null
  const then = new Date(isoDate)
  if (Number.isNaN(then.getTime())) return null
  return Math.max(0, Math.floor((Date.now() - then.getTime()) / 86400000))
}

const delayBadgeColor = (days) => (days >= 8 ? 'danger' : days >= 4 ? 'warning' : 'secondary')

// Two-segment status toggle: single click to flip state, both options always
// visible and colored, instead of opening a dropdown to pick one — the
// active option is filled, the inactive one outlined.
const StatusToggle = ({ value, options, disabled, onChange, ariaLabel }) => (
  <div className="btn-group btn-group-sm" role="group" aria-label={ariaLabel}>
    {options.map((opt) => (
      <button
        key={opt.value}
        type="button"
        className={`btn btn-sm ${value === opt.value ? `btn-${opt.color}` : `btn-outline-${opt.color}`}`}
        disabled={disabled}
        onClick={() => value !== opt.value && onChange(opt.value)}
      >
        {opt.label}
      </button>
    ))}
  </div>
)

StatusToggle.propTypes = {
  value: PropTypes.string.isRequired,
  options: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      color: PropTypes.string.isRequired,
    }),
  ).isRequired,
  disabled: PropTypes.bool,
  onChange: PropTypes.func.isRequired,
  ariaLabel: PropTypes.string,
}

StatusToggle.defaultProps = { disabled: false, ariaLabel: undefined }

const ACCOUNTED_OPTIONS = [
  { value: 'Not Accounted', label: 'Not Accounted', color: 'danger' },
  { value: 'Accounted', label: 'Accounted', color: 'success' },
]
const ELIGIBILITY_OPTIONS = [
  { value: 'Not Eligible', label: 'Not Eligible', color: 'danger' },
  { value: 'Eligible', label: 'Eligible', color: 'success' },
]

// Case-insensitive distinct values of one entry field, in alphabetical order.
const distinctValues = (entries, field) => {
  const seen = new Map()
  entries.forEach((e) => {
    const v = (e[field] || '').trim()
    if (v && !seen.has(v.toLowerCase())) seen.set(v.toLowerCase(), v)
  })
  return [...seen.values()].sort((x, y) => x.localeCompare(y))
}

// Filter + sort one entries list into display/export rows. The on-screen
// table and the Download Report modal share this so "same as selected
// before" exports exactly what the table shows. `accounted`
// ('all' | 'Accounted' | 'Not Accounted') is only used by the export modal.
const filterAndSort = (entries, opts) => {
  const {
    deptSelected = [],
    vertSelected = [],
    batchFilter = 'all',
    dateField = 'upload',
    dateFrom = '',
    dateTo = '',
    sortBy = 'upload_asc',
    accountedFirst = false,
    accounted = 'all',
    eligibility = 'all',
  } = opts

  let list = entries
  if (deptSelected.length > 0) {
    list = list.filter((e) => deptSelected.includes((e.department || '').trim().toLowerCase()))
  }
  if (vertSelected.length > 0) {
    list = list.filter((e) => vertSelected.includes((e.vertical || '').trim().toLowerCase()))
  }
  if (batchFilter !== 'all') list = list.filter((e) => e.batchId === batchFilter)
  if (dateFrom || dateTo) {
    list = list.filter((e) => {
      const d =
        dateField === 'upload'
          ? (e.createdAt || '').slice(0, 10)
          : (e.invoiceDate || '').slice(0, 10)
      if (!d) return false
      if (dateFrom && d < dateFrom) return false
      if (dateTo && d > dateTo) return false
      return true
    })
  }
  if (accounted !== 'all') {
    list = list.filter((e) => (e.accounted || 'Not Accounted') === accounted)
  }
  if (eligibility !== 'all') {
    list = list.filter((e) => (e.eligibility || 'Eligible') === eligibility)
  }

  const { key, dir } = SORT_OPTIONS.find((o) => o.value === sortBy) || SORT_OPTIONS[0]
  list = [...list].sort((a, b) => {
    // Finance view: Not Accounted bills stay on top; Accounted sink down.
    if (accountedFirst) {
      const ga = a.accounted === 'Accounted' ? 1 : 0
      const gb = b.accounted === 'Accounted' ? 1 : 0
      if (ga !== gb) return ga - gb
    }
    const va = a[key] || ''
    const vb = b[key] || ''
    if (va === vb) return 0
    if (!va) return 1 // rows without the date always sink
    if (!vb) return -1
    return va < vb ? -dir : dir
  })

  return list.map((e) => ({ ...e, computed: computeGstFields(e) }))
}

// Checkbox-list dropdown (Department / Vertical) that stays open while ticking.
const MultiSelectDropdown = ({ label, options, selected, onChange }) => (
  <CDropdown autoClose="outside" variant="btn-group">
    <CDropdownToggle color="secondary" variant="outline" size="sm">
      {label}
      {selected.length > 0 ? ` (${selected.length})` : ''}
    </CDropdownToggle>
    <CDropdownMenu style={{ maxHeight: 260, overflowY: 'auto', minWidth: 200 }}>
      {options.length === 0 && <div className="px-3 py-1 small text-body-secondary">No values</div>}
      {options.map((opt) => {
        const key = opt.toLowerCase()
        const checked = selected.includes(key)
        return (
          <div key={key} className="px-3 py-1">
            <CFormCheck
              id={`${label}-${key}`}
              label={opt}
              checked={checked}
              onChange={() =>
                onChange(checked ? selected.filter((s) => s !== key) : [...selected, key])
              }
            />
          </div>
        )
      })}
    </CDropdownMenu>
  </CDropdown>
)

MultiSelectDropdown.propTypes = {
  label: PropTypes.string.isRequired,
  options: PropTypes.arrayOf(PropTypes.string).isRequired,
  selected: PropTypes.arrayOf(PropTypes.string).isRequired,
  onChange: PropTypes.func.isRequired,
}

// Removable active-filter chip (Amazon-style).
const FilterChip = ({ text, onRemove }) => (
  <CBadge
    color="light"
    className="text-dark border d-inline-flex align-items-center gap-1 me-1 mb-1"
    style={{ fontWeight: 500, fontSize: '0.78rem' }}
  >
    {text}
    <CIcon icon={cilX} size="sm" role="button" onClick={onRemove} />
  </CBadge>
)

FilterChip.propTypes = {
  text: PropTypes.string.isRequired,
  onRemove: PropTypes.func.isRequired,
}

/**
 * Shared GST bills table + upload flow. Used both by the Finance team's
 * full view (with Accounted/Eligibility) and the HR "Upload GST Bill" view
 * (same upload + basic-field editing, but those two Finance-only columns
 * are entirely omitted — not just disabled — since that decision belongs
 * to the Head of Finance).
 */
const GstBillsView = ({
  title,
  canView,
  canEdit,
  showFinanceFields,
  projectId,
  isProjectView,
  defaultDepartment,
  defaultVertical,
}) => {
  const { user } = useAuth()
  const [uploadOpen, setUploadOpen] = useState(false)
  const [entries, setEntries] = useState(() => localGstBills.entries.list())
  const [batches, setBatches] = useState(() => localGstBills.batches.list())

  // Embedded in a Project Detail page: scope to that project's bills only.
  const scopedEntries = useMemo(
    () => (projectId ? entries.filter((e) => e.projectId === projectId) : entries),
    [entries, projectId],
  )
  const scopedBatches = useMemo(
    () => (projectId ? batches.filter((b) => b.projectId === projectId) : batches),
    [batches, projectId],
  )
  // Upload/delete actions are available to Finance editors, and always to
  // an embedded project-scoped card (whoever can see the project can manage
  // its bills).
  const showActions = canEdit || isProjectView

  // Non-Finance surfaces (HR Admin's upload page, and the project-embedded
  // card) are upload-only intake points, not editing surfaces: once a sheet
  // is uploaded there, nobody can edit a cell or delete the batch from here
  // — corrections happen on the main Finance > GST Bills page instead. Those
  // surfaces default to just the Upload History list, with a toggle to peek
  // at the underlying bill details read-only.
  const restricted = !showFinanceFields
  const cellsDisabled = restricted || !canEdit
  const [detailsOpen, setDetailsOpen] = useState(false)

  // ── Filters (top bar with chips) ────────────────────────────────────
  const [deptSelected, setDeptSelected] = useState([]) // lowercase values
  const [vertSelected, setVertSelected] = useState([])
  const [batchFilter, setBatchFilter] = useState('all')
  const [dateField, setDateField] = useState('upload') // 'upload' | 'invoice'
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortBy, setSortBy] = useState('upload_asc')

  // ── Delete-upload confirmation (type "delete") ──────────────────────
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteText, setDeleteText] = useState('')

  // ── Download Report options modal ───────────────────────────────────
  const [exportOpen, setExportOpen] = useState(false)
  const [exportScope, setExportScope] = useState('current') // 'current' | 'all' | 'custom'
  const [exportDepts, setExportDepts] = useState([])
  const [exportVerts, setExportVerts] = useState([])
  const [exportDateField, setExportDateField] = useState('upload') // 'upload' | 'invoice'
  const [exportFrom, setExportFrom] = useState('')
  const [exportTo, setExportTo] = useState('')
  const [exportAccounted, setExportAccounted] = useState('all') // 'all' | 'Accounted' | 'Not Accounted'
  const [exportEligibility, setExportEligibility] = useState('all') // 'all' | 'Eligible' | 'Not Eligible'

  const reload = () => {
    setEntries(localGstBills.entries.list())
    setBatches(localGstBills.batches.list())
  }

  const updateEntry = (id, patch) => {
    localGstBills.entries.update(id, patch)
    reload()
  }

  const departments = useMemo(() => distinctValues(scopedEntries, 'department'), [scopedEntries])
  const verticals = useMemo(() => distinctValues(scopedEntries, 'vertical'), [scopedEntries])

  const rows = useMemo(
    () =>
      filterAndSort(scopedEntries, {
        deptSelected,
        vertSelected,
        batchFilter,
        dateField,
        dateFrom,
        dateTo,
        sortBy,
        accountedFirst: showFinanceFields,
      }),
    [
      scopedEntries,
      deptSelected,
      vertSelected,
      batchFilter,
      dateField,
      dateFrom,
      dateTo,
      sortBy,
      showFinanceFields,
    ],
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

  // Accounted vs. Not Accounted breakdown, plus a per-bill delay list (upload
  // date vs. today) for Finance/CEO visibility into how long each pending
  // bill has been sitting unaccounted. Computed over all scoped bills, not
  // just the current on-screen filter, so it always reflects the true
  // backlog regardless of what's filtered into view.
  const accountingOverview = useMemo(() => {
    if (!showFinanceFields) return null
    const sumValue = (list) => list.reduce((s, e) => s + (Number(e.totalValue) || 0), 0)
    const accounted = scopedEntries.filter((e) => (e.accounted || 'Not Accounted') === 'Accounted')
    const notAccounted = scopedEntries.filter(
      (e) => (e.accounted || 'Not Accounted') !== 'Accounted',
    )
    const delayed = notAccounted
      .map((e) => ({ ...e, delayDays: daysSince(e.createdAt) }))
      .filter((e) => e.delayDays != null)
      .sort((a, b) => b.delayDays - a.delayDays)
    return {
      totalCount: scopedEntries.length,
      accountedCount: accounted.length,
      accountedValue: sumValue(accounted),
      notAccountedCount: notAccounted.length,
      notAccountedValue: sumValue(notAccounted),
      delayed,
    }
  }, [scopedEntries, showFinanceFields])

  const clearAllFilters = () => {
    setDeptSelected([])
    setVertSelected([])
    setBatchFilter('all')
    setDateFrom('')
    setDateTo('')
  }

  const hasActiveFilters =
    deptSelected.length > 0 ||
    vertSelected.length > 0 ||
    batchFilter !== 'all' ||
    dateFrom !== '' ||
    dateTo !== ''

  // Restore original casing for a chip from the derived option lists.
  const displayName = (options, lower) => options.find((o) => o.toLowerCase() === lower) || lower

  // ── Consolidated Excel export ────────────────────────────────────────
  // Builds the row set the Download Report modal asked for.
  const buildExportRows = () => {
    if (exportScope === 'all') {
      return filterAndSort(scopedEntries, {
        sortBy,
        accountedFirst: showFinanceFields,
        accounted: exportAccounted,
        eligibility: exportEligibility,
      })
    }
    if (exportScope === 'custom') {
      return filterAndSort(scopedEntries, {
        deptSelected: exportDepts,
        vertSelected: exportVerts,
        dateField: exportDateField,
        dateFrom: exportFrom,
        dateTo: exportTo,
        sortBy,
        accountedFirst: showFinanceFields,
        accounted: exportAccounted,
        eligibility: exportEligibility,
      })
    }
    // 'current' — exactly what the table shows, plus the accounted/eligibility choice
    return filterAndSort(scopedEntries, {
      deptSelected,
      vertSelected,
      batchFilter,
      dateField,
      dateFrom,
      dateTo,
      sortBy,
      accountedFirst: showFinanceFields,
      accounted: exportAccounted,
      eligibility: exportEligibility,
    })
  }

  // Human-readable description of the chosen scope — goes into the report
  // title band and the file name.
  const exportScopeLabel = () => {
    let label
    if (exportScope === 'all') {
      label = 'All Data'
    } else if (exportScope === 'current') {
      label =
        deptSelected.length > 0
          ? deptSelected.map((d) => displayName(departments, d)).join(', ')
          : 'Current View'
    } else {
      const parts = []
      if (exportDepts.length > 0) {
        parts.push(exportDepts.map((d) => displayName(departments, d)).join(', '))
      }
      if (exportVerts.length > 0) {
        parts.push(`Vertical ${exportVerts.map((v) => displayName(verticals, v)).join(', ')}`)
      }
      if (exportFrom || exportTo) {
        parts.push(
          `${exportDateField === 'upload' ? 'Uploaded' : 'Invoice dated'} ${exportFrom || 'start'} to ${exportTo || 'today'}`,
        )
      }
      label = parts.length > 0 ? parts.join(' · ') : 'All Departments'
    }
    if (exportAccounted !== 'all') label += ` · ${exportAccounted} only`
    if (exportEligibility !== 'all') label += ` · ${exportEligibility} only`
    return label
  }

  // Styled (xlsx-js-style): yellow header band, bordered tabular cells, and
  // each multi-rate bill (same GST No + Invoice Number, one row per GST
  // rate) rendered as its own boxed mini-table — a gold band naming the
  // bill, tinted rate lines, then a bold BILL TOTAL row.
  const handleExport = (exportRows, scopeLabel) => {
    const headers = [...BASE_HEADERS, ...FINANCE_HEADERS]
    const COLS = headers.length

    const edge = { style: 'thin', color: { rgb: 'B0B7C3' } }
    const border = { top: edge, bottom: edge, left: edge, right: edge }
    const styles = {
      title: {
        font: { bold: true, sz: 14, color: { rgb: '7F6000' } },
        fill: { fgColor: { rgb: 'FFE699' } },
        alignment: { horizontal: 'center', vertical: 'center' },
      },
      head: {
        font: { bold: true, sz: 10 },
        fill: { fgColor: { rgb: 'FFD966' } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border,
      },
      cell: { font: { sz: 10 }, border },
      groupBand: {
        font: { bold: true, sz: 10, color: { rgb: '7F6000' } },
        fill: { fgColor: { rgb: 'FFF2CC' } },
        border,
      },
      groupCell: { font: { sz: 10 }, fill: { fgColor: { rgb: 'FFF9E6' } }, border },
      groupTotal: { font: { bold: true, sz: 10 }, fill: { fgColor: { rgb: 'FFE699' } }, border },
    }
    const MONEY = '#,##0.00'
    const txt = (v, s) => ({ v: v == null || v === '' ? '' : String(v), t: 's', s })
    const num = (v, s) => ({
      v: Math.round(((Number(v) || 0) + Number.EPSILON) * 100) / 100,
      t: 'n',
      z: MONEY,
      s,
    })
    const rate = (v, s) =>
      v == null || v === '' ? txt('', s) : { v: Number(v), t: 'n', z: 'General', s }

    const billCells = (r, slCell, s) => [
      slCell,
      txt(r.department, s),
      txt(r.vertical, s),
      txt(r.partyName, s),
      txt(r.gstNo, s),
      txt(r.invoiceDate, s),
      txt(r.invoiceNumber, s),
      num(r.totalValue, s),
      rate(r.gstRate, s),
      rate(r.cessRate, s),
      txt(r.computed.state ?? '', s),
      num(r.computed.taxableValue, s),
      num(r.computed.cgst, s),
      num(r.computed.sgst, s),
      num(r.computed.igst, s),
      num(r.computed.cessAmount, s),
      txt(r.accounted, s),
      txt(r.eligibility, s),
    ]

    // Group in current display order: same GST No + Invoice Number = one
    // bill whose rate lines were entered separately (one row per GST rate).
    const groups = new Map()
    exportRows.forEach((r) => {
      const gst = (r.gstNo || '').trim().toUpperCase()
      const inv = (r.invoiceNumber || '').trim().toUpperCase()
      const key = gst && inv ? `${gst}|${inv}` : `row:${r.id}`
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(r)
    })

    const aoa = []
    const merges = []

    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: COLS - 1 } })
    aoa.push([
      txt(
        `GST BILLS — CONSOLIDATED REPORT · ${scopeLabel} · ${new Date().toLocaleDateString('en-IN')}`,
        styles.title,
      ),
      ...Array(COLS - 1).fill(txt('', styles.title)),
    ])
    aoa.push([])
    aoa.push(headers.map((h) => txt(h, styles.head)))

    let sl = 0
    groups.forEach((group) => {
      sl += 1
      if (group.length === 1) {
        aoa.push(billCells(group[0], { v: sl, t: 'n', z: '0', s: styles.cell }, styles.cell))
        return
      }

      // Multi-rate bill: its own boxed mini-table inside the sheet.
      const first = group[0]
      merges.push({ s: { r: aoa.length, c: 1 }, e: { r: aoa.length, c: COLS - 1 } })
      aoa.push([
        { v: sl, t: 'n', z: '0', s: styles.groupBand },
        txt(
          `${first.partyName || 'Unknown party'} — Invoice ${first.invoiceNumber} · GST ${first.gstNo} · ${group.length} items with different GST rates`,
          styles.groupBand,
        ),
        ...Array(COLS - 2).fill(txt('', styles.groupBand)),
      ])
      group.forEach((r) => {
        aoa.push(billCells(r, txt('', styles.groupCell), styles.groupCell))
      })
      const sum = (fn) => group.reduce((s, r) => s + (fn(r) || 0), 0)
      const t = styles.groupTotal
      aoa.push([
        txt('', t),
        txt('', t),
        txt('', t),
        txt('BILL TOTAL', t),
        txt(first.gstNo, t),
        txt('', t),
        txt(first.invoiceNumber, t),
        num(
          sum((r) => Number(r.totalValue)),
          t,
        ),
        txt('', t),
        txt('', t),
        txt('', t),
        num(
          sum((r) => r.computed.taxableValue),
          t,
        ),
        num(
          sum((r) => r.computed.cgst),
          t,
        ),
        num(
          sum((r) => r.computed.sgst),
          t,
        ),
        num(
          sum((r) => r.computed.igst),
          t,
        ),
        num(
          sum((r) => r.computed.cessAmount),
          t,
        ),
        txt('', t),
        txt('', t),
      ])
    })

    const ws = XLSX.utils.aoa_to_sheet(aoa)
    ws['!merges'] = merges
    ws['!cols'] = headers.map((h) => ({ wch: Math.max(h.length + 2, 13) }))
    ws['!rows'] = aoa.map((_, i) => (i === 0 ? { hpt: 26 } : i === 2 ? { hpt: 28 } : { hpt: 16 }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'GST Bills')
    const safeScope = scopeLabel.replace(/[^\w-]+/g, '_').slice(0, 40)
    XLSX.writeFile(wb, `gst-bills-${safeScope}-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const confirmDeleteBatch = () => {
    if (!deleteTarget || deleteText.trim().toLowerCase() !== 'delete') return
    localGstBills.batches.remove(deleteTarget.id)
    if (batchFilter === deleteTarget.id) setBatchFilter('all')
    setDeleteTarget(null)
    setDeleteText('')
    reload()
  }

  if (!canView && !isProjectView) {
    return <CAlert color="warning">You do not have access to this section.</CAlert>
  }

  const headers = showFinanceFields ? [...BASE_HEADERS, ...FINANCE_HEADERS] : BASE_HEADERS
  const cardProps = isProjectView
    ? { className: 'border-0 shadow-sm mt-4', style: { borderRadius: '12px' } }
    : {}

  // One upload = one row here. Delete is Finance-only — restricted surfaces
  // (HR Admin, project-embedded) can see history but never remove a batch.
  const batchListRows = scopedBatches.map((b) => (
    <div key={b.id} className="d-flex align-items-center gap-2 py-1 border-bottom">
      <span>
        {b.fileName} — uploaded {new Date(b.uploadedAt).toLocaleDateString('en-IN')}
        {b.uploadedBy ? ` by ${b.uploadedBy}` : ''} (
        {entries.filter((e) => e.batchId === b.id).length} entries)
      </span>
      {!restricted && (
        <CButton
          color="danger"
          variant="outline"
          size="sm"
          onClick={() => {
            setDeleteTarget(b)
            setDeleteText('')
          }}
        >
          Delete
        </CButton>
      )}
    </div>
  ))

  // Filters + the full (read-only when restricted) bill table. Always shown
  // on the Finance page; shown on restricted surfaces only once "Show
  // Details" is toggled open.
  const filterBarAndTable = (
    <>
      <CRow className="mb-2 g-2 align-items-end">
        <CCol xs="auto">
          <MultiSelectDropdown
            label="Department"
            options={departments}
            selected={deptSelected}
            onChange={setDeptSelected}
          />
        </CCol>
        <CCol xs="auto">
          <MultiSelectDropdown
            label="Vertical"
            options={verticals}
            selected={vertSelected}
            onChange={setVertSelected}
          />
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
            {scopedBatches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.fileName} ({new Date(b.uploadedAt).toLocaleDateString('en-IN')})
              </option>
            ))}
          </CFormSelect>
        </CCol>
        <CCol xs="auto">
          <div className="small mb-0">Date filter</div>
          <div className="d-flex align-items-center gap-2">
            <CFormCheck
              type="radio"
              name="gst-date-field"
              id="gst-date-upload"
              label="Upload date"
              checked={dateField === 'upload'}
              onChange={() => setDateField('upload')}
            />
            <CFormCheck
              type="radio"
              name="gst-date-field"
              id="gst-date-invoice"
              label="Invoice date"
              checked={dateField === 'invoice'}
              onChange={() => setDateField('invoice')}
            />
          </div>
        </CCol>
        <CCol xs="auto">
          <CFormLabel htmlFor="gst-date-from" className="mb-0 small">
            From
          </CFormLabel>
          <CFormInput
            id="gst-date-from"
            type="date"
            size="sm"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </CCol>
        <CCol xs="auto">
          <CFormLabel htmlFor="gst-date-to" className="mb-0 small">
            To
          </CFormLabel>
          <CFormInput
            id="gst-date-to"
            type="date"
            size="sm"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </CCol>
        <CCol xs="auto" className="ms-auto">
          <CFormLabel htmlFor="gst-sort" className="mb-0 small">
            Sort by
          </CFormLabel>
          <CFormSelect
            id="gst-sort"
            size="sm"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </CFormSelect>
        </CCol>
      </CRow>

      {hasActiveFilters && (
        <div className="mb-3 d-flex align-items-center flex-wrap">
          {deptSelected.map((d) => (
            <FilterChip
              key={`dept-${d}`}
              text={`Department: ${displayName(departments, d)}`}
              onRemove={() => setDeptSelected(deptSelected.filter((x) => x !== d))}
            />
          ))}
          {vertSelected.map((v) => (
            <FilterChip
              key={`vert-${v}`}
              text={`Vertical: ${displayName(verticals, v)}`}
              onRemove={() => setVertSelected(vertSelected.filter((x) => x !== v))}
            />
          ))}
          {batchFilter !== 'all' && (
            <FilterChip
              text={`Upload: ${batches.find((b) => b.id === batchFilter)?.fileName || batchFilter}`}
              onRemove={() => setBatchFilter('all')}
            />
          )}
          {(dateFrom || dateTo) && (
            <FilterChip
              text={`${dateField === 'upload' ? 'Uploaded' : 'Invoice'}: ${dateFrom || '…'} → ${dateTo || '…'}`}
              onRemove={() => {
                setDateFrom('')
                setDateTo('')
              }}
            />
          )}
          <CButton color="link" size="sm" className="p-0 ms-1 mb-1" onClick={clearAllFilters}>
            Clear all
          </CButton>
        </div>
      )}

      {rows.length === 0 ? (
        <CAlert color="info" className="mb-0">
          {scopedEntries.length > 0
            ? 'No GST bills match the current filters.'
            : `No GST bills yet. ${showActions ? 'Upload the expenditure statement Excel to begin.' : ''}`}
        </CAlert>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="table table-bordered table-sm align-middle mb-0">
            <thead>
              <tr>
                {headers.map((h) => (
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
                  <td>
                    <EditableCell
                      value={r.department}
                      disabled={cellsDisabled}
                      onCommit={(v) => updateEntry(r.id, { department: v })}
                    />
                  </td>
                  <td>
                    <EditableCell
                      value={r.vertical}
                      disabled={cellsDisabled}
                      onCommit={(v) => updateEntry(r.id, { vertical: v })}
                    />
                  </td>
                  <td>
                    <EditableCell
                      value={r.partyName}
                      disabled={cellsDisabled}
                      onCommit={(v) => updateEntry(r.id, { partyName: v })}
                    />
                  </td>
                  <td className="text-nowrap">
                    <EditableCell
                      value={r.gstNo}
                      disabled={cellsDisabled}
                      onCommit={(v) => updateEntry(r.id, { gstNo: v.toUpperCase() })}
                    />
                    {r.computed.gstinStatus === 'invalid' && (
                      <div className="text-danger small">Invalid GST No</div>
                    )}
                  </td>
                  <td className="text-nowrap">
                    <EditableCell
                      value={r.invoiceDate}
                      type="date"
                      disabled={cellsDisabled}
                      onCommit={(v) => updateEntry(r.id, { invoiceDate: v })}
                    />
                  </td>
                  <td>
                    <EditableCell
                      value={r.invoiceNumber}
                      disabled={cellsDisabled}
                      onCommit={(v) => updateEntry(r.id, { invoiceNumber: v })}
                    />
                  </td>
                  <td style={numCell} className={r.needsAttention ? 'table-danger' : undefined}>
                    <EditableCell
                      value={r.totalValue}
                      type="number"
                      disabled={cellsDisabled}
                      onCommit={(v) => updateEntry(r.id, { totalValue: v, needsAttention: false })}
                    />
                  </td>
                  <td style={numCell}>
                    <EditableCell
                      value={r.gstRate}
                      type="number"
                      listId="gst-rate-options"
                      disabled={cellsDisabled}
                      onCommit={(v) => updateEntry(r.id, { gstRate: v, needsAttention: false })}
                    />
                  </td>
                  <td style={numCell}>
                    <EditableCell
                      value={r.cessRate}
                      type="number"
                      disabled={cellsDisabled}
                      onCommit={(v) => updateEntry(r.id, { cessRate: v })}
                    />
                  </td>
                  <td className="text-nowrap">{r.computed.state ?? '—'}</td>
                  <td style={numCell}>{money(r.computed.taxableValue)}</td>
                  <td style={numCell}>{money(r.computed.cgst)}</td>
                  <td style={numCell}>{money(r.computed.sgst)}</td>
                  <td style={numCell}>{money(r.computed.igst)}</td>
                  <td style={numCell}>{money(r.computed.cessAmount)}</td>
                  {showFinanceFields && (
                    <>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <StatusToggle
                            value={r.accounted}
                            options={ACCOUNTED_OPTIONS}
                            disabled={cellsDisabled}
                            onChange={(v) => updateEntry(r.id, { accounted: v })}
                            ariaLabel="Accounted status"
                          />
                          {r.accounted !== 'Accounted' &&
                            (() => {
                              const days = daysSince(r.createdAt)
                              return days == null ? null : (
                                <CBadge
                                  color={delayBadgeColor(days)}
                                  title="Days since upload, still not accounted"
                                >
                                  {days === 0 ? 'Today' : `${days}d`}
                                </CBadge>
                              )
                            })()}
                        </div>
                      </td>
                      <td>
                        <StatusToggle
                          value={r.eligibility}
                          options={ELIGIBILITY_OPTIONS}
                          disabled={cellsDisabled}
                          onChange={(v) => updateEntry(r.id, { eligibility: v })}
                          ariaLabel="Eligibility"
                        />
                      </td>
                    </>
                  )}
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
                {showFinanceFields && <td colSpan={2} />}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </>
  )

  // Accounted vs. Not Accounted breakdown + per-bill delay list, shown on
  // the Finance page only (not on restricted upload-only surfaces), placed
  // before Upload History so the Head of Finance / CEO see the backlog
  // before the raw upload log.
  const accountingOverviewCard = accountingOverview && accountingOverview.totalCount > 0 && (
    <CCard className="mb-4">
      <CCardHeader className="fw-semibold">Accounting Status Overview</CCardHeader>
      <CCardBody>
        <CRow className="g-3 mb-3">
          <CCol sm={4}>
            <div className="small text-body-secondary">Total Bills</div>
            <div className="fs-4 fw-bold">{accountingOverview.totalCount}</div>
          </CCol>
          <CCol sm={4}>
            <div className="small text-body-secondary">Accounted</div>
            <div className="fs-4 fw-bold text-success">
              {accountingOverview.accountedCount}
              <span className="fs-6 fw-normal text-body-secondary ms-2">
                ({money(accountingOverview.accountedValue)})
              </span>
            </div>
          </CCol>
          <CCol sm={4}>
            <div className="small text-body-secondary">Not Accounted</div>
            <div className="fs-4 fw-bold text-danger">
              {accountingOverview.notAccountedCount}
              <span className="fs-6 fw-normal text-body-secondary ms-2">
                ({money(accountingOverview.notAccountedValue)})
              </span>
            </div>
          </CCol>
        </CRow>

        {accountingOverview.delayed.length > 0 && (
          <>
            <div className="fw-semibold small text-uppercase text-body-secondary mb-2">
              Pending Accounting — Delay by Bill
            </div>
            <div style={{ maxHeight: 260, overflowY: 'auto' }}>
              {accountingOverview.delayed.map((e) => (
                <div
                  key={e.id}
                  className="d-flex justify-content-between align-items-center gap-2 py-1 border-bottom small"
                >
                  <span>
                    {e.partyName || 'Unknown party'} — Invoice {e.invoiceNumber || '—'} (
                    {money(e.totalValue)}) · uploaded{' '}
                    {e.createdAt ? new Date(e.createdAt).toLocaleDateString('en-IN') : '—'}
                  </span>
                  <CBadge color={delayBadgeColor(e.delayDays)} className="text-nowrap">
                    {e.delayDays === 0
                      ? 'Uploaded today'
                      : `Delayed by ${e.delayDays} day${e.delayDays === 1 ? '' : 's'}`}
                  </CBadge>
                </div>
              ))}
            </div>
          </>
        )}
      </CCardBody>
    </CCard>
  )

  return (
    <CCard {...cardProps}>
      <datalist id="gst-rate-options">
        {[0, 3, 5, 18, 40, 50].map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>
      <CCardHeader
        className={`d-flex justify-content-between align-items-center flex-wrap gap-2 ${isProjectView ? 'bg-transparent px-4 pt-4 border-bottom-0' : ''}`}
      >
        <strong>{title}</strong>
        <div className="d-flex gap-2">
          {showFinanceFields && scopedEntries.length > 0 && (
            <CButton color="success" size="sm" onClick={() => setExportOpen(true)}>
              <CIcon icon={cilCloudDownload} className="me-1" />
              Download Report
            </CButton>
          )}
          {showActions && (
            <CButton color="primary" size="sm" onClick={() => setUploadOpen(true)}>
              <CIcon icon={cilCloudUpload} className="me-1" />
              Upload Excel
            </CButton>
          )}
        </div>
      </CCardHeader>
      <CCardBody className={isProjectView ? 'px-4' : ''}>
        {restricted ? (
          scopedBatches.length === 0 ? (
            <CAlert color="info" className="mb-0">
              No GST bills yet.{' '}
              {showActions ? 'Upload the expenditure statement Excel to begin.' : ''}
            </CAlert>
          ) : (
            <>
              <div className="d-flex justify-content-between align-items-center mb-2">
                <div className="fw-semibold small text-body-secondary text-uppercase">
                  Upload History
                </div>
                <CButton
                  color="secondary"
                  variant="outline"
                  size="sm"
                  onClick={() => setDetailsOpen((v) => !v)}
                >
                  {detailsOpen ? 'Hide Details' : 'Show Details'}
                </CButton>
              </div>
              <div className="small mb-3">{batchListRows}</div>
              {detailsOpen && <div className="border-top pt-3">{filterBarAndTable}</div>}
            </>
          )
        ) : (
          <>
            {filterBarAndTable}
            {accountingOverviewCard && <div className="mt-4">{accountingOverviewCard}</div>}
            {showActions && scopedBatches.length > 0 && (
              <div className="mt-4">
                <div className="fw-semibold small text-body-secondary text-uppercase mb-2">
                  Upload History
                </div>
                <div className="small">{batchListRows}</div>
              </div>
            )}
          </>
        )}
      </CCardBody>

      <GstUploadModal
        visible={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onImported={reload}
        uploadedBy={user?.full_name || user?.email || ''}
        projectId={projectId}
        defaultDepartment={defaultDepartment}
        defaultVertical={defaultVertical}
      />

      {/* ── Download Report modal ───────────────────────────────────────── */}
      <CModal
        visible={exportOpen}
        onClose={() => setExportOpen(false)}
        alignment="center"
        size="lg"
      >
        <CModalHeader closeButton>
          <CModalTitle>
            <CIcon icon={cilCloudDownload} className="me-2" />
            Download Report
          </CModalTitle>
        </CModalHeader>
        <CModalBody>
          {/* ── Section 1: Scope ────────────────────────────────────── */}
          <div className="mb-3">
            <div className="fw-semibold small text-uppercase text-body-secondary mb-2">
              Report Scope
            </div>
            <div className="d-flex flex-column gap-2">
              <CFormCheck
                type="radio"
                name="export-scope"
                id="export-scope-current"
                label={
                  <>
                    <strong>Same as current view</strong>
                    <span className="text-body-secondary ms-2 small">
                      — exports exactly what is displayed on screen right now
                    </span>
                  </>
                }
                checked={exportScope === 'current'}
                onChange={() => setExportScope('current')}
              />
              <CFormCheck
                type="radio"
                name="export-scope"
                id="export-scope-all"
                label={
                  <>
                    <strong>All data</strong>
                    <span className="text-body-secondary ms-2 small">
                      — every bill in the system, ignoring current filters
                    </span>
                  </>
                }
                checked={exportScope === 'all'}
                onChange={() => setExportScope('all')}
              />
              <CFormCheck
                type="radio"
                name="export-scope"
                id="export-scope-custom"
                label={<strong>Custom filters (choose below)</strong>}
                checked={exportScope === 'custom'}
                onChange={() => setExportScope('custom')}
              />
            </div>
          </div>

          {/* ── Section 2: Custom filter options ───────────────────── */}
          {exportScope === 'custom' && (
            <div
              className="border rounded p-3 mb-3"
              style={{ background: 'var(--cui-tertiary-bg, #f8f9fa)' }}
            >
              {/* Department */}
              <div className="mb-3">
                <div className="fw-semibold small mb-1">Filter by Department</div>
                <div className="d-flex flex-wrap gap-3">
                  {(departments.length > 0 ? departments : ['CSR', 'Admin', 'HR']).map((dept) => {
                    const key = dept.toLowerCase()
                    return (
                      <CFormCheck
                        key={key}
                        id={`export-dept-${key}`}
                        label={dept}
                        checked={exportDepts.includes(key)}
                        onChange={() =>
                          setExportDepts(
                            exportDepts.includes(key)
                              ? exportDepts.filter((d) => d !== key)
                              : [...exportDepts, key],
                          )
                        }
                      />
                    )
                  })}
                </div>
                {departments.length === 0 && (
                  <div className="text-body-secondary small mt-1">
                    No department data yet — showing default options.
                  </div>
                )}
              </div>

              {/* Vertical */}
              <div className="mb-3">
                <div className="fw-semibold small mb-1">Filter by Vertical</div>
                <div className="d-flex flex-wrap gap-3">
                  {(verticals.length > 0 ? verticals : ['CSR', 'HMA Admin']).map((vert) => {
                    const key = vert.toLowerCase()
                    return (
                      <CFormCheck
                        key={key}
                        id={`export-vert-${key}`}
                        label={vert}
                        checked={exportVerts.includes(key)}
                        onChange={() =>
                          setExportVerts(
                            exportVerts.includes(key)
                              ? exportVerts.filter((v) => v !== key)
                              : [...exportVerts, key],
                          )
                        }
                      />
                    )
                  })}
                </div>
                {verticals.length === 0 && (
                  <div className="text-body-secondary small mt-1">
                    No vertical data yet — showing default options.
                  </div>
                )}
              </div>

              {/* Date field toggle */}
              <div className="mb-3">
                <div className="fw-semibold small mb-1">Date Type</div>
                <div className="d-flex gap-4">
                  <CFormCheck
                    type="radio"
                    name="export-date-field"
                    id="export-date-field-upload"
                    label="Upload Date"
                    checked={exportDateField === 'upload'}
                    onChange={() => setExportDateField('upload')}
                  />
                  <CFormCheck
                    type="radio"
                    name="export-date-field"
                    id="export-date-field-invoice"
                    label="Invoice Date"
                    checked={exportDateField === 'invoice'}
                    onChange={() => setExportDateField('invoice')}
                  />
                </div>
              </div>

              {/* Date range */}
              <div>
                <div className="fw-semibold small mb-1">
                  {exportDateField === 'upload' ? 'Upload' : 'Invoice'} Date Period
                </div>
                <CRow className="g-2">
                  <CCol xs="auto">
                    <CFormLabel htmlFor="export-date-from" className="mb-0 small">
                      From
                    </CFormLabel>
                    <CFormInput
                      id="export-date-from"
                      type="date"
                      size="sm"
                      value={exportFrom}
                      onChange={(e) => setExportFrom(e.target.value)}
                    />
                  </CCol>
                  <CCol xs="auto">
                    <CFormLabel htmlFor="export-date-to" className="mb-0 small">
                      To
                    </CFormLabel>
                    <CFormInput
                      id="export-date-to"
                      type="date"
                      size="sm"
                      value={exportTo}
                      onChange={(e) => setExportTo(e.target.value)}
                    />
                  </CCol>
                  {(exportFrom || exportTo) && (
                    <CCol xs="auto" className="d-flex align-items-end">
                      <CButton
                        color="link"
                        size="sm"
                        className="p-0 text-danger"
                        onClick={() => {
                          setExportFrom('')
                          setExportTo('')
                        }}
                      >
                        Clear dates
                      </CButton>
                    </CCol>
                  )}
                </CRow>
              </div>
            </div>
          )}

          {/* ── Section 3: Accounted status ─────────────────────────── */}
          <div className="mb-3">
            <div className="fw-semibold small text-uppercase text-body-secondary mb-2">
              Accounted Status
            </div>
            <div className="d-flex gap-4 flex-wrap">
              <CFormCheck
                type="radio"
                name="export-accounted"
                id="export-accounted-all"
                label="All (accounted + not accounted)"
                checked={exportAccounted === 'all'}
                onChange={() => setExportAccounted('all')}
              />
              <CFormCheck
                type="radio"
                name="export-accounted"
                id="export-accounted-yes"
                label="Accounted only"
                checked={exportAccounted === 'Accounted'}
                onChange={() => setExportAccounted('Accounted')}
              />
              <CFormCheck
                type="radio"
                name="export-accounted"
                id="export-accounted-no"
                label="Not Accounted only"
                checked={exportAccounted === 'Not Accounted'}
                onChange={() => setExportAccounted('Not Accounted')}
              />
            </div>
          </div>

          {/* ── Section 4: Eligibility status ───────────────────────── */}
          <div className="mb-3">
            <div className="fw-semibold small text-uppercase text-body-secondary mb-2">
              Eligibility Status
            </div>
            <div className="d-flex gap-4 flex-wrap">
              <CFormCheck
                type="radio"
                name="export-eligibility"
                id="export-eligibility-all"
                label="All (eligible + not eligible)"
                checked={exportEligibility === 'all'}
                onChange={() => setExportEligibility('all')}
              />
              <CFormCheck
                type="radio"
                name="export-eligibility"
                id="export-eligibility-yes"
                label="Eligible only"
                checked={exportEligibility === 'Eligible'}
                onChange={() => setExportEligibility('Eligible')}
              />
              <CFormCheck
                type="radio"
                name="export-eligibility"
                id="export-eligibility-no"
                label="Not Eligible only"
                checked={exportEligibility === 'Not Eligible'}
                onChange={() => setExportEligibility('Not Eligible')}
              />
            </div>
          </div>

          {/* ── Preview summary ─────────────────────────────────────── */}
          <CAlert color="info" className="small mb-0 py-2">
            <strong>Preview:</strong>{' '}
            {exportScope === 'all'
              ? `All ${scopedEntries.length} bill(s) in the system`
              : exportScope === 'current'
                ? `${rows.length} bill(s) matching your current on-screen filters`
                : 'Custom selection — bill count will be calculated on download'}
            .
            {exportAccounted !== 'all' && (
              <span className="ms-1 fw-semibold">· {exportAccounted} only</span>
            )}
            {exportEligibility !== 'all' && (
              <span className="ms-1 fw-semibold">· {exportEligibility} only</span>
            )}
          </CAlert>
        </CModalBody>
        <CModalFooter>
          <CButton
            color="secondary"
            variant="ghost"
            onClick={() => {
              setExportOpen(false)
              setExportScope('current')
              setExportDepts([])
              setExportVerts([])
              setExportDateField('upload')
              setExportFrom('')
              setExportTo('')
              setExportAccounted('all')
              setExportEligibility('all')
            }}
          >
            Cancel
          </CButton>
          <CButton
            color="success"
            onClick={() => {
              const exportRows = buildExportRows()
              const scopeLabel = exportScopeLabel()
              setExportOpen(false)
              handleExport(exportRows, scopeLabel)
            }}
          >
            <CIcon icon={cilCloudDownload} className="me-1" />
            Download Excel
          </CButton>
        </CModalFooter>
      </CModal>

      {/* ── Type-"delete" confirmation for removing an upload ─────────── */}
      <CModal visible={!!deleteTarget} onClose={() => setDeleteTarget(null)} alignment="center">
        <CModalHeader closeButton>
          <CModalTitle>Delete upload</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <CAlert color="warning" className="small">
            This will permanently delete <strong>{deleteTarget?.fileName}</strong> and all{' '}
            <strong>{entries.filter((e) => e.batchId === deleteTarget?.id).length} entries</strong>{' '}
            imported from it. This cannot be undone.
          </CAlert>
          <CFormLabel htmlFor="gst-delete-confirm" className="small fw-semibold">
            Type <strong>delete</strong> to confirm
          </CFormLabel>
          <CFormInput
            id="gst-delete-confirm"
            value={deleteText}
            onChange={(e) => setDeleteText(e.target.value)}
            placeholder="delete"
            autoComplete="off"
          />
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" variant="ghost" onClick={() => setDeleteTarget(null)}>
            Cancel
          </CButton>
          <CButton
            color="danger"
            disabled={deleteText.trim().toLowerCase() !== 'delete'}
            onClick={confirmDeleteBatch}
          >
            Delete upload
          </CButton>
        </CModalFooter>
      </CModal>
    </CCard>
  )
}

GstBillsView.propTypes = {
  title: PropTypes.string.isRequired,
  canView: PropTypes.bool.isRequired,
  canEdit: PropTypes.bool.isRequired,
  showFinanceFields: PropTypes.bool,
  projectId: PropTypes.string,
  isProjectView: PropTypes.bool,
  defaultDepartment: PropTypes.string,
  defaultVertical: PropTypes.string,
}

GstBillsView.defaultProps = {
  showFinanceFields: false,
  projectId: null,
  isProjectView: false,
  defaultDepartment: '',
  defaultVertical: '',
}

export default GstBillsView
