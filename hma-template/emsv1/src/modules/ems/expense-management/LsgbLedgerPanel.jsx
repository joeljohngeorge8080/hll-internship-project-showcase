// src/modules/ems/expense-management/LsgbLedgerPanel.jsx
//
// Shared "LSGB Inflow / Outflow" box — combines every credit entered by
// Finance (lsgb_revenue_credits) with every expense booked against LSGB
// Revenue (pool_expenses tagged lsgb_revenue) into one chronological ledger
// with a running balance. Read-only; used from both the common Expense
// Management > LSGB tab and the Finance-only LSGB page, so the two never
// drift apart.
import React, { useState, useEffect, useCallback } from 'react'
import {
  CCard,
  CCardBody,
  CCardHeader,
  CBadge,
  CTable,
  CTableHead,
  CTableRow,
  CTableHeaderCell,
  CTableBody,
  CTableDataCell,
} from '@coreui/react'
import supabase from '../../../services/supabase'
import { localOrgPool } from '../../../services/localOrgPool'
import { localLsgbRevenue } from '../../../services/localLsgbRevenue'

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n || 0)

const dateLabel = (d) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const POOL_BADGE_COLOR = { hr: 'primary', admin: 'warning', core: 'danger' }

const BalanceTile = ({ label, value, accent }) => (
  <div
    className="rounded-3 p-3 h-100"
    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
  >
    <div
      className="small fw-semibold text-uppercase text-body-secondary mb-1"
      style={{ letterSpacing: '0.05em', fontSize: '0.68rem' }}
    >
      {label}
    </div>
    <div className="fw-bold" style={{ fontSize: '1.4rem', color: accent, lineHeight: 1.1 }}>
      {fmt(value)}
    </div>
  </div>
)

const LsgbLedgerPanel = () => {
  const [credits, setCredits] = useState([])
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    const [creditRows, expenseRows] = await Promise.all([
      localLsgbRevenue.listCredits(),
      localOrgPool.getLsgbRevenueExpenses(),
    ])
    setCredits(creditRows || [])
    setExpenses(expenseRows || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    reload()

    // Keeps this ledger live whether a credit is added (Finance's Add LSGB
    // Money box) or an expense is booked/edited against LSGB Revenue
    // (Book Expense modal) from elsewhere in the app while this is open.
    const channel = supabase
      .channel('lsgb-ledger-panel-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pool_expenses' }, reload)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lsgb_revenue_credits' },
        reload,
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [reload])

  const totalInflow = credits.reduce((s, c) => s + (parseFloat(c.amount) || 0), 0)
  const totalOutflow = expenses.reduce((s, e) => s + (e.lsgbAmount || 0), 0)
  const available = totalInflow - totalOutflow

  const rows = [
    ...credits.map((c) => ({
      id: `credit-${c.id}`,
      date: c.credit_date,
      kind: 'inflow',
      label: 'LSGB Money Added',
      detail: c.notes || '—',
      billNo: null,
      pool: null,
      amount: parseFloat(c.amount) || 0,
    })),
    ...expenses.map((e) => ({
      id: `expense-${e.id}`,
      date: e.date,
      kind: 'outflow',
      label: e.label || '—',
      detail: e.vendor || '',
      billNo: e.bill_no,
      pool: e.pool,
      amount: -(e.lsgbAmount || 0),
    })),
  ].sort((a, b) => (a.date || '').localeCompare(b.date || ''))

  const rowsWithRunningBalance = rows.reduce((acc, r) => {
    const prevBalance = acc.length ? acc[acc.length - 1].runningBalance : 0
    return [...acc, { ...r, runningBalance: prevBalance + r.amount }]
  }, [])

  return (
    <>
      <div className="mb-3">
        <div className="row g-3">
          <div className="col-6 col-md-4">
            <BalanceTile label="Total Inflow" value={totalInflow} accent="#06d6a0" />
          </div>
          <div className="col-6 col-md-4">
            <BalanceTile label="Total Outflow" value={totalOutflow} accent="#ffd166" />
          </div>
          <div className="col-6 col-md-4">
            <BalanceTile label="Available" value={available} accent="#4facfe" />
          </div>
        </div>
      </div>

      <CCard>
        <CCardHeader className="bg-transparent fw-semibold">
          🏛 LSGB Inflow / Outflow Ledger
        </CCardHeader>
        <CCardBody>
          <div style={{ overflowX: 'auto' }}>
            <CTable small hover align="middle" className="mb-0" style={{ fontSize: '0.82rem' }}>
              <CTableHead color="light">
                <CTableRow>
                  <CTableHeaderCell>Date</CTableHeaderCell>
                  <CTableHeaderCell>Type</CTableHeaderCell>
                  <CTableHeaderCell>Details</CTableHeaderCell>
                  <CTableHeaderCell>Bill No</CTableHeaderCell>
                  <CTableHeaderCell className="text-end">Amount</CTableHeaderCell>
                  <CTableHeaderCell className="text-end">Running Balance</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {!loading && rowsWithRunningBalance.length === 0 && (
                  <CTableRow>
                    <CTableDataCell colSpan={6} className="text-center text-body-secondary py-4">
                      No LSGB transactions yet.
                    </CTableDataCell>
                  </CTableRow>
                )}
                {rowsWithRunningBalance.map((r) => (
                  <CTableRow key={r.id}>
                    <CTableDataCell>{dateLabel(r.date)}</CTableDataCell>
                    <CTableDataCell>
                      {r.kind === 'inflow' ? (
                        <CBadge color="success">Inflow</CBadge>
                      ) : (
                        <CBadge color={POOL_BADGE_COLOR[r.pool] || 'secondary'}>
                          Outflow · {(r.pool || '').toUpperCase()}
                        </CBadge>
                      )}
                    </CTableDataCell>
                    <CTableDataCell>
                      {r.label}
                      {r.detail ? <span className="text-body-secondary"> · {r.detail}</span> : null}
                    </CTableDataCell>
                    <CTableDataCell className="small text-body-secondary">
                      {r.billNo || '—'}
                    </CTableDataCell>
                    <CTableDataCell
                      className={`text-end fw-semibold ${r.kind === 'inflow' ? 'text-success' : 'text-danger'}`}
                    >
                      {r.kind === 'inflow' ? '+' : '-'}
                      {fmt(Math.abs(r.amount))}
                    </CTableDataCell>
                    <CTableDataCell className="text-end">{fmt(r.runningBalance)}</CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          </div>
        </CCardBody>
      </CCard>
    </>
  )
}

export default LsgbLedgerPanel
