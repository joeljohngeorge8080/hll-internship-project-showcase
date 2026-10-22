import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCol,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormSwitch,
  CRow,
  CSpinner,
  CTooltip,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilCloudDownload, cilPencil, cilReload, cilSettings, cilX } from '@coreui/icons'

import api from '../../../services/api'
import { localEmployees } from '../../../services/localEmployees'
import { localAttendance } from '../../../services/localAttendance'
import { localSalaryInvoiceOverrides } from '../../../services/localSalaryInvoiceOverrides'
import { computeEffectiveCTC } from './ctcUtils'

// ─── Constants ────────────────────────────────────────────────────────────────
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const STATE_PT_MAP = {
  Kerala: 200,
  Karnataka: 200,
  Maharashtra: 200,
  'Tamil Nadu': 167,
  'West Bengal': 110,
  'Andhra Pradesh': 150,
  Telangana: 150,
  Gujarat: 0,
  Delhi: 0,
  Other: 0,
}

const fmt = (n, d = 2) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d })

// ─── Default rate config ───────────────────────────────────────────────────────
const DEFAULT_RATES = {
  hraRate: 30, // % of basic
  oaRate: 10, // % of basic
  epfoRate: 12, // employee EPFO % of actual basic
  esicEmpRate: 0.75, // employee ESIC % of actual gross (if idealGross < 21000)
  esicThreshold: 21000,
  lwfFixed: 50, // fixed ₹
  groupInsThreshold: 21000,
  groupInsAmount: 200,
  employerPFRate: 12,
  pfAdminRate: 0.5,
  edliRate: 0.5,
  esicEmployerRate: 3.25,
  employerLWFFixed: 50,
  serviceChargeRate: 1.5,
  igstRate: 18,
}

// ─── Column definitions ────────────────────────────────────────────────────────
const COL_GROUPS = [
  {
    label: 'Employee',
    color: '#6366f1',
    cols: [
      { key: 'sl', label: 'SL.No', w: 56 },
      { key: 'employee_code', label: 'Emp Code', w: 110 },
      { key: 'name', label: 'Name', w: 180 },
      { key: 'designation', label: 'Designation', w: 150 },
      { key: 'gender', label: 'Gender', w: 80 },
    ],
  },
  {
    label: 'Ideal Salary',
    color: '#0ea5e9',
    cols: [
      { key: 'idealBasic', label: 'Basic', w: 110 },
      { key: 'idealDA', label: 'DA', w: 100 },
      { key: 'idealHRA', label: 'HRA', w: 100 },
      { key: 'idealOA', label: 'OA', w: 100 },
      { key: 'idealGross', label: 'Ideal Gross', w: 110, bold: true },
    ],
  },
  {
    label: 'Attendance',
    color: '#f59e0b',
    cols: [
      { key: 'tnd', label: 'TND', w: 70 },
      { key: 'tndw', label: 'TNDW', w: 80 },
    ],
  },
  {
    label: 'Actual Salary',
    color: '#10b981',
    cols: [
      { key: 'actualBasic', label: 'Actual Basic', w: 110 },
      { key: 'actualDA', label: 'DA', w: 100 },
      { key: 'actualHRA', label: 'HRA', w: 100 },
      { key: 'actualOA', label: 'OA', w: 100 },
      { key: 'actualGross', label: 'Actual Gross', w: 110, bold: true },
    ],
  },
  {
    label: 'Employee Deductions',
    color: '#ef4444',
    cols: [
      { key: 'empEPFO', label: 'EPFO @12%', w: 105 },
      { key: 'empESIC', label: 'ESIC @0.75%', w: 110 },
      { key: 'pt', label: 'PT', w: 80 },
      { key: 'recovery', label: 'Recovery', w: 90 },
      { key: 'empLWF', label: 'Emp LWF', w: 85 },
      { key: 'groupIns', label: 'Group Ins.', w: 90 },
      { key: 'totalDeduction', label: 'Total Ded.', w: 105, bold: true },
      { key: 'netSalary', label: 'Net Salary', w: 110, bold: true, highlight: '#10b981' },
    ],
  },
  {
    label: 'Employer Contributions',
    color: '#8b5cf6',
    cols: [
      { key: 'employerPF', label: 'PF @12%', w: 100 },
      { key: 'pfAdmin', label: 'PF Admin @0.5%', w: 120 },
      { key: 'edli', label: 'EDLI @0.5%', w: 100 },
      { key: 'employerESIC', label: 'ESIC @3.25%', w: 110 },
      { key: 'employerLWF', label: 'Emp LWF', w: 90 },
      { key: 'totalEmployerContrib', label: 'Total Employer', w: 120, bold: true },
    ],
  },
  {
    label: 'CTC & Invoice',
    color: '#ec4899',
    cols: [
      { key: 'ctc', label: 'CTC', w: 115, bold: true, highlight: '#10b981' },
      { key: 'serviceChargeRate', label: 'Service Ch. %', w: 100, percent: true },
      { key: 'serviceCharges', label: 'Service Charges', w: 130 },
      { key: 'invoiceAmount', label: 'Invoice Amt', w: 115 },
      { key: 'igst', label: 'IGST @18%', w: 105 },
      { key: 'totalInvoice', label: 'Total Invoice', w: 120, bold: true, highlight: '#ec4899' },
    ],
  },
]

const ALL_COLS = COL_GROUPS.flatMap((g) => g.cols)

// ─── Editable cell ─────────────────────────────────────────────────────────────
const EditableNum = ({
  value,
  onCommit,
  readOnly,
  highlight,
  bold,
  plain,
  percent,
  placeholder,
}) => {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef(null)

  const start = () => {
    if (readOnly) return
    setDraft(String(value))
    setEditing(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  const commit = () => {
    const n = parseFloat(draft)
    if (!isNaN(n) && n !== value) onCommit(n)
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') setEditing(false)
        }}
        style={{
          width: '100%',
          border: 'none',
          outline: '2px solid #6366f1',
          borderRadius: 4,
          padding: '2px 4px',
          fontSize: '0.82rem',
          background: 'var(--cui-body-bg)',
          color: 'var(--cui-body-color)',
        }}
      />
    )
  }

  return (
    <span
      onClick={start}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'right',
        cursor: readOnly ? 'default' : 'text',
        fontWeight: bold ? 700 : undefined,
        color: highlight || undefined,
        borderBottom: readOnly ? 'none' : '1px dashed rgba(99,102,241,0.3)',
        padding: '2px 0',
        fontSize: '0.82rem',
      }}
    >
      {placeholder && !value ? (
        <span className="text-warning fst-italic">{placeholder}</span>
      ) : percent ? (
        `${fmt(value)}%`
      ) : plain ? (
        fmt(value, 0)
      ) : (
        `₹${fmt(value)}`
      )}
    </span>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
const SalaryInvoicePage = () => {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [employees, setEmployees] = useState([])
  const [loadingEmps, setLoadingEmps] = useState(true)
  const [loadingAtt, setLoadingAtt] = useState(false)
  const [attMap, setAttMap] = useState({}) // employeeId → { tnd, tndw }
  const [rates, setRates] = useState(DEFAULT_RATES)
  const [showRates, setShowRates] = useState(false)
  // Per-employee overrides: { [empId]: { pt, recovery, tndw, tnd, serviceChargeRate } }
  const [overrides, setOverrides] = useState({})
  // Whole-sheet edit lock, off by default — every editable cell stays
  // read-only until HR deliberately flips this on, so a stray click
  // doesn't quietly change a salary figure.
  const [editUnlocked, setEditUnlocked] = useState(false)
  const [loadingOverrides, setLoadingOverrides] = useState(false)
  const [overrideSaveError, setOverrideSaveError] = useState('')

  // ── Load employees
  useEffect(() => {
    const load = async () => {
      setLoadingEmps(true)
      try {
        const { items } = await localEmployees.list({
          status: 'Active',
          category: 'TPC',
          pageSize: 500,
        })
        setEmployees(items)
      } catch {
        setEmployees([])
      } finally {
        setLoadingEmps(false)
      }
    }
    load()
  }, [])

  // ── Load attendance summaries for the selected month
  const loadAttendance = useCallback(async () => {
    setLoadingAtt(true)
    const map = {}
    const daysInMonth = new Date(year, month, 0).getDate()

    try {
      // Try API — returns all employee summaries for the month
      const { data } = await api.get(
        `/attendance/summaries?year=${year}&month=${month}&page_size=500`,
      )
      const items = data.items || []
      for (const s of items) {
        // present_count already includes half-day records as full days (per buildSummary).
        // Correct TNDW: subtract 0.5 per half day (not add).
        const tndwVal = (Number(s.present_count) || 0) - (Number(s.half_day_count) || 0) * 0.5
        map[s.employee_id] = { tnd: daysInMonth, tndw: tndwVal, source: 'api' }
      }
    } catch {
      // ── Local fallback: load all summaries for this month in one read
      const allSummaries = await localAttendance.listMonthlySummaries({ year, month })

      for (const s of allSummaries) {
        // present_count already includes half-day records as full days (per buildSummary).
        // Correct TNDW: subtract 0.5 per half day (not add).
        const tndwVal = (Number(s.present_count) || 0) - (Number(s.half_day_count) || 0) * 0.5
        // summaries are keyed by employee_id CODE
        map[s.employee_id] = { tnd: daysInMonth, tndw: tndwVal, source: 'local' }
      }

      // For employees still missing, try computing from raw daily records
      for (const emp of employees) {
        const eid = emp.employee_id
        if (map[eid]) continue // already found

        const { items } = await localAttendance.listRecords({
          employeeId: eid,
          year,
          month,
          pageSize: 200,
        })
        if (items.length > 0) {
          const presentCount = items.filter((r) => r.status === 'Present').length
          const halfDayCount = items.filter((r) => r.status === 'Half Day').length
          const tndwVal = presentCount + halfDayCount * 0.5
          map[eid] = { tnd: daysInMonth, tndw: tndwVal, source: 'local' }
        }
      }
    }

    // For employees with no attendance data at all, default TND to calendar days, TNDW = TND (fully present)
    // HR can override per-cell in the table
    for (const emp of employees) {
      if (!map[emp.employee_id]) {
        map[emp.employee_id] = { tnd: daysInMonth, tndw: daysInMonth, source: 'none' }
      }
    }

    setAttMap(map)
    setLoadingAtt(false)
  }, [year, month, employees])

  useEffect(() => {
    if (employees.length > 0) {
      Promise.resolve().then(() => loadAttendance())
    }
  }, [employees, year, month, loadAttendance])

  // ── Load saved overrides for the selected month
  useEffect(() => {
    if (employees.length === 0) return
    let active = true
    const load = async () => {
      if (active) setLoadingOverrides(true)
      try {
        const dbRows = await localSalaryInvoiceOverrides.list({ year, month })
        if (!active) return
        const codeById = {}
        employees.forEach((e) => {
          codeById[e.id] = e.employee_id
        })
        const map = {}
        dbRows.forEach((r) => {
          const code = codeById[r.employee_id]
          if (!code) return
          map[code] = {
            idealBasic: r.ideal_basic ?? undefined,
            da: r.da ?? undefined,
            tnd: r.tnd ?? undefined,
            tndw: r.tndw ?? undefined,
            pt: r.pt ?? undefined,
            recovery: r.recovery ?? undefined,
            serviceChargeRate: r.service_charge_rate ?? undefined,
            idealHRA: r.ideal_hra ?? undefined,
            idealOA: r.ideal_oa ?? undefined,
            actualHRA: r.actual_hra ?? undefined,
            actualOA: r.actual_oa ?? undefined,
          }
        })
        setOverrides(map)
      } catch {
        if (active) setOverrides({})
      } finally {
        if (active) setLoadingOverrides(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [employees, year, month])

  // ── Build computed rows
  const rows = useMemo(() => {
    return employees.map((emp, idx) => {
      const eid = emp.employee_id
      const ovr = overrides[eid] || {}
      const att = attMap[eid] || { tnd: 30, tndw: 30 }

      const idealBasic = parseFloat(ovr.idealBasic ?? emp.current_salary ?? 0)
      // A bare-minimum employee record (only ID + name) has no salary on file
      // yet — flag it rather than silently computing every downstream figure
      // off ₹0, same principle as DeductionSummary.jsx's hasSalary check.
      const hasSalary = ovr.idealBasic != null || Number(emp.current_salary) > 0
      const da = parseFloat(ovr.da ?? 0)
      const tnd = Number(ovr.tnd ?? att.tnd)
      const tndw = Number(ovr.tndw ?? att.tndw)

      // PT: use state map or per-employee override
      const stateKey = emp.employment?.state_for_pt || emp.state_for_pt || ''
      const autoPT = STATE_PT_MAP[stateKey] ?? 0
      const pt = Number(ovr.pt ?? autoPT)
      const hasPtState = ovr.pt != null || !!stateKey

      const recovery = Number(ovr.recovery ?? 0)
      const serviceChargeRate = Number(ovr.serviceChargeRate ?? rates.serviceChargeRate)

      // HRA/OA no longer derive from Basic × 30%/10% — HR types these
      // directly. Always passed as overrides (defaulting to 0) so
      // computeEffectiveCTC never falls back to the formula, and the
      // cascade into idealGross/actualGross/CTC/etc. still happens
      // correctly off whatever HR entered.
      const c = computeEffectiveCTC(
        { idealBasic, da, tnd, tndw, pt, recovery, serviceChargeRate },
        {
          idealHRA: ovr.idealHRA ?? 0,
          idealOA: ovr.idealOA ?? 0,
          actualHRA: ovr.actualHRA ?? 0,
          actualOA: ovr.actualOA ?? 0,
        },
      )

      return {
        sl: idx + 1,
        id: emp.id,
        employee_code: eid,
        name: emp.employee_name || [emp.first_name, emp.last_name].filter(Boolean).join(' '),
        designation: emp.employment?.designation || emp.designation || '—',
        gender: emp.gender || '—',
        hasSalary,
        hasPtState,
        isIncomplete: !hasSalary || !hasPtState,
        idealBasic: c.idealBasic,
        idealDA: c.idealDA,
        idealHRA: c.idealHRA,
        idealOA: c.idealOA,
        idealGross: c.idealGross,
        tnd: c.tnd,
        tndw: c.tndw,
        actualBasic: c.actualBasic,
        actualDA: c.actualDA,
        actualHRA: c.actualHRA,
        actualOA: c.actualOA,
        actualGross: c.actualGross,
        empEPFO: c.empEPFO,
        empESIC: c.empESIC,
        pt: c.ptAmt,
        recovery: c.recoveryAmt,
        empLWF: c.empLWF,
        groupIns: c.groupInsurance,
        totalDeduction: c.totalDeduction,
        netSalary: c.netSalary,
        employerPF: c.employerPF,
        pfAdmin: c.pfAdmin,
        edli: c.edli,
        employerESIC: c.employerESIC,
        employerLWF: c.employerLWF,
        totalEmployerContrib: c.totalEmployerContribution,
        ctc: c.ctc,
        serviceChargeRate: c.serviceChargeRate,
        serviceCharges: c.serviceCharges,
        invoiceAmount: c.invoiceAmount,
        igst: c.igst,
        totalInvoice: c.totalInvoiceAmount,
        _empId: eid,
      }
    })
  }, [employees, overrides, attMap, rates.serviceChargeRate])

  // ── Column totals
  const totals = useMemo(() => {
    const numCols = ALL_COLS.filter(
      (c) =>
        ![
          'sl',
          'employee_code',
          'name',
          'designation',
          'gender',
          'tnd',
          'tndw',
          'serviceChargeRate',
        ].includes(c.key),
    )
    // Incomplete records (no salary/PT state on file yet) are excluded from
    // totals — they'd otherwise fold ₹0 into every column silently.
    const completeRows = rows.filter((r) => !r.isIncomplete)
    const t = {}
    for (const col of numCols) {
      t[col.key] = completeRows.reduce((s, r) => s + (Number(r[col.key]) || 0), 0)
    }
    return t
  }, [rows])

  const incompleteCount = useMemo(() => rows.filter((r) => r.isIncomplete).length, [rows])

  // ── Override setter
  const setOvr = (empId, field, value) => {
    const merged = { ...(overrides[empId] || {}), [field]: value }
    setOverrides((prev) => ({ ...prev, [empId]: merged }))

    const emp = employees.find((e) => e.employee_id === empId)
    if (!emp) return
    setOverrideSaveError('')
    localSalaryInvoiceOverrides
      .upsert({ employeeId: emp.id, year, month, ...merged })
      .catch(() => setOverrideSaveError(`Failed to save changes for ${emp.employee_name || empId}`))
  }

  const isNumericCol = (key) =>
    !['sl', 'employee_code', 'name', 'designation', 'gender'].includes(key)

  const isEditableCol = (key) =>
    [
      'idealBasic',
      'idealDA',
      'idealHRA',
      'idealOA',
      'tnd',
      'tndw',
      'actualHRA',
      'actualOA',
      'pt',
      'recovery',
      'serviceChargeRate',
    ].includes(key)

  // Map col key → override field
  const colToOvrField = {
    idealBasic: 'idealBasic',
    idealDA: 'da',
    idealHRA: 'idealHRA',
    idealOA: 'idealOA',
    tndw: 'tndw',
    tnd: 'tnd',
    actualHRA: 'actualHRA',
    actualOA: 'actualOA',
    pt: 'pt',
    recovery: 'recovery',
    serviceChargeRate: 'serviceChargeRate',
  }

  // ── CSV Export
  const handleExport = () => {
    const headers = [
      'SL.No',
      'Emp Code',
      'Name',
      'Designation',
      'Gender',
      'Basic',
      'Ideal DA',
      'Ideal HRA',
      'Ideal OA',
      'Ideal Gross',
      'TND',
      'TNDW',
      'Actual Basic',
      'Actual DA',
      'Actual HRA',
      'Actual OA',
      'Actual Gross',
      'Emp EPFO',
      'Emp ESIC',
      'PT',
      'Recovery',
      'Emp LWF',
      'Group Ins',
      'Total Ded',
      'Net Salary',
      'Employer PF',
      'PF Admin',
      'EDLI',
      'Employer ESIC',
      'Employer LWF',
      'Total Employer',
      'CTC',
      'Service Charge %',
      'Service Charges',
      'Invoice Amt',
      'IGST',
      'Total Invoice',
    ]
    const colKeys = ALL_COLS.map((c) => c.key)
    const csvRows = [
      headers.join(','),
      ...rows.map((r) =>
        colKeys
          .map((k) => {
            const v = r[k]
            if (typeof v === 'number') return v.toFixed(2)
            return `"${String(v || '').replace(/"/g, '""')}"`
          })
          .join(','),
      ),
    ]
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `salary_invoice_${MONTHS[month - 1]}_${year}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const isLoading = loadingEmps || loadingAtt || loadingOverrides

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="d-flex align-items-start justify-content-between mb-4 gap-3 flex-wrap">
        <div>
          <h4 className="fw-bold mb-1">Salary Details</h4>
          <p className="text-body-secondary small mb-0">
            Full CTC breakdown for all active employees — {MONTHS[month - 1]} {year}
          </p>
        </div>
        <div className="d-flex gap-2 align-items-center flex-wrap">
          {/* Month/Year */}
          <CFormSelect
            size="sm"
            style={{ width: 130 }}
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </CFormSelect>
          <CFormSelect
            size="sm"
            style={{ width: 90 }}
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {[-2, -1, 0, 1].map((d) => {
              const y = now.getFullYear() + d
              return (
                <option key={y} value={y}>
                  {y}
                </option>
              )
            })}
          </CFormSelect>

          <CFormSwitch
            label={editUnlocked ? 'Editing unlocked' : 'Editing locked'}
            checked={editUnlocked}
            onChange={(e) => setEditUnlocked(e.target.checked)}
          />

          <CTooltip content="Reload attendance data">
            <CButton
              size="sm"
              color="info"
              variant="outline"
              onClick={loadAttendance}
              disabled={loadingAtt}
            >
              <CIcon icon={cilReload} />
            </CButton>
          </CTooltip>

          <CButton
            size="sm"
            color={showRates ? 'warning' : 'secondary'}
            variant="outline"
            onClick={() => setShowRates((v) => !v)}
          >
            <CIcon icon={cilSettings} className="me-1" />
            {showRates ? 'Hide' : 'Rate Config'}
          </CButton>

          <CButton size="sm" color="success" onClick={handleExport} disabled={rows.length === 0}>
            <CIcon icon={cilCloudDownload} className="me-1" />
            Export CSV
          </CButton>
        </div>
      </div>

      {/* ── Rate Config Panel ─────────────────────────────────────────────── */}
      {showRates && (
        <CCard className="mb-4 border-warning">
          <CCardBody>
            <div className="d-flex align-items-center justify-content-between mb-3">
              <div>
                <strong>Rate Configuration</strong>
                <span className="text-body-secondary small ms-2">
                  Changes affect all employees globally. Override per-employee by clicking any
                  editable cell in the table.
                </span>
              </div>
              <CButton size="sm" variant="ghost" onClick={() => setShowRates(false)}>
                <CIcon icon={cilX} />
              </CButton>
            </div>
            <CRow className="g-3">
              {[
                { key: 'hraRate', label: 'HRA % of Basic', unit: '%' },
                { key: 'oaRate', label: 'OA % of Basic', unit: '%' },
                { key: 'epfoRate', label: 'Employee EPFO %', unit: '%' },
                { key: 'esicEmpRate', label: 'Employee ESIC %', unit: '%' },
                { key: 'esicThreshold', label: 'ESIC Threshold (₹)', unit: '₹' },
                { key: 'lwfFixed', label: 'Employee LWF (₹)', unit: '₹' },
                { key: 'groupInsThreshold', label: 'Group Ins. Threshold (₹)', unit: '₹' },
                { key: 'groupInsAmount', label: 'Group Ins. Amount (₹)', unit: '₹' },
                { key: 'employerPFRate', label: 'Employer PF %', unit: '%' },
                { key: 'pfAdminRate', label: 'PF Admin %', unit: '%' },
                { key: 'edliRate', label: 'EDLI %', unit: '%' },
                { key: 'esicEmployerRate', label: 'Employer ESIC %', unit: '%' },
                { key: 'employerLWFFixed', label: 'Employer LWF (₹)', unit: '₹' },
                { key: 'serviceChargeRate', label: 'Service Charge %', unit: '%' },
                { key: 'igstRate', label: 'IGST %', unit: '%' },
              ].map(({ key, label, unit }) => (
                <CCol md={2} key={key}>
                  <CFormLabel className="small fw-semibold mb-1">{label}</CFormLabel>
                  <div className="d-flex align-items-center gap-1">
                    <CFormInput
                      type="number"
                      size="sm"
                      value={rates[key]}
                      onChange={(e) =>
                        setRates((r) => ({ ...r, [key]: parseFloat(e.target.value) || 0 }))
                      }
                      step="0.01"
                      min="0"
                    />
                    <span className="text-body-secondary small">{unit}</span>
                  </div>
                </CCol>
              ))}
              <CCol md={12} className="d-flex gap-2 mt-1">
                <CButton
                  size="sm"
                  color="secondary"
                  variant="outline"
                  onClick={() => setRates(DEFAULT_RATES)}
                >
                  Reset to defaults
                </CButton>
              </CCol>
            </CRow>
          </CCardBody>
        </CCard>
      )}

      {incompleteCount > 0 && (
        <CAlert color="warning" className="small py-2 mb-3">
          <strong>{incompleteCount}</strong> employee{incompleteCount > 1 ? 's' : ''} missing salary
          or PT state — excluded from the totals below. Set &ldquo;Ideal Basic&rdquo; or
          &ldquo;PT&rdquo; on their row (or complete their Staff &amp; Payroll profile) to include
          them.
        </CAlert>
      )}

      {/* ── Editable-cell legend ──────────────────────────────────────────── */}
      <div className="d-flex align-items-center gap-3 mb-3 flex-wrap">
        <div className="d-flex align-items-center gap-1">
          <div style={{ width: 14, height: 14, border: '1px dashed #6366f1', borderRadius: 3 }} />
          <span className="text-body-secondary" style={{ fontSize: '0.75rem' }}>
            Editable cell — click to override
            {!editUnlocked && ' (turn on "Editing unlocked" above to enable)'}
          </span>
        </div>
        <div className="d-flex align-items-center gap-1">
          <CBadge color="info" style={{ fontSize: '0.68rem' }}>
            Auto
          </CBadge>
          <span className="text-body-secondary" style={{ fontSize: '0.75rem' }}>
            TND/TNDW from attendance sheet
          </span>
        </div>
        {loadingAtt && (
          <div className="d-flex align-items-center gap-1">
            <CSpinner size="sm" />
            <span className="text-body-secondary" style={{ fontSize: '0.75rem' }}>
              Loading attendance…
            </span>
          </div>
        )}
        {Object.keys(overrides).length > 0 && (
          <CButton
            size="sm"
            color="warning"
            variant="outline"
            onClick={() => {
              setOverrides({})
              localSalaryInvoiceOverrides
                .removeAllForMonth({ year, month })
                .catch(() => setOverrideSaveError('Failed to reset overrides'))
            }}
          >
            <CIcon icon={cilX} className="me-1" />
            Reset all overrides ({Object.keys(overrides).length})
          </CButton>
        )}
        {overrideSaveError && (
          <CAlert
            color="danger"
            dismissible
            onClose={() => setOverrideSaveError('')}
            className="py-1 px-2 mb-0 small"
          >
            {overrideSaveError}
          </CAlert>
        )}
      </div>

      {/* ── Main Table ────────────────────────────────────────────────────── */}
      {isLoading && rows.length === 0 ? (
        <div className="text-center py-5">
          <CSpinner color="primary" />
          <p className="text-body-secondary mt-2">Loading salary data…</p>
        </div>
      ) : rows.length === 0 ? (
        <CAlert color="info">No active employees found.</CAlert>
      ) : (
        <div
          style={{
            overflowX: 'auto',
            overflowY: 'auto',
            maxHeight: '75vh',
            borderRadius: 10,
            border: '1px solid var(--cui-border-color)',
            boxShadow: '0 2px 16px rgba(0,0,0,0.07)',
          }}
        >
          <table
            style={{
              borderCollapse: 'separate',
              borderSpacing: 0,
              width: 'max-content',
              minWidth: '100%',
              fontSize: '0.82rem',
            }}
          >
            {/* ── Group header row ──────────────────────────────────────── */}
            <thead>
              <tr>
                {COL_GROUPS.map((g) => (
                  <th
                    key={g.label}
                    colSpan={g.cols.length}
                    style={{
                      background: g.color,
                      color: '#fff',
                      textAlign: 'center',
                      padding: '6px 8px',
                      fontWeight: 700,
                      fontSize: '0.72rem',
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                      borderRight: '2px solid rgba(255,255,255,0.25)',
                      position: 'sticky',
                      top: 0,
                      zIndex: 3,
                    }}
                  >
                    {g.label}
                  </th>
                ))}
              </tr>

              {/* ── Column header row ────────────────────────────────────── */}
              <tr>
                {COL_GROUPS.map((g) =>
                  g.cols.map((col, ci) => (
                    <th
                      key={col.key}
                      style={{
                        background: `${g.color}22`,
                        borderTop: `3px solid ${g.color}`,
                        borderRight:
                          ci === g.cols.length - 1
                            ? `2px solid ${g.color}44`
                            : '1px solid var(--cui-border-color)',
                        borderBottom: '2px solid var(--cui-border-color)',
                        padding: '6px 8px',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        minWidth: col.w,
                        width: col.w,
                        position: 'sticky',
                        top: 33,
                        zIndex: 2,
                        textAlign: isNumericCol(col.key) ? 'right' : 'left',
                        color: g.color,
                        fontSize: '0.75rem',
                      }}
                    >
                      {col.label}
                      {isEditableCol(col.key) && (
                        <CIcon
                          icon={cilPencil}
                          style={{ marginLeft: 4, opacity: 0.5, width: 10 }}
                        />
                      )}
                    </th>
                  )),
                )}
              </tr>
            </thead>

            {/* ── Data rows ─────────────────────────────────────────────── */}
            <tbody>
              {rows.map((row, ri) => (
                <tr
                  key={row._empId}
                  style={{
                    background: ri % 2 === 0 ? 'var(--cui-body-bg)' : 'var(--cui-tertiary-bg)',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--cui-light)')}
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background =
                      ri % 2 === 0 ? 'var(--cui-body-bg)' : 'var(--cui-tertiary-bg)')
                  }
                >
                  {COL_GROUPS.map((g) =>
                    g.cols.map((col, ci) => {
                      const val = row[col.key]
                      const editable = isEditableCol(col.key)
                      const isOverridden =
                        overrides[row._empId]?.[colToOvrField[col.key]] !== undefined

                      return (
                        <td
                          key={col.key}
                          style={{
                            padding: '5px 8px',
                            borderRight:
                              ci === g.cols.length - 1
                                ? `2px solid ${g.color}33`
                                : '1px solid var(--cui-border-color)',
                            borderBottom: '1px solid var(--cui-border-color)',
                            textAlign: isNumericCol(col.key) ? 'right' : 'left',
                            whiteSpace: col.key === 'name' ? 'nowrap' : 'nowrap',
                            background: isOverridden ? '#fef3c7' : undefined,
                          }}
                        >
                          {col.key === 'sl' ? (
                            <span className="text-body-secondary">{val}</span>
                          ) : col.key === 'gender' ? (
                            <CBadge
                              color={
                                val === 'Male' ? 'info' : val === 'Female' ? 'danger' : 'secondary'
                              }
                              style={{ fontSize: '0.68rem' }}
                            >
                              {val}
                            </CBadge>
                          ) : col.key === 'tnd' || col.key === 'tndw' ? (
                            <EditableNum
                              value={Number(val)}
                              readOnly={!editUnlocked}
                              bold={col.bold}
                              plain
                              onCommit={(v) => setOvr(row._empId, colToOvrField[col.key], v)}
                            />
                          ) : isNumericCol(col.key) ? (
                            <EditableNum
                              value={Number(val)}
                              readOnly={!editable || !editUnlocked}
                              bold={col.bold}
                              highlight={col.highlight}
                              percent={col.percent}
                              placeholder={
                                (col.key === 'idealBasic' && !row.hasSalary) ||
                                (col.key === 'pt' && !row.hasPtState)
                                  ? 'Not set'
                                  : undefined
                              }
                              onCommit={
                                editable
                                  ? (v) => setOvr(row._empId, colToOvrField[col.key], v)
                                  : undefined
                              }
                            />
                          ) : (
                            <span style={{ fontWeight: col.bold ? 700 : undefined }}>{val}</span>
                          )}
                        </td>
                      )
                    }),
                  )}
                </tr>
              ))}
            </tbody>

            {/* ── Totals footer ─────────────────────────────────────────── */}
            <tfoot>
              <tr>
                {COL_GROUPS.map((g) =>
                  g.cols.map((col, ci) => {
                    const t = totals[col.key]
                    const showTotal = t !== undefined
                    return (
                      <td
                        key={col.key}
                        style={{
                          padding: '7px 8px',
                          background: 'var(--cui-secondary-bg)',
                          borderTop: `3px solid ${g.color}`,
                          borderRight:
                            ci === g.cols.length - 1
                              ? `2px solid ${g.color}44`
                              : '1px solid var(--cui-border-color)',
                          fontWeight: 700,
                          textAlign: isNumericCol(col.key) ? 'right' : 'left',
                          fontSize: '0.8rem',
                          color: g.color,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {col.key === 'sl'
                          ? incompleteCount > 0
                            ? `${rows.length} emp. (${incompleteCount} excluded)`
                            : `${rows.length} emp.`
                          : col.key === 'name'
                            ? 'TOTAL'
                            : showTotal
                              ? `₹${fmt(t, 0)}`
                              : ''}
                      </td>
                    )
                  }),
                )}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* ── Summary cards below ───────────────────────────────────────────── */}
      {rows.length > 0 && (
        <CRow className="g-3 mt-3">
          {[
            { label: 'Total Ideal Gross', val: totals.idealGross, color: '#0ea5e9' },
            { label: 'Total Actual Gross', val: totals.actualGross, color: '#10b981' },
            { label: 'Total Net Salary', val: totals.netSalary, color: '#f59e0b' },
            { label: 'Total CTC', val: totals.ctc, color: '#6366f1' },
            { label: 'Total Invoice', val: totals.totalInvoice, color: '#ec4899' },
          ].map(({ label, val, color }) => (
            <CCol key={label} xs={6} md>
              <div
                style={{
                  borderRadius: 10,
                  background: `${color}18`,
                  border: `1.5px solid ${color}44`,
                  padding: '14px 18px',
                }}
              >
                <div
                  style={{
                    fontSize: '0.72rem',
                    color,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  {label}
                </div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color, marginTop: 4 }}>
                  ₹{fmt(val, 0)}
                </div>
                <div
                  style={{ fontSize: '0.7rem', color: 'var(--cui-secondary-color)', marginTop: 2 }}
                >
                  across {rows.length} employees
                </div>
              </div>
            </CCol>
          ))}
        </CRow>
      )}
    </div>
  )
}

export default SalaryInvoicePage
