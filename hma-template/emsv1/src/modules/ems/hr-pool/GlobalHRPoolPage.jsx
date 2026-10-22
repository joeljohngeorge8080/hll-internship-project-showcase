import React, { useState, useEffect } from 'react'
import {
  CCard,
  CCardBody,
  CRow,
  CCol,
  CButton,
  CNav,
  CNavItem,
  CNavLink,
  CTabContent,
  CTabPane,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilPencil, cilCloudDownload } from '@coreui/icons'
import supabase from '../../../services/supabase'
import { localOrgPool } from '../../../services/localOrgPool'
import { localGeneralExpenses } from '../../../services/localGeneralExpenses'
import { localAdminExpenses } from '../../../services/localAdminExpenses'
import { localRecruitments } from '../../../services/localRecruitments'
import { localInternships } from '../../../services/localInternships'
import { localEmployees } from '../../../services/localEmployees'
import { localLsgbRevenue } from '../../../services/localLsgbRevenue'
import ExpensePoolCard from './ExpensePoolCard'
import ExpensePoolReportModal from './components/ExpensePoolReportModal'

// Outsourced Services + HR Operations — same two categories DivisionsSummary.jsx
// groups as "HR Expense Directly Linked to Project" (HR_CATEGORY_NAMES there).
const HR_DIVISION_CATEGORY_NAMES = new Set(['Outsourced Services', 'HR Operations'])

const fmtL = (n) => {
  if (!n && n !== 0) return '—'
  if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(2)} L`
  if (Math.abs(n) >= 1000) return `₹${(n / 1000).toFixed(1)} K`
  return `₹${Math.round(n)}`
}

const BALANCE_ZERO = { totalSent: 0, totalBooked: 0, remaining: 0 }

// ─── Balance tile — one funding source's running balance ──────────────────────
const BalanceTile = ({ label, value, accent, editable, onEdit }) => (
  <div
    className="rounded-3 p-3 h-100"
    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
  >
    <div className="d-flex align-items-center justify-content-between mb-1">
      <span
        className="small fw-semibold text-uppercase text-body-secondary"
        style={{ letterSpacing: '0.05em', fontSize: '0.68rem' }}
      >
        {label}
      </span>
      {editable && (
        <button
          type="button"
          className="btn btn-link btn-sm p-0"
          style={{ color: accent, lineHeight: 1 }}
          onClick={onEdit}
          title={`Edit ${label}`}
        >
          <CIcon icon={cilPencil} style={{ width: 12, height: 12 }} />
        </button>
      )}
    </div>
    <div className="fw-bold" style={{ fontSize: '1.4rem', color: accent, lineHeight: 1.1 }}>
      {fmtL(value)}
    </div>
  </div>
)

const currentMonth = () => new Date().toISOString().slice(0, 7)

const fmtMonthLabel = (ym) => {
  if (!ym) return ''
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

// ─── Wallet dashboard — Total Available + per-source balance tiles ────────────
const WalletDashboard = ({
  poolType,
  poolFundLabel,
  poolBalance,
  hrRevenueTotal,
  lsgbRevenueTotal,
  adminShareBalance,
}) => {
  const total =
    (poolBalance?.remaining || 0) +
    (hrRevenueTotal || 0) +
    (lsgbRevenueTotal || 0) +
    (adminShareBalance ? adminShareBalance.remaining || 0 : 0)

  // "Project share this month" — active AND allowed (remaining budget > 0),
  // summed across every project, for whichever month is picked here.
  // Independent of poolBalance.remaining above (that's the all-time
  // sent-minus-booked running balance) — see
  // getProjectShareMonthlyAvailable's doc comment for why the two figures
  // can legitimately differ.
  const [selectedMonth, setSelectedMonth] = useState(currentMonth())
  const [monthlyShareAvailable, setMonthlyShareAvailable] = useState(0)

  useEffect(() => {
    let cancelled = false
    localOrgPool.getProjectShareMonthlyAvailable(poolType, selectedMonth).then((amt) => {
      if (!cancelled) setMonthlyShareAvailable(amt)
    })
    return () => {
      cancelled = true
    }
  }, [poolType, selectedMonth])

  return (
    <CCard
      className="mb-3 shadow-sm border-0"
      style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        borderRadius: '16px',
        overflow: 'hidden',
      }}
    >
      <CCardBody className="p-4">
        <div
          className="text-white-50 small fw-semibold text-uppercase mb-1"
          style={{ letterSpacing: '0.08em' }}
        >
          Total Available
        </div>
        <div className="text-white fw-bold mb-3" style={{ fontSize: '2rem', lineHeight: 1.1 }}>
          {fmtL(total)}
        </div>
        <CRow className="g-3">
          <CCol xs={6} md={adminShareBalance ? 3 : 4}>
            <BalanceTile
              label={poolFundLabel}
              value={poolBalance?.remaining || 0}
              accent="#06d6a0"
            />
          </CCol>
          <CCol xs={6} md={adminShareBalance ? 3 : 4}>
            <BalanceTile label="HR Revenue" value={hrRevenueTotal || 0} accent="#4facfe" />
          </CCol>
          <CCol xs={6} md={adminShareBalance ? 3 : 4}>
            <BalanceTile label="LSGB Revenue" value={lsgbRevenueTotal || 0} accent="#ffd166" />
          </CCol>
          {adminShareBalance && (
            <CCol xs={6} md={3}>
              <BalanceTile
                label="Admin 5% Share"
                value={adminShareBalance.remaining || 0}
                accent="#c77dff"
              />
            </CCol>
          )}
        </CRow>

        <div
          className="rounded-3 p-3 mt-3"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
          }}
        >
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
            <span
              className="small fw-semibold text-uppercase text-white-50"
              style={{ letterSpacing: '0.05em', fontSize: '0.68rem' }}
            >
              {poolFundLabel} — this month's project share
            </span>
            <input
              type="month"
              className="form-control form-control-sm"
              style={{ maxWidth: 170 }}
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value || currentMonth())}
            />
          </div>
          <div className="fw-bold text-white" style={{ fontSize: '1.3rem', lineHeight: 1.1 }}>
            {fmtL(monthlyShareAvailable)}
          </div>
          <div className="small text-white-50 mt-1" style={{ fontSize: '0.72rem' }}>
            Sum of every project active in {fmtMonthLabel(selectedMonth)} that still has{' '}
            {poolFundLabel.toLowerCase()} budget remaining that month.
          </div>
        </div>
      </CCardBody>
    </CCard>
  )
}

const GlobalHRPoolPage = () => {
  const [activeTab, setActiveTab] = useState('hr')
  const [hrRevenueTotal, setHrRevenueTotal] = useState(0)
  const [hrRevenueBreakdown, setHrRevenueBreakdown] = useState(null)
  const [lsgbBalance, setLsgbBalance] = useState(0)
  const [lsgbUsed, setLsgbUsed] = useState(0)
  const [showReportModal, setShowReportModal] = useState(false)

  const [hrPoolBalance, setHrPoolBalance] = useState(BALANCE_ZERO)
  const [adminPoolBalance, setAdminPoolBalance] = useState(BALANCE_ZERO)
  const [corePoolBalance, setCorePoolBalance] = useState(BALANCE_ZERO)

  const [hrGeneralExpenses, setHrGeneralExpenses] = useState([])
  const [adminExpenseItems, setAdminExpenseItems] = useState([])
  const [tpcEmployees, setTpcEmployees] = useState([])
  const [coreExpenses, setCoreExpenses] = useState([])

  const lsgbRevenueTotal = Math.max(0, lsgbBalance - lsgbUsed)

  const reload = async () => {
    setHrGeneralExpenses(
      (await localGeneralExpenses.expenses.list({ page_size: 2000 })).items.filter((e) =>
        HR_DIVISION_CATEGORY_NAMES.has(e.category_name),
      ),
    )
    setAdminExpenseItems(await localAdminExpenses.list({ status: 'Active' }))
    const { items: tpcItems } = await localEmployees.list({
      status: 'Active',
      category: 'TPC',
      pageSize: 500,
    })
    setTpcEmployees(tpcItems)
    setCoreExpenses(await localOrgPool.getCoreExpenses())

    const [hrBal, adminBal, coreBal, lsgb, lsgbUsedAmt] = await Promise.all([
      localOrgPool.getPoolRevenueBalance('hr'),
      localOrgPool.getPoolRevenueBalance('admin'),
      localOrgPool.getPoolRevenueBalance('core'),
      localLsgbRevenue.get(),
      localOrgPool.getLsgbRevenueUsed(),
    ])
    setHrPoolBalance(hrBal)
    setAdminPoolBalance(adminBal)
    setCorePoolBalance(coreBal)
    setLsgbBalance(parseFloat(lsgb?.balance) || 0)
    setLsgbUsed(lsgbUsedAmt)

    try {
      const [recList, trainList, intList, hrRevenueUsed] = await Promise.all([
        localRecruitments.list({ activity_type: 'recruitment' }),
        localRecruitments.list({ activity_type: 'training' }),
        localInternships.list(),
        localOrgPool.getHRRevenueUsed(),
      ])
      const recruitmentRevenue = recList.reduce((s, r) => s + (r.amount_received || 0), 0)
      const trainingRevenue = trainList.reduce((s, r) => s + (r.amount_received || 0), 0)
      const internshipRevenue = intList.reduce((s, r) => s + (r.amount_received || 0), 0)
      const grossHrRevenue = recruitmentRevenue + trainingRevenue + internshipRevenue
      // Available = gross income minus what's already been booked against it —
      // without this, "HR Revenue" never actually decreased when spent.
      const available = Math.max(0, grossHrRevenue - hrRevenueUsed)
      setHrRevenueTotal(available)
      const breakdown =
        grossHrRevenue > 0
          ? {
              internship: Math.round((internshipRevenue / grossHrRevenue) * available * 100) / 100,
              recruitment:
                Math.round((recruitmentRevenue / grossHrRevenue) * available * 100) / 100,
              training: Math.round((trainingRevenue / grossHrRevenue) * available * 100) / 100,
            }
          : { internship: 0, recruitment: 0, training: 0 }
      setHrRevenueBreakdown(breakdown)
    } catch (err) {
      console.error('Failed to load HR pool revenues:', err)
    }
  }

  useEffect(() => {
    reload()

    // Keeps balances live across concurrent editors — without this, a second
    // user viewing this page while someone else books/edits a pool expense
    // sees a stale balance until they manually navigate away and back.
    const channel = supabase
      .channel('hr-pool-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pool_expenses' }, reload)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pool_expense_allocations' },
        reload,
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  return (
    <>
      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
        <div>
          <h4 className="mb-1 fw-bold">Expense Booking</h4>
          <p className="text-body-secondary mb-0 small">
            What's left to spend, across HR, Admin, and Core — always up to date, no monthly reset.
          </p>
        </div>
        <CButton color="secondary" variant="outline" onClick={() => setShowReportModal(true)}>
          <CIcon icon={cilCloudDownload} className="me-1" />
          Generate Report
        </CButton>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────────── */}
      <CNav variant="tabs" className="mb-0">
        <CNavItem>
          <CNavLink active={activeTab === 'hr'} onClick={() => setActiveTab('hr')} role="button">
            HR
          </CNavLink>
        </CNavItem>
        <CNavItem>
          <CNavLink
            active={activeTab === 'admin'}
            onClick={() => setActiveTab('admin')}
            role="button"
          >
            Admin
          </CNavLink>
        </CNavItem>
        <CNavItem>
          <CNavLink
            active={activeTab === 'core'}
            onClick={() => setActiveTab('core')}
            role="button"
          >
            Core
          </CNavLink>
        </CNavItem>
      </CNav>

      <CTabContent className="border border-top-0 rounded-bottom bg-body mb-4 p-3">
        {/* ── HR Tab ─────────────────────────────────────────────────────────── */}
        <CTabPane visible={activeTab === 'hr'}>
          <WalletDashboard
            poolType="hr"
            poolFundLabel="Project HR 5% Pool"
            poolBalance={hrPoolBalance}
            hrRevenueTotal={hrRevenueTotal}
            lsgbRevenueTotal={lsgbRevenueTotal}
          />
          <ExpensePoolCard
            poolType="hr"
            poolLabel="HR"
            poolFundLabel="Project HR 5% Pool"
            hrRevenueTotal={hrRevenueTotal}
            hrRevenueBreakdown={hrRevenueBreakdown}
            lsgbRevenueTotal={lsgbRevenueTotal}
            expenseDropdownItems={hrGeneralExpenses
              .filter((e, i, arr) => arr.findIndex((x) => x.expense_name === e.expense_name) === i)
              .map((e) => ({
                id: e.id,
                label: e.expense_name,
              }))}
            onPickExpense={(id) => {
              const picked = hrGeneralExpenses.find((e) => e.id === id)
              if (!picked) return null
              const amt = picked.actual_amount > 0 ? picked.actual_amount : picked.planned_amount
              const vendorMatch = /^Vendor:\s*(.+)$/i.exec(picked.remarks || '')
              return {
                label: picked.expense_name,
                amount: String(amt),
                yearly_price: amt ? String(Math.round(amt * 12 * 100) / 100) : '',
                vendor: vendorMatch ? vendorMatch[1] : undefined,
              }
            }}
            getExpenses={() => localOrgPool.getHRExpenses()}
            addExpense={(expense, enteredBy) => localOrgPool.addHRExpense(expense, enteredBy)}
            removeExpense={(id) => localOrgPool.removeHRExpense(id)}
            updateExpense={(id, patch) => localOrgPool.updateHRExpense(id, patch)}
            getPoolBalance={() => localOrgPool.getPoolRevenueBalance('hr')}
            getAdminPoolBalance={() => localOrgPool.getPoolRevenueBalance('admin')}
            getAllEmployees={() => localEmployees.list({ status: 'Active', pageSize: 1000 })}
            onExpenseChanged={reload}
          />
        </CTabPane>

        {/* ── Admin Tab ──────────────────────────────────────────────────────── */}
        <CTabPane visible={activeTab === 'admin'}>
          <WalletDashboard
            poolType="admin"
            poolFundLabel="Project 5% Admin Pool"
            poolBalance={adminPoolBalance}
            hrRevenueTotal={hrRevenueTotal}
            lsgbRevenueTotal={lsgbRevenueTotal}
          />
          <ExpensePoolCard
            poolType="admin"
            poolLabel="Admin"
            poolFundLabel="Project 5% Admin Pool"
            hrRevenueTotal={hrRevenueTotal}
            hrRevenueBreakdown={hrRevenueBreakdown}
            lsgbRevenueTotal={lsgbRevenueTotal}
            expenseDropdownItems={adminExpenseItems.map((e) => ({
              id: e.id,
              label: `${e.expense_category} — ${e.vendor_name}`,
            }))}
            onPickExpense={(id) => {
              const picked = adminExpenseItems.find((e) => e.id === id)
              if (!picked) return null
              const monthKeys = Object.keys(picked.monthly_actuals || {}).sort()
              const latestActual =
                monthKeys.length > 0 ? picked.monthly_actuals[monthKeys[monthKeys.length - 1]] : 0
              const amt =
                latestActual > 0 ? latestActual : Math.round((picked.annual_amount || 0) / 12)
              return {
                label: `${picked.expense_category} — ${picked.vendor_name}`,
                amount: String(amt),
                yearly_price: String(picked.annual_amount || ''),
                vendor: picked.vendor_name,
              }
            }}
            getExpenses={() => localOrgPool.getAdminExpenses()}
            addExpense={(expense, enteredBy) => localOrgPool.addAdminExpense(expense, enteredBy)}
            removeExpense={(id) => localOrgPool.removeAdminExpense(id)}
            updateExpense={(id, patch) => localOrgPool.updateAdminExpense(id, patch)}
            getPoolBalance={() => localOrgPool.getPoolRevenueBalance('admin')}
            getAllEmployees={() => localEmployees.list({ status: 'Active', pageSize: 1000 })}
            onExpenseChanged={reload}
          />
        </CTabPane>

        {/* ── Core Tab ───────────────────────────────────────────────────────── */}
        <CTabPane visible={activeTab === 'core'}>
          <WalletDashboard
            poolType="core"
            poolFundLabel="Core 5% Pool"
            poolBalance={corePoolBalance}
            hrRevenueTotal={hrRevenueTotal}
            lsgbRevenueTotal={lsgbRevenueTotal}
            adminShareBalance={adminPoolBalance}
          />
          <ExpensePoolCard
            poolType="core"
            poolLabel="Core"
            poolFundLabel="Core 5% Pool"
            hrRevenueTotal={hrRevenueTotal}
            hrRevenueBreakdown={hrRevenueBreakdown}
            lsgbRevenueTotal={lsgbRevenueTotal}
            getAdminPoolBalance={() => localOrgPool.getPoolRevenueBalance('admin')}
            expenseDropdownItems={[]}
            onPickExpense={() => null}
            employeeCheckboxItems={(() => {
              const existingIds = new Set(coreExpenses.map((exp) => exp.employee_id))
              return tpcEmployees
                .filter((e) => !existingIds.has(e.id))
                .map((e) => ({
                  id: e.id,
                  label: e.employee_name,
                  amount: parseFloat(e.current_salary) || 0,
                }))
            })()}
            onBulkAddEmployees={async (selected) => {
              const month = new Date().toISOString().slice(0, 7)
              for (const emp of selected) {
                const picked = tpcEmployees.find((e) => e.id === emp.id)
                if (!picked) continue
                const salary = parseFloat(picked.current_salary) || 0
                await localOrgPool.addCoreExpense(
                  {
                    label: picked.employee_name,
                    vendor: picked.employment?.department || '',
                    amount: String(salary),
                    yearly_price: salary ? String(Math.round(salary * 12 * 100) / 100) : '',
                    date: month,
                    employee_id: picked.id,
                    revenue_sources: ['project_pool'],
                    project_pool_pct: 100,
                  },
                  'global',
                )
              }
            }}
            getExpenses={() => localOrgPool.getCoreExpenses()}
            addExpense={(expense, enteredBy) => localOrgPool.addCoreExpense(expense, enteredBy)}
            removeExpense={(id) => localOrgPool.removeCoreExpense(id)}
            updateExpense={(id, patch) => localOrgPool.updateCoreExpense(id, patch)}
            getPoolBalance={() => localOrgPool.getPoolRevenueBalance('core')}
            getAllEmployees={() => localEmployees.list({ status: 'Active', pageSize: 1000 })}
            onExpenseChanged={reload}
          />
        </CTabPane>
      </CTabContent>

      <ExpensePoolReportModal
        visible={showReportModal}
        onClose={() => setShowReportModal(false)}
        pools={[
          {
            key: 'hr',
            label: 'HR',
            poolFundLabel: 'Project HR 5% Pool',
            revenueRows: [
              ['Project HR 5% Pool', hrPoolBalance.remaining],
              ['HR Revenue', hrRevenueTotal],
              ['LSGB Revenue', lsgbRevenueTotal],
            ],
            getExpenses: () => localOrgPool.getHRExpenses(),
          },
          {
            key: 'admin',
            label: 'Admin',
            poolFundLabel: 'Project 5% Admin Pool',
            revenueRows: [
              ['Project 5% Admin Pool', adminPoolBalance.remaining],
              ['HR Revenue', hrRevenueTotal],
              ['LSGB Revenue', lsgbRevenueTotal],
            ],
            getExpenses: () => localOrgPool.getAdminExpenses(),
          },
          {
            key: 'core',
            label: 'Core',
            poolFundLabel: 'Core 5% Pool',
            revenueRows: [
              ['Core 5% Pool', corePoolBalance.remaining],
              ['Admin 5% Share', adminPoolBalance.remaining],
              ['HR Revenue', hrRevenueTotal],
              ['LSGB Revenue', lsgbRevenueTotal],
            ],
            getExpenses: () => localOrgPool.getCoreExpenses(),
          },
        ]}
      />
    </>
  )
}

export default GlobalHRPoolPage
