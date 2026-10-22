/**
 * GeneralExpensesTab.jsx
 * ──────────────────────
 * Displays real HR & Admin monthly expense data (Mar–May 2026), sourced from
 * (and editable back into) the same records shown on the General Expenses
 * page: localAdminExpenses (Admin Expenses panel) and localGeneralExpenses'
 * Outsourced Services category (HR Expenses panel). See loadLinkedRows().
 *
 * Features:
 *  • Box/card view per month (actual data) + June 2026 WMA forecast
 *  • Editable line items via modal (pencil edits write into General Expenses'
 *    own records; forecast recalculates from the updated actuals)
 *  • Hide a line item from the forecast (cards/totals/WMA) without touching
 *    its record — reversible via the modal's "Hidden" section
 *  • Add a brand-new Admin Expenses entry, or pull in one that already
 *    exists but isn't shown in this tab yet
 *  • Budget cap = HR pool (5% from active projects) + HR Revenue entries
 *  • Forecasting: Weighted Moving Average — Mar×1 + Apr×2 + May×3 ÷ 6
 *  • Data accuracy note: Improves with more months of input
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  CCard,
  CCardBody,
  CCardHeader,
  CBadge,
  CButton,
  CModal,
  CModalHeader,
  CModalBody,
  CModalFooter,
  CModalTitle,
  CFormInput,
  CFormLabel,
  CTooltip,
  CSpinner,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilPlus, cilX, cilChart, cilLowVision } from '@coreui/icons'
import { localOrgPool } from '../../../services/localOrgPool'
import { localRecruitments } from '../../../services/localRecruitments'
import { localInternships } from '../../../services/localInternships'
import { localAdminExpenses } from '../../../services/localAdminExpenses'
import { localGeneralExpenses } from '../../../services/localGeneralExpenses'
import { localForecastVisibility } from '../../../services/localForecastVisibility'
import { attendanceRevenue } from '../../../services/attendanceRevenue'
import { localCoreSalaries } from '../../../services/localCoreSalaries'
import { localSalaryDetails } from '../../../services/localSalaryDetails'
import { computeEffectiveCTC } from '../staff-payroll/ctcUtils'

// ── Formatters ────────────────────────────────────────────────────────────────

const fmtINR = (n) => {
  if (!n && n !== 0) return '—'
  if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(2)} L`
  if (Math.abs(n) >= 1000) return `₹${(n / 1000).toFixed(1)} K`
  return `₹${Math.round(n).toLocaleString('en-IN')}`
}

const fmtFull = (n) => `₹${Math.round(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

// ── Seed data extracted from "hr and admin expenses - Sheet1.csv" ─────────────
// Each entry: { id, category, vendor, service, values: { '2026-03', '2026-04', '2026-05' } }
//
// `values` below are fallback/backfill numbers only — at runtime, rows are
// resolved (and, if missing, backfilled) against the same records shown on
// the General Expenses page, via `link`:
//   • store: 'admin'   → localAdminExpenses (General Expenses → Admin Expenses)
//   • store: 'general' → localGeneralExpenses, Outsourced Services category
//                        (General Expenses → HR Expenses panel)

const SEED_DATA = [
  // ── HR Expenses ────────────────────────────────────────────────────────────
  {
    id: 'hr_1',
    category: 'HR',
    vendor: 'Manjith Travels',
    service: 'Contract Vehicle',
    frequency: 'Monthly',
    annualCommitment: 523932,
    values: { '2026-03': 46000, '2026-04': 46000, '2026-05': 46000 },
    link: { store: 'admin', vendor: 'Manjith Travels', category: 'Contract Vehicle' },
  },
  {
    id: 'hr_2',
    category: 'HR',
    vendor: 'Oval Blue Technologies',
    service: 'Photocopier SDP',
    frequency: 'Monthly',
    annualCommitment: 84000,
    values: { '2026-03': 5122, '2026-04': 4783, '2026-05': 9289 },
    link: { store: 'admin', vendor: 'Oval Blue Technologies', category: 'Photocopier SDP' },
  },
  {
    id: 'hr_3',
    category: 'HR',
    vendor: 'Volks Electronics',
    service: 'Desktop Rental',
    frequency: 'Monthly',
    annualCommitment: 720000,
    values: { '2026-03': 60720, '2026-04': 61720, '2026-05': 63490 },
    link: { store: 'admin', vendor: 'Volks Electronics', category: 'Desktop Rental' },
  },
  {
    id: 'hr_4',
    category: 'HR',
    vendor: 'Asianet',
    service: 'Internet Services',
    frequency: 'Quarterly',
    annualCommitment: 56640,
    values: { '2026-03': 7076, '2026-04': 7076, '2026-05': 0 },
    link: { store: 'admin', vendor: 'Asianet', category: 'Internet Services' },
  },
  {
    id: 'hr_5',
    category: 'HR',
    vendor: 'Oval Blue Technologies',
    service: 'Photocopier HR',
    frequency: 'Monthly',
    annualCommitment: 84000,
    values: { '2026-03': 0, '2026-04': 0, '2026-05': 8016 },
    link: { store: 'admin', vendor: 'Oval Blue Technologies', category: 'Photocopier HR' },
  },
  // ── Admin Expenses ─────────────────────────────────────────────────────────
  {
    id: 'adm_1',
    category: 'Admin',
    vendor: 'Dr Anandam',
    service: 'House Rent',
    frequency: 'Monthly',
    annualCommitment: 1800000,
    values: { '2026-03': 119100, '2026-04': 119100, '2026-05': 119100 },
    link: { store: 'admin', vendor: 'Dr Anandam', category: 'House Rent' },
  },
  {
    id: 'adm_2',
    category: 'Admin',
    vendor: 'BSNL',
    service: 'Land Line',
    frequency: 'Monthly',
    annualCommitment: 24000,
    values: { '2026-03': 1979, '2026-04': 1976, '2026-05': 1980 },
    link: { store: 'admin', vendor: 'BSNL', category: 'Land Line' },
  },
  {
    id: 'adm_3',
    category: 'Admin',
    vendor: 'KSEB',
    service: 'Electricity Bill',
    frequency: 'Monthly',
    annualCommitment: 264000,
    values: { '2026-03': 19161, '2026-04': 26143, '2026-05': 22741 },
    link: { store: 'admin', vendor: 'KSEB', category: 'Electricity Bill' },
  },
  {
    id: 'adm_4',
    category: 'Admin',
    vendor: 'Imprest',
    service: 'Monthly Imprest',
    frequency: 'Monthly',
    annualCommitment: 120000,
    values: { '2026-03': 10000, '2026-04': 10000, '2026-05': 0 },
    link: { store: 'admin', vendor: 'Imprest', category: 'Monthly Imprest' },
  },
  {
    id: 'adm_5',
    category: 'Admin',
    vendor: 'Asterisk',
    service: 'Photocopier (Admin & CEO)',
    frequency: 'Monthly',
    annualCommitment: 60000,
    values: { '2026-03': 2671, '2026-04': 2950, '2026-05': 2950 },
    link: { store: 'admin', vendor: 'Asterisk', category: 'Photocopier (Admin & DVP)' },
  },
  {
    id: 'adm_6',
    category: 'Admin',
    vendor: 'Indian Postal Department',
    service: 'Speed Post',
    frequency: 'Monthly',
    annualCommitment: 120000,
    values: { '2026-03': 11288, '2026-04': 6899, '2026-05': 34626 },
    link: { store: 'admin', vendor: 'Indian Postal Department', category: 'Speed Post' },
  },
  {
    id: 'adm_7',
    category: 'Admin',
    vendor: 'Vismaya Services',
    service: 'HK Salary',
    frequency: 'Monthly',
    annualCommitment: 600000,
    values: { '2026-03': 46955, '2026-04': 46955, '2026-05': 46328 },
    link: { store: 'general', vendor: 'Vismaya Services', expenseName: 'HK Salary' },
  },
  {
    id: 'adm_8',
    category: 'Admin',
    vendor: 'Vismaya Services',
    service: 'My City Salary',
    frequency: 'Monthly',
    annualCommitment: 810000,
    values: { '2026-03': 66207, '2026-04': 66207, '2026-05': 60103 },
    link: { store: 'general', vendor: 'Vismaya Services', expenseName: 'My City Salary' },
  },
  {
    id: 'adm_9',
    category: 'Admin',
    vendor: 'Naveen Security Services',
    service: 'Security Salary',
    frequency: 'Monthly',
    annualCommitment: 1140000,
    values: { '2026-03': 96550, '2026-04': 96550, '2026-05': 0 },
    link: { store: 'general', vendor: 'Naveen Security Services', expenseName: 'Security Salary' },
  },
  {
    id: 'adm_10',
    category: 'Admin',
    vendor: 'Pestindia Trading Corporation',
    service: 'Pest Control Services',
    frequency: 'Monthly',
    annualCommitment: 56640,
    values: { '2026-03': 0, '2026-04': 0, '2026-05': 4720 },
    link: {
      store: 'admin',
      vendor: 'Pestindia Trading Corporation',
      category: 'Pest Control Services',
    },
  },
]

// ── Month helpers — HR picks the actual-data range; the forecast target,
// weights and labels are all derived from that selection. ───────────────────

const monthKeyOf = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

export const addMonths = (ym, delta) => {
  const [y, m] = ym.split('-').map(Number)
  return monthKeyOf(new Date(y, m - 1 + delta, 1))
}

export const monthsBetween = (start, end) => {
  const months = []
  let cur = start
  let guard = 0
  while (cur <= end && guard < 120) {
    months.push(cur)
    cur = addMonths(cur, 1)
    guard += 1
  }
  return months
}

export const monthLabel = (ym) => {
  if (!ym) return ''
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

// Past/current months — used for the "Forecast from" selector (actual data range)
const PAST_MONTHS = monthsBetween(addMonths(monthKeyOf(new Date()), -35), monthKeyOf(new Date()))

// All selectable months — 36 months back through 36 months ahead (covers 2027+)
const ALL_MONTHS = monthsBetween(
  addMonths(monthKeyOf(new Date()), -35),
  addMonths(monthKeyOf(new Date()), 36),
)

// Keep backward-compat alias (used for range validation)
const AVAILABLE_MONTHS = ALL_MONTHS

const DEFAULT_RANGE = (() => {
  const preferredStart = '2026-03'
  const preferredEnd = '2026-05'
  if (PAST_MONTHS.includes(preferredStart) && ALL_MONTHS.includes(preferredEnd)) {
    return { start: preferredStart, end: preferredEnd }
  }
  const n = PAST_MONTHS.length
  return { start: PAST_MONTHS[Math.max(0, n - 3)], end: PAST_MONTHS[n - 1] }
})()

// ── Resolve rows against the real General Expenses records ───────────────────
// Reads (and, on first run, backfills) each row's monthly actuals from
// localAdminExpenses or localGeneralExpenses so this tab and the General
// Expenses page always show the same numbers.

export const monthParts = (ym) => {
  const [y, m] = ym.split('-')
  return { year: parseInt(y, 10), month: parseInt(m, 10) }
}

export const loadLinkedRows = async (dataMonths) => {
  const outsourcedCat = (await localGeneralExpenses.categories.list()).find(
    (c) => c.name === 'Outsourced Services',
  )
  const visibility = await localForecastVisibility.get()

  const legacyRows = await Promise.all(
    SEED_DATA.map(async (row) => {
      if (row.link.store === 'admin') {
        let entry = await localAdminExpenses.findByVendorCategory(
          row.link.vendor,
          row.link.category,
        )
        if (!entry) {
          entry = await localAdminExpenses.create({
            vendor_name: row.link.vendor,
            expense_category: row.link.category,
            frequency: row.frequency,
            annual_amount: row.annualCommitment,
            group: row.category,
            status: 'Active',
          })
        }
        // Only backfill months we actually have a known CSV value for — a
        // month outside that original window stays genuinely blank (not a
        // fabricated zero) until HR enters something for it.
        for (const m of dataMonths) {
          if ((entry.monthly_actuals || {})[m] === undefined && row.values[m] !== undefined) {
            entry = await localAdminExpenses.setMonthlyActual(entry.id, m, row.values[m])
          }
        }
        const values = {}
        dataMonths.forEach((m) => {
          values[m] = entry.monthly_actuals?.[m]
        })
        return {
          ...row,
          id: `admin:${entry.id}`,
          values,
          linkRef: { store: 'admin', entryId: entry.id },
        }
      }

      // store: 'general' — Outsourced Services category in localGeneralExpenses
      const values = {}
      const monthIds = {}
      for (const m of dataMonths) {
        const { year, month } = monthParts(m)
        if (!outsourcedCat) {
          values[m] = row.values[m]
          continue
        }
        const { items } = await localGeneralExpenses.expenses.list({
          year,
          month,
          category_id: outsourcedCat.id,
          page_size: 500,
        })
        let record = items.find(
          (e) => e.expense_name.toLowerCase() === row.link.expenseName.toLowerCase(),
        )
        // Only auto-create a record for months we have a known CSV value for;
        // otherwise leave the month blank until HR enters something for it.
        if (!record && row.values[m] !== undefined) {
          record = await localGeneralExpenses.expenses.create({
            category_id: outsourcedCat.id,
            expense_name: row.link.expenseName,
            month,
            year,
            frequency: row.frequency,
            planned_amount: Math.round(row.annualCommitment / 12),
            actual_amount: row.values[m],
            status: row.values[m] > 0 ? 'Paid' : 'Pending',
            remarks: `Vendor: ${row.link.vendor}`,
          })
        }
        if (record) {
          values[m] = record.actual_amount
          monthIds[m] = record.id
        }
      }
      const id = `general:${row.link.vendor}|${row.link.expenseName}`
      return { ...row, id, values, linkRef: { store: 'general', monthIds } }
    }),
  )

  // Extra Admin Expenses entries HR has explicitly opted into this tab via
  // "Add Existing Expense" (or created via "Add New Expense").
  const legacyAdminEntryIds = new Set(
    legacyRows.filter((r) => r.linkRef.store === 'admin').map((r) => r.linkRef.entryId),
  )
  const extraRows = (
    await Promise.all(
      visibility.included
        .filter((key) => key.startsWith('admin:'))
        .map((key) => key.slice('admin:'.length))
        .filter((entryId) => !legacyAdminEntryIds.has(entryId))
        .map(async (entryId) => {
          let entry
          try {
            entry = await localAdminExpenses.get(entryId)
          } catch {
            return null
          }
          const values = {}
          dataMonths.forEach((m) => {
            values[m] = entry.monthly_actuals?.[m]
          })
          return {
            id: `admin:${entry.id}`,
            category: entry.group === 'HR' ? 'HR' : 'Admin',
            vendor: entry.vendor_name,
            service: entry.expense_category,
            frequency: entry.frequency,
            annualCommitment: entry.annual_amount,
            values,
            linkRef: { store: 'admin', entryId: entry.id },
          }
        }),
    )
  ).filter(Boolean)

  return [...legacyRows, ...extraRows].map((r) => ({
    ...r,
    hidden: visibility.hidden.includes(r.id),
  }))
}

// ── Forecast: recency-weighted average on the entered months only.
// Months that were never entered (undefined/null) are skipped entirely —
// they are NOT treated as ₹0, so a month with no data doesn't drag the
// forecast down. Weights: oldest month = 1, next = 2, … newest = n.
export const computeForecast = (vals) => {
  // Keep only months where an amount was actually entered.
  // An explicit ₹0 entry counts; a missing/undefined month is excluded.
  const known = vals.filter((v) => v !== undefined && v !== null)
  const totalCount = vals.length
  if (known.length === 0) return { value: 0, knownCount: 0, totalCount, weighted: false }
  // Always recency-weighted regardless of how many months have data.
  const n = known.length
  const weightSum = (n * (n + 1)) / 2
  const total = known.reduce((acc, v, i) => acc + v * (i + 1), 0)
  return { value: Math.round(total / weightSum), knownCount: n, totalCount, weighted: true }
}

// ── Category colour map ───────────────────────────────────────────────────────

const CAT_COLORS = {
  HR: { badge: 'primary', line: '#4cc9f0', bg: 'rgba(76,201,240,0.08)' },
  Admin: { badge: 'warning', line: '#ffd166', bg: 'rgba(255,209,102,0.08)' },
  Core: { badge: 'success', line: '#06d6a0', bg: 'rgba(6,214,160,0.08)' },
}

// ── Core salary total per month (matches CoreSalaryPanel's invoiceFor logic) ──
// Uses computeEffectiveCTC + the record's own ctcOverrides, not the raw
// formula — HRA/OA (and any other pinned field) are HR-entered per record,
// not derived, so ignoring ctcOverrides here would silently undercount.
export const getCoreMonthTotal = async (ym) => {
  const [y, m] = ym.split('-').map(Number)
  const entries = await localCoreSalaries.list({ year: y, month: m })
  const details = await Promise.all(
    entries.map((entry) => localSalaryDetails.get(entry.employee_code, entry.year, entry.month)),
  )
  return details.reduce(
    (sum, d) =>
      sum + (d ? computeEffectiveCTC(d, d.ctcOverrides || {}).totalInvoiceAmount || 0 : 0),
    0,
  )
}

// ── Month Summary Card ────────────────────────────────────────────────────────

const MonthCard = ({ monthKey, label, rows, isForecast }) => {
  const hrTotal = rows
    .filter((r) => r.category === 'HR')
    .reduce((s, r) => s + (r.values[monthKey] || 0), 0)
  const adminTotal = rows
    .filter((r) => r.category === 'Admin')
    .reduce((s, r) => s + (r.values[monthKey] || 0), 0)
  const coreTotal = rows
    .filter((r) => r.category === 'Core')
    .reduce((s, r) => s + (r.values[monthKey] || 0), 0)
  const grandTotal = hrTotal + adminTotal + coreTotal

  return (
    <div
      style={{
        minWidth: 220,
        maxWidth: 260,
        flex: '0 0 auto',
        border: isForecast
          ? '2px dashed rgba(6,214,160,0.6)'
          : '1.5px solid var(--cui-border-color)',
        borderRadius: 16,
        background: isForecast
          ? 'linear-gradient(145deg,rgba(6,214,160,0.05),rgba(6,214,160,0.02))'
          : 'var(--cui-card-bg, var(--cui-body-bg))',
        padding: '18px 20px',
        position: 'relative',
        boxShadow: isForecast ? '0 4px 24px rgba(6,214,160,0.12)' : '0 2px 12px rgba(0,0,0,0.08)',
        transition: 'box-shadow 0.2s ease',
      }}
    >
      {/* Month header */}
      <div className="d-flex align-items-start justify-content-between mb-3">
        <div>
          <div
            className="fw-bold"
            style={{ fontSize: '0.95rem', color: isForecast ? '#06d6a0' : 'var(--cui-body-color)' }}
          >
            {label}
          </div>
          {isForecast && (
            <CBadge
              color="success"
              shape="rounded-pill"
              style={{ fontSize: '0.65rem', marginTop: 4 }}
            >
              🔮 WMA Forecast
            </CBadge>
          )}
        </div>
      </div>

      {/* Key metrics */}
      <div className="d-flex flex-column gap-2">
        <div className="d-flex justify-content-between align-items-center">
          <span style={{ fontSize: '0.78rem', color: 'var(--cui-secondary-color)' }}>
            HR Expenses
          </span>
          <span className="fw-semibold" style={{ fontSize: '0.82rem', color: '#4cc9f0' }}>
            {fmtINR(hrTotal)}
          </span>
        </div>
        <div className="d-flex justify-content-between align-items-center">
          <span style={{ fontSize: '0.78rem', color: 'var(--cui-secondary-color)' }}>
            Admin Expenses
          </span>
          <span className="fw-semibold" style={{ fontSize: '0.82rem', color: '#ffd166' }}>
            {fmtINR(adminTotal)}
          </span>
        </div>
        <div className="d-flex justify-content-between align-items-center">
          <span style={{ fontSize: '0.78rem', color: 'var(--cui-secondary-color)' }}>
            Core Salary
          </span>
          <span className="fw-semibold" style={{ fontSize: '0.82rem', color: '#06d6a0' }}>
            {fmtINR(coreTotal)}
          </span>
        </div>

        <div
          style={{
            borderTop: '1px solid var(--cui-border-color)',
            paddingTop: 10,
            marginTop: 2,
          }}
        >
          <div className="d-flex justify-content-between align-items-center">
            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Total</span>
            <span
              className="fw-bold"
              style={{
                fontSize: '0.9rem',
                color: isForecast ? '#06d6a0' : 'var(--cui-body-color)',
              }}
            >
              {fmtINR(grandTotal)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Edit Modal ────────────────────────────────────────────────────────────────

const EMPTY_NEW_EXPENSE = {
  vendor: '',
  service: '',
  group: 'Admin',
  frequency: 'Monthly',
  annual: '',
  amount: '',
}
const FREQUENCIES = ['Monthly', 'Quarterly', 'Half Yearly', 'Annually']

const EditMonthModal = ({
  visible,
  monthKey,
  rows,
  candidateEntries,
  onClose,
  onSave,
  onHide,
  onUnhide,
  onAddNew,
  onAddExisting,
}) => {
  const [draft, setDraft] = useState({})
  const [addMode, setAddMode] = useState(null) // null | 'new' | 'existing'
  const [newExpense, setNewExpense] = useState(EMPTY_NEW_EXPENSE)
  const [existingPick, setExistingPick] = useState('')

  const visibleRows = rows.filter((r) => !r.hidden)
  const hiddenRows = rows.filter((r) => r.hidden)

  React.useEffect(() => {
    if (visible && monthKey) {
      const init = {}
      visibleRows.forEach((r) => {
        init[r.id] = String(r.values[monthKey] ?? 0)
      })
      setDraft(init)
    }
    if (!visible) {
      setAddMode(null)
      setNewExpense(EMPTY_NEW_EXPENSE)
      setExistingPick('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, monthKey, rows])

  const handleChange = (id, val) => setDraft((d) => ({ ...d, [id]: val }))

  const handleSave = () => {
    const parsed = {}
    Object.entries(draft).forEach(([id, val]) => {
      parsed[id] = parseFloat(val) || 0
    })
    onSave(monthKey, parsed)
    onClose()
  }

  const handleCreateNew = () => {
    onAddNew({ ...newExpense, monthKey })
    setNewExpense(EMPTY_NEW_EXPENSE)
    setAddMode(null)
  }

  const handleAddExisting = () => {
    if (!existingPick) return
    onAddExisting(existingPick)
    setExistingPick('')
    setAddMode(null)
  }

  const hrRows = visibleRows.filter((r) => r.category === 'HR')
  const adminRows = visibleRows.filter((r) => r.category === 'Admin')

  return (
    <CModal visible={visible} onClose={onClose} size="lg" scrollable>
      <CModalHeader>
        <CModalTitle style={{ fontSize: '1rem' }}>
          Edit Expenses — {monthLabel(monthKey) || monthKey}
        </CModalTitle>
      </CModalHeader>
      <CModalBody>
        <div className="d-flex align-items-start justify-content-between gap-2 mb-3">
          <div className="small text-body-secondary">
            Update actual expense values. The June forecast recalculates automatically after saving.
          </div>
          <CButton
            size="sm"
            color="primary"
            variant="ghost"
            className="flex-shrink-0"
            onClick={() => setAddMode((m) => (m ? null : 'new'))}
          >
            <CIcon icon={cilPlus} className="me-1" style={{ width: 13, height: 13 }} />
            Add Expense
          </CButton>
        </div>

        {addMode && (
          <div
            className="border rounded-3 p-3 mb-3"
            style={{ background: 'var(--cui-tertiary-bg)' }}
          >
            <div className="d-flex gap-2 mb-3 align-items-center">
              <CButton
                size="sm"
                color={addMode === 'new' ? 'primary' : 'secondary'}
                variant={addMode === 'new' ? undefined : 'ghost'}
                onClick={() => setAddMode('new')}
              >
                New Expense
              </CButton>
              <CButton
                size="sm"
                color={addMode === 'existing' ? 'primary' : 'secondary'}
                variant={addMode === 'existing' ? undefined : 'ghost'}
                onClick={() => setAddMode('existing')}
              >
                Existing Expense
              </CButton>
              <CButton
                size="sm"
                color="secondary"
                variant="ghost"
                className="ms-auto p-1"
                onClick={() => setAddMode(null)}
              >
                <CIcon icon={cilX} style={{ width: 12, height: 12 }} />
              </CButton>
            </div>

            {addMode === 'new' && (
              <div className="d-flex flex-column gap-2">
                <div className="d-flex gap-2 flex-wrap">
                  <CFormInput
                    size="sm"
                    placeholder="Vendor"
                    value={newExpense.vendor}
                    onChange={(e) => setNewExpense((f) => ({ ...f, vendor: e.target.value }))}
                    style={{ flex: 1, minWidth: 140 }}
                  />
                  <CFormInput
                    size="sm"
                    placeholder="Expense / service name"
                    value={newExpense.service}
                    onChange={(e) => setNewExpense((f) => ({ ...f, service: e.target.value }))}
                    style={{ flex: 1, minWidth: 140 }}
                  />
                </div>
                <div className="d-flex gap-2 flex-wrap">
                  <select
                    className="form-select form-select-sm"
                    value={newExpense.group}
                    onChange={(e) => setNewExpense((f) => ({ ...f, group: e.target.value }))}
                    style={{ maxWidth: 100 }}
                  >
                    <option value="Admin">Admin</option>
                    <option value="HR">HR</option>
                  </select>
                  <select
                    className="form-select form-select-sm"
                    value={newExpense.frequency}
                    onChange={(e) => setNewExpense((f) => ({ ...f, frequency: e.target.value }))}
                    style={{ maxWidth: 130 }}
                  >
                    {FREQUENCIES.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                  <CFormInput
                    size="sm"
                    type="number"
                    min={0}
                    placeholder="Annual commitment ₹"
                    value={newExpense.annual}
                    onChange={(e) => setNewExpense((f) => ({ ...f, annual: e.target.value }))}
                    style={{ maxWidth: 150 }}
                  />
                  <CFormInput
                    size="sm"
                    type="number"
                    min={0}
                    placeholder={`${monthLabel(monthKey) || 'This month'} actual ₹`}
                    value={newExpense.amount}
                    onChange={(e) => setNewExpense((f) => ({ ...f, amount: e.target.value }))}
                    style={{ maxWidth: 160 }}
                  />
                </div>
                <CButton
                  size="sm"
                  color="primary"
                  className="align-self-start"
                  disabled={!newExpense.vendor.trim() || !newExpense.service.trim()}
                  onClick={handleCreateNew}
                >
                  Create & Add
                </CButton>
              </div>
            )}

            {addMode === 'existing' && (
              <div className="d-flex gap-2 align-items-center flex-wrap">
                <select
                  className="form-select form-select-sm"
                  value={existingPick}
                  onChange={(e) => setExistingPick(e.target.value)}
                  style={{ flex: 1, minWidth: 220 }}
                >
                  <option value="">
                    {candidateEntries.length === 0
                      ? 'No other Admin Expenses entries available'
                      : 'Select an expense already in Admin Expenses…'}
                  </option>
                  {candidateEntries.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.expense_category} — {e.vendor_name}
                    </option>
                  ))}
                </select>
                <CButton
                  size="sm"
                  color="primary"
                  disabled={!existingPick}
                  onClick={handleAddExisting}
                >
                  Add
                </CButton>
              </div>
            )}
          </div>
        )}

        {[
          { label: 'HR Expenses', rows: hrRows, color: '#4cc9f0' },
          { label: 'Admin Expenses', rows: adminRows, color: '#ffd166' },
        ].map(({ label, rows: catRows, color }) => (
          <div key={label} className="mb-4">
            <div
              className="fw-semibold mb-2 pb-1"
              style={{
                borderBottom: `2px solid ${color}`,
                color,
                fontSize: '0.85rem',
                letterSpacing: '0.05em',
              }}
            >
              {label}
            </div>
            <div className="d-flex flex-column gap-2">
              {catRows.length === 0 && (
                <div className="text-body-secondary small">
                  No visible expenses in this section.
                </div>
              )}
              {catRows.map((r) => (
                <div key={r.id} className="d-flex align-items-center gap-3">
                  <div style={{ flex: 1, fontSize: '0.82rem' }}>
                    <div className="fw-medium">{r.service}</div>
                    <div className="text-body-secondary" style={{ fontSize: '0.72rem' }}>
                      {r.vendor} · {r.frequency}
                    </div>
                  </div>
                  <div style={{ width: 140 }}>
                    <CFormInput
                      type="number"
                      size="sm"
                      min={0}
                      step={1}
                      value={draft[r.id] ?? ''}
                      onChange={(e) => handleChange(r.id, e.target.value)}
                      style={{ textAlign: 'right' }}
                    />
                  </div>
                  <CButton
                    size="sm"
                    color="ghost"
                    className="p-1 text-body-secondary flex-shrink-0"
                    title="Hide from forecast"
                    onClick={() => onHide(r.id)}
                  >
                    <CIcon icon={cilLowVision} style={{ width: 14, height: 14 }} />
                  </CButton>
                </div>
              ))}
            </div>
          </div>
        ))}

        {hiddenRows.length > 0 && (
          <div className="mt-1">
            <div
              className="fw-semibold mb-2 small text-body-secondary"
              style={{ letterSpacing: '0.05em' }}
            >
              HIDDEN FROM FORECAST ({hiddenRows.length})
            </div>
            <div className="d-flex flex-column gap-2">
              {hiddenRows.map((r) => (
                <div
                  key={r.id}
                  className="d-flex align-items-center gap-3"
                  style={{ opacity: 0.65 }}
                >
                  <div style={{ flex: 1, fontSize: '0.82rem' }}>
                    <div className="fw-medium">{r.service}</div>
                    <div className="text-body-secondary" style={{ fontSize: '0.72rem' }}>
                      {r.vendor}
                    </div>
                  </div>
                  <CButton size="sm" color="ghost" onClick={() => onUnhide(r.id)}>
                    Unhide
                  </CButton>
                </div>
              ))}
            </div>
          </div>
        )}
      </CModalBody>
      <CModalFooter>
        <CButton color="secondary" variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </CButton>
        <CButton color="primary" size="sm" onClick={handleSave}>
          Save & Recalculate
        </CButton>
      </CModalFooter>
    </CModal>
  )
}

// ── HR Revenue Modal ──────────────────────────────────────────────────────────

const HRRevenueModal = ({ visible, revenues, onClose, onSave }) => {
  const [draft, setDraft] = useState([])

  React.useEffect(() => {
    if (visible) setDraft(revenues.map((r) => ({ ...r })))
  }, [visible, revenues])

  const handleChange = (idx, field, val) => {
    setDraft((d) => d.map((r, i) => (i === idx ? { ...r, [field]: val } : r)))
  }

  const addRow = () => setDraft((d) => [...d, { id: `rev_${Date.now()}`, label: '', amount: '' }])

  const removeRow = (idx) => setDraft((d) => d.filter((_, i) => i !== idx))

  return (
    <CModal visible={visible} onClose={onClose} size="md">
      <CModalHeader>
        <CModalTitle style={{ fontSize: '1rem' }}>HR Revenue Sources</CModalTitle>
      </CModalHeader>
      <CModalBody>
        <div className="small text-body-secondary mb-3">
          Enter monthly HR revenue amounts (Internship, Training, Recruitment, Hall Rent, etc.)
          These are added to the HR pool budget for the budget-remaining calculation.
        </div>
        <div className="d-flex flex-column gap-2">
          {draft.map((r, idx) => (
            <div key={r.id} className="d-flex gap-2 align-items-center">
              <CFormInput
                size="sm"
                placeholder="Source (e.g. Hall Rent)"
                value={r.label}
                onChange={(e) => handleChange(idx, 'label', e.target.value)}
                style={{ flex: 2 }}
              />
              <CFormInput
                size="sm"
                type="number"
                placeholder="₹ Amount"
                value={r.amount}
                onChange={(e) => handleChange(idx, 'amount', e.target.value)}
                style={{ flex: 1, textAlign: 'right' }}
              />
              <CButton
                size="sm"
                color="ghost"
                className="p-1 text-danger"
                onClick={() => removeRow(idx)}
              >
                <CIcon icon={cilX} style={{ width: 13, height: 13 }} />
              </CButton>
            </div>
          ))}
        </div>
        <CButton size="sm" color="primary" variant="ghost" className="mt-3" onClick={addRow}>
          <CIcon icon={cilPlus} className="me-1" style={{ width: 13, height: 13 }} />
          Add Revenue Source
        </CButton>
      </CModalBody>
      <CModalFooter>
        <CButton color="secondary" variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </CButton>
        <CButton
          color="primary"
          size="sm"
          onClick={() => {
            onSave(
              draft
                .filter((r) => r.label && parseFloat(r.amount) > 0)
                .map((r) => ({ ...r, amount: parseFloat(r.amount) || 0 })),
            )
            onClose()
          }}
        >
          Save
        </CButton>
      </CModalFooter>
    </CModal>
  )
}

// ── Detail Table ──────────────────────────────────────────────────────────────

const DetailTable = ({ rows, forecastValues, forecastResults, dataMonths, forecastMonth }) => {
  const hrRows = rows.filter((r) => r.category === 'HR')
  const adminRows = rows.filter((r) => r.category === 'Admin')

  const renderSection = (catRows, catLabel, color) => {
    const totals = dataMonths.map((m) => catRows.reduce((s, r) => s + (r.values[m] || 0), 0))
    const forecastTotal = catRows.reduce((s, r) => s + (forecastValues[r.id] || 0), 0)

    return (
      <React.Fragment key={catLabel}>
        <tr>
          <td
            colSpan={dataMonths.length + 2}
            style={{
              background: color === '#4cc9f0' ? 'rgba(76,201,240,0.07)' : 'rgba(255,209,102,0.07)',
              fontWeight: 700,
              fontSize: '0.78rem',
              color,
              letterSpacing: '0.06em',
              padding: '8px 12px',
            }}
          >
            {catLabel}
          </td>
        </tr>
        {catRows.map((r) => {
          const rawVals = dataMonths.map((m) => r.values[m])
          const vals = rawVals.map((v) => v || 0)
          const known = rawVals.filter((v) => v !== undefined && v !== null)
          const fc = forecastValues[r.id] || 0
          const result = forecastResults[r.id]
          const trend = known.length >= 2 ? known[known.length - 1] - known[0] : 0

          return (
            <tr key={r.id} style={{ fontSize: '0.8rem' }}>
              <td style={{ paddingLeft: 20 }}>
                <div className="fw-medium">{r.service}</div>
                <div className="text-body-secondary" style={{ fontSize: '0.7rem' }}>
                  {r.vendor}
                </div>
              </td>
              {vals.map((v, i) => (
                <td key={i} className="text-end" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {v > 0 ? fmtINR(v) : <span className="text-body-tertiary">—</span>}
                </td>
              ))}
              <td
                className="text-end fw-semibold"
                style={{
                  color: '#06d6a0',
                  borderLeft: '2px dashed rgba(6,214,160,0.3)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {fc > 0 ? fmtINR(fc) : <span className="text-body-tertiary">—</span>}
                {result && !result.weighted && result.knownCount > 0 && (
                  <div
                    style={{
                      fontSize: '0.63rem',
                      color: 'var(--cui-secondary-color)',
                      marginTop: 1,
                    }}
                  >
                    avg of {result.knownCount}/{result.totalCount} mo
                  </div>
                )}
                {trend !== 0 && (
                  <div
                    style={{
                      fontSize: '0.63rem',
                      color: trend > 0 ? '#ff6b6b' : '#06d6a0',
                      marginTop: 1,
                    }}
                  >
                    {trend > 0 ? '▲' : '▼'} trend
                  </div>
                )}
              </td>
            </tr>
          )
        })}
        <tr style={{ background: 'var(--cui-tertiary-bg)', fontWeight: 700 }}>
          <td style={{ paddingLeft: 20, fontSize: '0.8rem' }}>Subtotal</td>
          {totals.map((t, i) => (
            <td key={i} className="text-end" style={{ color, fontSize: '0.82rem' }}>
              {fmtINR(t)}
            </td>
          ))}
          <td
            className="text-end"
            style={{
              color: '#06d6a0',
              borderLeft: '2px dashed rgba(6,214,160,0.3)',
              fontSize: '0.82rem',
            }}
          >
            {fmtINR(forecastTotal)}
          </td>
        </tr>
      </React.Fragment>
    )
  }

  return (
    <div style={{ overflowX: 'auto', marginTop: 4 }}>
      <table
        className="table table-bordered align-middle mb-0"
        style={{ minWidth: 700, fontSize: '0.82rem' }}
      >
        <thead>
          <tr className="bg-body-tertiary">
            <th style={{ minWidth: 220 }}>Expense Item</th>
            {dataMonths.map((m) => (
              <th key={m} className="text-center" style={{ minWidth: 110 }}>
                {monthLabel(m)}
                <div
                  style={{
                    fontSize: '0.65rem',
                    color: 'var(--cui-secondary-color)',
                    fontWeight: 400,
                  }}
                >
                  Actual
                </div>
              </th>
            ))}
            <th
              className="text-center"
              style={{
                minWidth: 120,
                color: '#06d6a0',
                borderLeft: '2px dashed rgba(6,214,160,0.3)',
              }}
            >
              {monthLabel(forecastMonth)}
              <div style={{ fontSize: '0.65rem', fontWeight: 400 }}>WMA Forecast</div>
            </th>
          </tr>
        </thead>
        <tbody>
          {renderSection(
            rows.filter((r) => r.category === 'HR'),
            'HR Expenses',
            '#4cc9f0',
          )}
          <tr style={{ height: 6 }}>
            <td
              colSpan={dataMonths.length + 2}
              style={{ background: 'var(--cui-border-color)', padding: 0 }}
            />
          </tr>
          {renderSection(
            rows.filter((r) => r.category === 'Admin'),
            'Admin Expenses',
            '#ffd166',
          )}
          <tr style={{ height: 6 }}>
            <td
              colSpan={dataMonths.length + 2}
              style={{ background: 'var(--cui-border-color)', padding: 0 }}
            />
          </tr>
          {renderSection(
            rows.filter((r) => r.category === 'Core'),
            'Core Salary',
            '#06d6a0',
          )}
          {/* Grand total */}
          <tr
            style={{
              borderTop: '2.5px solid var(--cui-border-color)',
              fontWeight: 800,
              fontSize: '0.88rem',
            }}
          >
            <td>Grand Total</td>
            {dataMonths.map((m) => {
              const total = rows.reduce((s, r) => s + (r.values[m] || 0), 0)
              return (
                <td key={m} className="text-end text-primary">
                  {fmtINR(total)}
                </td>
              )
            })}
            <td
              className="text-end fw-bold"
              style={{ color: '#06d6a0', borderLeft: '2px dashed rgba(6,214,160,0.3)' }}
            >
              {fmtINR(rows.reduce((s, r) => s + (forecastValues[r.id] || 0), 0))}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// ── Profit / Loss Report ──────────────────────────────────────────────────────
// Not an income-vs-expense statement — a trend check: is the forecast month
// costing more than actual historical spend (Loss) or holding/falling (Profit)?

export const computeCatStats = (rows, dataMonths, forecastValues) => {
  return ['HR', 'Admin', 'Core'].map((cat) => {
    const catRows = rows.filter((r) => r.category === cat)
    const monthlyTotals = dataMonths.map((m) => catRows.reduce((s, r) => s + (r.values[m] || 0), 0))
    const avg = monthlyTotals.length
      ? Math.round(monthlyTotals.reduce((a, b) => a + b, 0) / monthlyTotals.length)
      : 0
    const forecast = catRows.reduce((s, r) => s + (forecastValues[r.id] || 0), 0)
    return { cat, avg, forecast, diff: forecast - avg }
  })
}

export const computeRowStats = (rows, dataMonths, forecastValues) => {
  return rows
    .map((r) => {
      const known = dataMonths.map((m) => r.values[m]).filter((v) => v !== undefined && v !== null)
      const baseline = known.length
        ? Math.round(known.reduce((a, b) => a + b, 0) / known.length)
        : null
      const forecast = forecastValues[r.id] || 0
      const diff = baseline === null ? null : forecast - baseline
      const pct = baseline ? (diff / baseline) * 100 : null
      return { ...r, baseline, forecast, diff, pct }
    })
    .sort((a, b) => (b.diff ?? -Infinity) - (a.diff ?? -Infinity))
}

const ProfitLossReport = ({
  rows,
  dataMonths,
  forecastMonth,
  forecastValues,
  monthTotals,
  avgActual,
  forecastTotal,
}) => {
  const lastActualTotal = monthTotals[monthTotals.length - 1]?.total || 0
  const netChangeVsAvg = forecastTotal - avgActual
  const pctVsAvg = avgActual > 0 ? (netChangeVsAvg / avgActual) * 100 : null
  const netChangeVsLast = forecastTotal - lastActualTotal
  const isLoss = netChangeVsAvg > 0

  const catStats = useMemo(
    () => computeCatStats(rows, dataMonths, forecastValues),
    [rows, dataMonths, forecastValues],
  )

  const rowStats = useMemo(
    () => computeRowStats(rows, dataMonths, forecastValues),
    [rows, dataMonths, forecastValues],
  )

  return (
    <CCard className="border-0 shadow-sm mt-4">
      <CCardHeader className="py-3">
        <h6 className="fw-bold mb-0">Profit / Loss Report — {monthLabel(forecastMonth)} Outlook</h6>
      </CCardHeader>
      <CCardBody>
        {/* Verdict banner */}
        <div
          className="d-flex align-items-center gap-3 rounded-3 p-3 mb-4"
          style={{
            background: isLoss ? 'rgba(255,107,107,0.08)' : 'rgba(6,214,160,0.08)',
            border: `1px solid ${isLoss ? 'rgba(255,107,107,0.3)' : 'rgba(6,214,160,0.3)'}`,
          }}
        >
          <div style={{ fontSize: '2rem' }}>{isLoss ? '📈' : '📉'}</div>
          <div>
            <div
              className="fw-bold"
              style={{ fontSize: '1.1rem', color: isLoss ? '#ff6b6b' : '#06d6a0' }}
            >
              {isLoss ? 'LOSS — Expenses trending up' : 'PROFIT — Expenses stable or falling'}
            </div>
            <div className="small text-body-secondary">
              {monthLabel(forecastMonth)} is forecasted at {fmtINR(forecastTotal)},{' '}
              {isLoss ? 'up' : 'down'} {fmtINR(Math.abs(netChangeVsAvg))}
              {pctVsAvg !== null && ` (${Math.abs(pctVsAvg).toFixed(1)}%)`} compared to the{' '}
              {dataMonths.length}-month actual average of {fmtINR(avgActual)}.
            </div>
          </div>
        </div>

        {/* Headline figures */}
        <div className="d-flex flex-wrap gap-4 mb-4">
          <div>
            <div className="text-body-secondary small">{dataMonths.length}-month Avg Actual</div>
            <div className="fw-bold" style={{ fontSize: '1.05rem' }}>
              {fmtINR(avgActual)}
            </div>
          </div>
          <div>
            <div className="text-body-secondary small">{monthLabel(forecastMonth)} Forecast</div>
            <div
              className="fw-bold"
              style={{ fontSize: '1.05rem', color: isLoss ? '#ff6b6b' : '#06d6a0' }}
            >
              {fmtINR(forecastTotal)}
            </div>
          </div>
          <div>
            <div className="text-body-secondary small">
              vs Last Actual Month ({monthLabel(dataMonths[dataMonths.length - 1])})
            </div>
            <div
              className="fw-bold"
              style={{ fontSize: '1.05rem', color: netChangeVsLast > 0 ? '#ff6b6b' : '#06d6a0' }}
            >
              {netChangeVsLast > 0 ? '+' : ''}
              {fmtINR(netChangeVsLast)}
            </div>
          </div>
        </div>

        {/* Category breakdown */}
        <div className="mb-4">
          <div className="fw-semibold small mb-2">By Category</div>
          <div className="d-flex flex-wrap gap-3">
            {catStats.map((c) => (
              <div
                key={c.cat}
                className="border rounded-3 p-3"
                style={{ minWidth: 220, flex: '1 1 220px' }}
              >
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <span className="fw-semibold">{c.cat} Expenses</span>
                  <CBadge color={c.diff > 0 ? 'danger' : 'success'} shape="rounded-pill">
                    {c.diff > 0 ? 'Loss' : 'Profit'}
                  </CBadge>
                </div>
                <div className="d-flex justify-content-between small text-body-secondary">
                  <span>Avg Actual</span>
                  <span>{fmtINR(c.avg)}</span>
                </div>
                <div className="d-flex justify-content-between small text-body-secondary">
                  <span>Forecast</span>
                  <span>{fmtINR(c.forecast)}</span>
                </div>
                <div
                  className="d-flex justify-content-between small fw-semibold mt-1"
                  style={{ color: c.diff > 0 ? '#ff6b6b' : '#06d6a0' }}
                >
                  <span>Change</span>
                  <span>
                    {c.diff > 0 ? '+' : ''}
                    {fmtINR(c.diff)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Per-line-item detail — biggest projected increases first */}
        <div className="fw-semibold small mb-2">By Expense Line</div>
        <div style={{ overflowX: 'auto' }}>
          <table
            className="table table-bordered table-sm align-middle mb-0"
            style={{ fontSize: '0.8rem' }}
          >
            <thead>
              <tr className="bg-body-tertiary">
                <th>Expense</th>
                <th className="text-end">Avg Actual</th>
                <th className="text-end">Forecast</th>
                <th className="text-end">Change</th>
                <th className="text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {rowStats.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className="fw-medium">{r.service}</div>
                    <div className="text-body-secondary" style={{ fontSize: '0.7rem' }}>
                      {r.vendor}
                    </div>
                  </td>
                  <td className="text-end">
                    {r.baseline !== null ? (
                      fmtINR(r.baseline)
                    ) : (
                      <span className="text-body-tertiary">—</span>
                    )}
                  </td>
                  <td className="text-end">
                    {r.forecast > 0 ? (
                      fmtINR(r.forecast)
                    ) : (
                      <span className="text-body-tertiary">—</span>
                    )}
                  </td>
                  <td
                    className="text-end"
                    style={{
                      color: r.diff === null ? undefined : r.diff > 0 ? '#ff6b6b' : '#06d6a0',
                    }}
                  >
                    {r.diff === null ? (
                      <span className="text-body-secondary">New</span>
                    ) : (
                      <>
                        {r.diff > 0 ? '+' : ''}
                        {fmtINR(r.diff)}
                        {r.pct !== null && (
                          <div style={{ fontSize: '0.65rem' }}>
                            ({r.pct > 0 ? '+' : ''}
                            {r.pct.toFixed(0)}%)
                          </div>
                        )}
                      </>
                    )}
                  </td>
                  <td className="text-center">
                    {r.diff === null ? (
                      <CBadge color="secondary" shape="rounded-pill">
                        New
                      </CBadge>
                    ) : (
                      <CBadge color={r.diff > 0 ? 'danger' : 'success'} shape="rounded-pill">
                        {r.diff > 0 ? 'Loss' : 'Profit'}
                      </CBadge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CCardBody>
    </CCard>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

const GeneralExpensesTab = () => {
  // Actual-data range HR forecasts from — persisted across sessions.
  const [range, setRangeState] = useState(DEFAULT_RANGE)

  useEffect(() => {
    let cancelled = false
    localForecastVisibility.getRange().then((saved) => {
      if (cancelled) return
      const start =
        saved?.start && PAST_MONTHS.includes(saved.start) ? saved.start : DEFAULT_RANGE.start
      const end = saved?.end && ALL_MONTHS.includes(saved.end) ? saved.end : DEFAULT_RANGE.end
      setRangeState(start <= end ? { start, end } : DEFAULT_RANGE)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const dataMonths = useMemo(() => monthsBetween(range.start, range.end), [range])
  // forecastMonth is computed dynamically after rows are loaded (see below)

  const updateRange = useCallback((patch) => {
    setRangeState((r) => {
      let next = { ...r, ...patch }
      if (next.start > next.end) {
        next = 'start' in patch ? { ...next, end: next.start } : { ...next, start: next.end }
      }
      localForecastVisibility.setRange(next.start, next.end)
      return next
    })
  }, [])

  // Expense rows — resolved live against General Expenses (see loadLinkedRows)
  const [rows, setRows] = useState([])

  // Reload whenever HR changes the actual-data range.
  React.useEffect(() => {
    let cancelled = false
    loadLinkedRows(dataMonths).then((r) => {
      if (!cancelled) setRows(r)
    })
    return () => {
      cancelled = true
    }
  }, [dataMonths])

  const [hrRevenues, setHrRevenues] = useState([
    { id: 'rev_1', label: 'Internship', amount: 0 },
    { id: 'rev_2', label: 'Training', amount: 0 },
    { id: 'rev_3', label: 'Recruitment', amount: 0 },
    { id: 'rev_4', label: 'Hall Rent', amount: 0 },
  ])

  React.useEffect(() => {
    let active = true
    Promise.all([
      localRecruitments.list({ activity_type: 'recruitment' }),
      localRecruitments.list({ activity_type: 'training' }),
      localInternships.list(),
    ]).then(([recruitmentItems, trainingItems, internshipItems]) => {
      if (!active) return
      const recruitmentTotal = recruitmentItems.reduce(
        (s, r) => s + (r.amount_received || 0) + (r.amount_receivable || 0),
        0,
      )
      const trainingTotal = trainingItems.reduce(
        (s, r) => s + (r.amount_received || 0) + (r.amount_receivable || 0),
        0,
      )
      const internshipTotal = internshipItems.reduce(
        (s, r) => s + (r.amount_received || 0) + (r.amount_receivable || 0),
        0,
      )
      setHrRevenues([
        { id: 'rev_1', label: 'Internship', amount: internshipTotal },
        { id: 'rev_2', label: 'Training', amount: trainingTotal },
        { id: 'rev_3', label: 'Recruitment', amount: recruitmentTotal },
        { id: 'rev_4', label: 'Hall Rent', amount: 0 },
      ])
    })
    return () => {
      active = false
    }
  }, [])

  // Modals
  const [revenueModal, setRevenueModal] = useState(false)
  const [showDetail, setShowDetail] = useState(false)

  // Rows hidden from the forecast (cards/totals/WMA) are kept out of every
  // downstream calculation below, but still passed to EditMonthModal so HR
  // can unhide them.
  const visibleRows = useMemo(() => rows.filter((r) => !r.hidden), [rows])

  // ── Core salary synthetic row — aggregated from localCoreSalaries per month ─
  const [coreMonthTotals, setCoreMonthTotals] = useState({})
  useEffect(() => {
    let cancelled = false
    Promise.all(dataMonths.map((ym) => getCoreMonthTotal(ym).then((total) => [ym, total]))).then(
      (entries) => {
        if (!cancelled) setCoreMonthTotals(Object.fromEntries(entries))
      },
    )
    return () => {
      cancelled = true
    }
  }, [dataMonths])

  const coreRow = useMemo(() => {
    const values = {}
    dataMonths.forEach((ym) => {
      values[ym] = coreMonthTotals[ym] ?? 0
    })
    return {
      id: 'core:salary',
      category: 'Core',
      vendor: 'General Expenses',
      service: 'Core Team Salary',
      frequency: 'Monthly',
      annualCommitment: 0,
      values,
      hidden: false,
      linkRef: { store: 'core' },
    }
  }, [dataMonths, coreMonthTotals])

  // Merge core row with visible expense rows for all display/forecast purposes
  const allVisibleRows = useMemo(() => [...visibleRows, coreRow], [visibleRows, coreRow])

  // Admin Expenses entries not yet shown in this tab — offered by the
  // "Add Existing Expense" picker.
  const [candidateEntries, setCandidateEntries] = useState([])
  useEffect(() => {
    let cancelled = false
    const shownEntryIds = new Set(
      rows.filter((r) => r.linkRef.store === 'admin').map((r) => r.linkRef.entryId),
    )
    localAdminExpenses.list().then((all) => {
      if (!cancelled) setCandidateEntries(all.filter((e) => !shownEntryIds.has(e.id)))
    })
    return () => {
      cancelled = true
    }
  }, [rows])

  // ── Budget cap from HR pool + revenues ──────────────────────────────────────
  const [hrPoolMonthly, setHrPoolMonthly] = useState(0)
  useEffect(() => {
    let cancelled = false
    localOrgPool
      .getActiveProjectMonthlyBudgets('hr')
      .then((budgets) => {
        if (!cancelled) setHrPoolMonthly(budgets.reduce((s, b) => s + (b.monthlyBudget || 0), 0))
      })
      .catch(() => {
        if (!cancelled) setHrPoolMonthly(0)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const hrRevenueMonthly = useMemo(
    () => hrRevenues.reduce((s, r) => s + (r.amount || 0), 0),
    [hrRevenues],
  )

  // Attendance Deduction Pool (TPC) also funds the budget:
  // budget remaining = all revenue (HR pool + HR revenue + attendance pool) − expenses.
  const [attendancePoolTotal, setAttendancePoolTotal] = useState(0)
  useEffect(() => {
    let cancelled = false
    attendanceRevenue
      .getTotalPool()
      .then(({ total }) => {
        if (!cancelled) setAttendancePoolTotal(total)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const totalBudgetCap = hrPoolMonthly + hrRevenueMonthly + attendancePoolTotal

  // ── Active data months — only months in the range that have at least one
  // row with an actual entered value (undefined = not entered, 0 = entered as ₹0).
  // This drives both the forecast target month and the WMA input so that
  // selecting Mar–Dec with data only in Mar/Apr/May forecasts June correctly.
  const activeDataMonths = useMemo(() => {
    return dataMonths.filter((m) =>
      allVisibleRows.some((r) => {
        const v = r.values[m]
        // For core row (computed totals), treat 0 as "no data" since getCoreMonthTotal
        // returns 0 when no salary entries exist for that month.
        if (r.id === 'core:salary') return v !== undefined && v !== null && v > 0
        return v !== undefined && v !== null
      }),
    )
  }, [allVisibleRows, dataMonths])

  // Forecast the month immediately after the last month with real data.
  // Falls back to range.end + 1 if no data has been entered at all.
  const forecastMonth = useMemo(() => {
    const lastData = activeDataMonths[activeDataMonths.length - 1]
    return lastData ? addMonths(lastData, 1) : addMonths(range.end, 1)
  }, [activeDataMonths, range.end])

  // ── Forecast — uses only activeDataMonths per row so blank future months in
  // the selected range don't distort the WMA. Each row is weighted by recency
  // over only its entered months (see computeForecast).
  const forecastResults = useMemo(() => {
    const fr = {}
    allVisibleRows.forEach((r) => {
      // Only pass values for months that actually have data for this specific row.
      const vals = activeDataMonths.map((m) => r.values[m])
      fr[r.id] = computeForecast(vals)
    })
    return fr
  }, [allVisibleRows, activeDataMonths])

  const forecastValues = useMemo(() => {
    const fc = {}
    Object.entries(forecastResults).forEach(([id, r]) => {
      fc[id] = r.value
    })
    return fc
  }, [forecastResults])

  // Build forecast rows for card view
  const forecastRows = useMemo(() => {
    return allVisibleRows.map((r) => ({
      ...r,
      values: { ...r.values, [forecastMonth]: forecastValues[r.id] },
    }))
  }, [allVisibleRows, forecastValues, forecastMonth])

  // ── Edit handler — writes back into the same General Expenses records ───────
  const handleSaveEdits = useCallback(
    async (monthKey, parsed) => {
      const outsourcedCat = (await localGeneralExpenses.categories.list()).find(
        (c) => c.name === 'Outsourced Services',
      )

      for (const row of rows) {
        const val = parsed[row.id]
        if (val === undefined) continue
        if (row.linkRef.store === 'admin') {
          await localAdminExpenses.setMonthlyActual(row.linkRef.entryId, monthKey, val)
        } else {
          const recordId = row.linkRef.monthIds[monthKey]
          if (recordId) {
            await localGeneralExpenses.expenses.update(recordId, {
              actual_amount: val,
              status: val > 0 ? 'Paid' : 'Pending',
            })
          } else if (outsourcedCat) {
            // This month never had a record (was blank) — create it now.
            const { year, month } = monthParts(monthKey)
            await localGeneralExpenses.expenses.create({
              category_id: outsourcedCat.id,
              expense_name: row.link.expenseName,
              month,
              year,
              frequency: row.frequency,
              planned_amount: Math.round((row.annualCommitment || 0) / 12),
              actual_amount: val,
              status: val > 0 ? 'Paid' : 'Pending',
              remarks: `Vendor: ${row.link.vendor}`,
            })
          }
        }
      }
      setRows(await loadLinkedRows(dataMonths))
    },
    [rows, dataMonths],
  )

  // ── Hide / unhide — Forecast-tab-only visibility, doesn't touch the record ──
  const handleHideRow = useCallback(
    async (rowId) => {
      await localForecastVisibility.hide(rowId)
      setRows(await loadLinkedRows(dataMonths))
    },
    [dataMonths],
  )

  const handleUnhideRow = useCallback(
    async (rowId) => {
      await localForecastVisibility.unhide(rowId)
      setRows(await loadLinkedRows(dataMonths))
    },
    [dataMonths],
  )

  // ── Add a brand-new Admin Expenses entry and show it in this tab ────────────
  const handleAddNewExpense = useCallback(
    async (data) => {
      const entry = await localAdminExpenses.create({
        vendor_name: data.vendor,
        expense_category: data.service,
        frequency: data.frequency,
        annual_amount: parseFloat(data.annual) || 0,
        group: data.group,
        status: 'Active',
      })
      const amount = parseFloat(data.amount) || 0
      if (amount > 0 && data.monthKey) {
        await localAdminExpenses.setMonthlyActual(entry.id, data.monthKey, amount)
      }
      await localForecastVisibility.include(`admin:${entry.id}`)
      setRows(await loadLinkedRows(dataMonths))
    },
    [dataMonths],
  )

  // ── Pull an existing Admin Expenses entry into this tab ─────────────────────
  const handleAddExistingExpense = useCallback(
    async (entryId) => {
      await localForecastVisibility.include(`admin:${entryId}`)
      setRows(await loadLinkedRows(dataMonths))
    },
    [dataMonths],
  )

  // ── Stats ────────────────────────────────────────────────────────────────────
  const monthTotals = useMemo(
    () =>
      dataMonths.map((m) => ({
        month: m,
        total: allVisibleRows.reduce((s, r) => s + (r.values[m] || 0), 0),
      })),
    [allVisibleRows, dataMonths],
  )

  const forecastTotal = useMemo(
    () => allVisibleRows.reduce((s, r) => s + (forecastValues[r.id] || 0), 0),
    [allVisibleRows, forecastValues],
  )

  const avgActual = useMemo(
    () => Math.round(monthTotals.reduce((s, m) => s + m.total, 0) / monthTotals.length),
    [monthTotals],
  )

  return (
    <div>
      {/* Header */}
      <div className="d-flex align-items-start justify-content-between flex-wrap gap-3 mb-4">
        <div>
          <h6 className="fw-bold mb-1">General Expenses — HR & Admin</h6>
          <div className="text-body-secondary small">
            Selected range: {monthLabel(dataMonths[0])} –{' '}
            {monthLabel(dataMonths[dataMonths.length - 1])}{' '}
            {activeDataMonths.length > 0 && activeDataMonths.length < dataMonths.length && (
              <span style={{ color: '#ffd166' }}>
                ({activeDataMonths.length} of {dataMonths.length} months have data)
              </span>
            )}{' '}
            &nbsp;·&nbsp; Forecasting{' '}
            <span style={{ color: '#06d6a0', fontWeight: 600 }}>{monthLabel(forecastMonth)}</span>{' '}
            via <span style={{ color: '#06d6a0', fontWeight: 600 }}>Weighted Moving Average</span>
          </div>
          <div
            className="text-body-secondary small mt-1"
            style={{ fontSize: '0.72rem', opacity: 0.7 }}
          >
            💡 Forecast automatically targets the next unentered month after the last one with data.
            Currently using {activeDataMonths.length} month
            {activeDataMonths.length !== 1 ? 's' : ''} of actual data.
          </div>
          <div
            className="text-body-secondary small mt-1"
            style={{ fontSize: '0.72rem', opacity: 0.7 }}
          >
            🔗 Actual values are the same records shown on General Expenses — editing a month here
            updates them there too.
          </div>
          <div
            className="text-body-secondary small mt-1"
            style={{ fontSize: '0.72rem', opacity: 0.7 }}
          >
            📊 Data is read directly from General Expenses. Update values there to recalculate the
            forecast.
          </div>
        </div>
        <div className="d-flex flex-column align-items-end gap-2">
          <div className="d-flex gap-2 flex-wrap">
            <CButton size="sm" color="info" variant="ghost" onClick={() => setRevenueModal(true)}>
              <CIcon icon={cilPlus} className="me-1" style={{ width: 13, height: 13 }} />
              HR Revenue
            </CButton>
            <CButton
              size="sm"
              color={showDetail ? 'primary' : 'secondary'}
              variant={showDetail ? 'outline' : 'ghost'}
              onClick={() => setShowDetail((v) => !v)}
            >
              <CIcon icon={cilChart} className="me-1" style={{ width: 13, height: 13 }} />
              {showDetail ? 'Hide Detail & Report' : 'Show Detail & Report'}
            </CButton>
          </div>
          {/* ── Forecast range — separate Month + Year selectors ── */}
          {(() => {
            const MONTHS_LIST = [
              { val: '01', label: 'Jan' },
              { val: '02', label: 'Feb' },
              { val: '03', label: 'Mar' },
              { val: '04', label: 'Apr' },
              { val: '05', label: 'May' },
              { val: '06', label: 'Jun' },
              { val: '07', label: 'Jul' },
              { val: '08', label: 'Aug' },
              { val: '09', label: 'Sep' },
              { val: '10', label: 'Oct' },
              { val: '11', label: 'Nov' },
              { val: '12', label: 'Dec' },
            ]
            const currentYear = new Date().getFullYear()
            const PAST_YEARS = Array.from({ length: currentYear - 2022 + 1 }, (_, i) => 2022 + i)
            const ALL_YEARS = Array.from({ length: 2029 - 2022 + 1 }, (_, i) => 2022 + i)

            const [startY, startM] = range.start.split('-')
            const [endY, endM] = range.end.split('-')

            const pickerStyle = { width: 70 }
            const yearStyle = { width: 80 }

            return (
              <div className="d-flex align-items-center gap-1 flex-wrap">
                {/* FROM */}
                <span className="text-body-secondary small me-1">From</span>
                <select
                  className="form-select form-select-sm"
                  value={startM}
                  style={pickerStyle}
                  onChange={(e) => updateRange({ start: `${startY}-${e.target.value}` })}
                >
                  {MONTHS_LIST.map((mo) => (
                    <option key={mo.val} value={mo.val}>
                      {mo.label}
                    </option>
                  ))}
                </select>
                <select
                  className="form-select form-select-sm"
                  value={startY}
                  style={yearStyle}
                  onChange={(e) => updateRange({ start: `${e.target.value}-${startM}` })}
                >
                  {PAST_YEARS.map((yr) => (
                    <option key={yr} value={String(yr)}>
                      {yr}
                    </option>
                  ))}
                </select>

                {/* TO */}
                <span className="text-body-secondary small mx-1">to</span>
                <select
                  className="form-select form-select-sm"
                  value={endM}
                  style={pickerStyle}
                  onChange={(e) => updateRange({ end: `${endY}-${e.target.value}` })}
                >
                  {MONTHS_LIST.map((mo) => (
                    <option key={mo.val} value={mo.val}>
                      {mo.label}
                    </option>
                  ))}
                </select>
                <select
                  className="form-select form-select-sm"
                  value={endY}
                  style={yearStyle}
                  onChange={(e) => updateRange({ end: `${e.target.value}-${endM}` })}
                >
                  {ALL_YEARS.map((yr) => (
                    <option key={yr} value={String(yr)}>
                      {yr}
                    </option>
                  ))}
                </select>
              </div>
            )
          })()}
        </div>
      </div>

      {/* Budget cap info strip */}
      <div
        className="rounded-3 mb-4 d-flex flex-wrap gap-3 align-items-center px-4 py-3"
        style={{
          background: 'linear-gradient(135deg,rgba(76,201,240,0.08),rgba(6,214,160,0.06))',
          border: '1px solid rgba(76,201,240,0.2)',
          fontSize: '0.82rem',
        }}
      >
        <div>
          <div
            className="text-body-secondary"
            style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}
          >
            HR Pool Budget (5% from Projects)
          </div>
          <div className="fw-bold" style={{ color: '#4cc9f0', fontSize: '1rem' }}>
            {hrPoolMonthly > 0 ? (
              fmtINR(hrPoolMonthly) + ' /mo'
            ) : (
              <span
                className="text-body-secondary"
                style={{ fontSize: '0.82rem', fontWeight: 400 }}
              >
                No active projects — set via PMS
              </span>
            )}
          </div>
        </div>
        <div style={{ color: 'var(--cui-border-color)' }}>+</div>
        <div>
          <div
            className="text-body-secondary"
            style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}
          >
            HR Revenue (Internship / Training / Hall Rent…)
          </div>
          <div className="fw-bold" style={{ color: '#06d6a0', fontSize: '1rem' }}>
            {fmtINR(hrRevenueMonthly)}{' '}
            <CButton
              size="sm"
              color="ghost"
              className="p-0 ms-1"
              style={{ fontSize: '0.7rem', verticalAlign: 'middle' }}
              onClick={() => setRevenueModal(true)}
            >
              Edit
            </CButton>
          </div>
        </div>
        <div style={{ color: 'var(--cui-border-color)' }}>+</div>
        <div>
          <div
            className="text-body-secondary"
            style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}
          >
            Attendance Pool (TPC)
          </div>
          <div className="fw-bold" style={{ color: '#4cc9f0', fontSize: '1rem' }}>
            {fmtINR(attendancePoolTotal)}
          </div>
        </div>
        <div style={{ color: 'var(--cui-border-color)' }}>=</div>
        <div>
          <div
            className="text-body-secondary"
            style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}
          >
            Total Monthly Budget Cap
          </div>
          <div className="fw-bold" style={{ fontSize: '1.1rem' }}>
            {totalBudgetCap > 0 ? (
              fmtINR(totalBudgetCap)
            ) : (
              <span className="text-body-secondary" style={{ fontWeight: 400 }}>
                —
              </span>
            )}
          </div>
        </div>
        <div className="ms-auto text-body-secondary small">
          {dataMonths.length}-month actual avg: <strong>{fmtINR(avgActual)}</strong>
        </div>
      </div>

      {/* ── Box Cards Row ───────────────────────────────────────────────────── */}
      <div className="d-flex gap-4 flex-wrap mb-5" style={{ overflowX: 'auto', paddingBottom: 4 }}>
        {dataMonths.map((m) => (
          <MonthCard
            key={m}
            monthKey={m}
            label={monthLabel(m)}
            rows={allVisibleRows}
            isForecast={false}
          />
        ))}

        {/* Divider */}
        <div
          className="d-flex align-items-center"
          style={{
            color: 'var(--cui-secondary-color)',
            fontSize: '0.75rem',
            writingMode: 'vertical-rl',
          }}
        >
          <div
            style={{ width: 1, height: 40, background: 'var(--cui-border-color)', marginBottom: 6 }}
          />
          forecast
          <div
            style={{ width: 1, height: 40, background: 'var(--cui-border-color)', marginTop: 6 }}
          />
        </div>

        {/* Forecast card */}
        <MonthCard
          monthKey={forecastMonth}
          label={monthLabel(forecastMonth)}
          rows={forecastRows}
          isForecast={true}
        />
      </div>

      {/* WMA explanation */}
      <div
        className="rounded-3 px-4 py-3 mb-4"
        style={{
          background: 'rgba(6,214,160,0.05)',
          border: '1px solid rgba(6,214,160,0.15)',
          fontSize: '0.78rem',
        }}
      >
        <div className="fw-semibold mb-1" style={{ color: '#06d6a0' }}>
          🔮 How the {monthLabel(forecastMonth)} Forecast Works
        </div>
        <div className="text-body-secondary">
          <strong>Recency-weighted average</strong> — each expense line is forecasted independently
          using only the{' '}
          <strong>
            {activeDataMonths.length} month{activeDataMonths.length !== 1 ? 's' : ''} with actual
            data
          </strong>{' '}
          ({activeDataMonths.map(monthLabel).join(', ')}), weighted 1, 2, 3…
          {activeDataMonths.length} so the most recent month carries the most influence. Months in
          the selected range with no entries are automatically excluded from the WMA to prevent
          skewing the prediction.
        </div>
        <div className="mt-2 d-flex flex-wrap gap-3">
          {activeDataMonths.map((m) => {
            const idx = dataMonths.indexOf(m)
            return (
              <div key={m} className="text-body-secondary">
                {monthLabel(m)}:{' '}
                <strong style={{ color: 'var(--cui-body-color)' }}>
                  {fmtINR(monthTotals[idx]?.total)}
                </strong>
              </div>
            )
          })}
          <div>
            → {monthLabel(forecastMonth)} Forecast:{' '}
            <strong style={{ color: '#06d6a0' }}>{fmtINR(forecastTotal)}</strong>
          </div>
        </div>
      </div>

      {/* Detail table (toggle) */}
      {showDetail && (
        <CCard className="border-0 shadow-sm">
          <CCardHeader className="py-3">
            <div className="d-flex align-items-center justify-content-between">
              <h6 className="fw-bold mb-0">Detailed Breakdown</h6>
              <div className="small text-body-secondary">Values sourced from General Expenses</div>
            </div>
          </CCardHeader>
          <CCardBody className="p-0">
            <DetailTable
              rows={allVisibleRows}
              forecastValues={forecastValues}
              forecastResults={forecastResults}
              dataMonths={dataMonths}
              forecastMonth={forecastMonth}
            />
          </CCardBody>
        </CCard>
      )}

      {/* Profit / Loss Report (toggle) */}
      {showDetail && (
        <ProfitLossReport
          rows={allVisibleRows}
          dataMonths={dataMonths}
          forecastMonth={forecastMonth}
          forecastValues={forecastValues}
          monthTotals={monthTotals}
          avgActual={avgActual}
          forecastTotal={forecastTotal}
        />
      )}

      {/* HR Revenue Modal */}
      <HRRevenueModal
        visible={revenueModal}
        revenues={hrRevenues}
        onClose={() => setRevenueModal(false)}
        onSave={setHrRevenues}
      />
    </div>
  )
}

export default GeneralExpensesTab
