// src/modules/ems/reports-analysis/ReportsPage.jsx — Reports hub: one place
// to generate every report in the system. Existing reports (HR Admin/
// Expense Management, Staff & Payroll) are reused unchanged via their
// existing modals; Forecast Expense, Attendance, and Payroll are new.
import React, { useState } from 'react'
import { CCard, CCardBody, CCol, CRow } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilWallet, cilPeople, cilChartLine, cilCalendar, cilMoney } from '@coreui/icons'
import { localOrgPool } from '../../../services/localOrgPool'
import { localLsgbRevenue } from '../../../services/localLsgbRevenue'
import { localRecruitments } from '../../../services/localRecruitments'
import { localInternships } from '../../../services/localInternships'
import ExpensePoolReportModal from '../hr-pool/components/ExpensePoolReportModal'
import ConsolidatedReportModal from '../staff-payroll/components/ConsolidatedReportModal'
import ForecastReportModal from './components/ForecastReportModal'
import AttendanceReportModal from './components/AttendanceReportModal'
import PayrollReportModal from './components/PayrollReportModal'

const REPORTS = [
  {
    key: 'hrAdmin',
    icon: cilWallet,
    title: 'HR Admin / Expense Management',
    description: 'HR, Admin, and Core pool expenses — the same report as Expense Booking.',
  },
  {
    key: 'staffPayroll',
    icon: cilPeople,
    title: 'Staff & Payroll (Consolidated)',
    description: 'One row per employee across the whole company — personal, salary, attendance.',
  },
  {
    key: 'forecast',
    icon: cilChartLine,
    title: 'Forecast Expense',
    description: 'By category, by month, and variance vs baseline for a chosen date range.',
  },
  {
    key: 'attendance',
    icon: cilCalendar,
    title: 'Attendance',
    description: 'Org-wide aggregate, per-employee monthly summary, and data integrity checks.',
  },
  {
    key: 'payroll',
    icon: cilMoney,
    title: 'Payroll',
    description: 'Gross, deductions, net salary, and CTC for every active employee, by month.',
  },
]

const ReportsPage = () => {
  const [activeReport, setActiveReport] = useState(null)
  const [hrAdminPools, setHrAdminPools] = useState(null)
  const [loadingHrAdmin, setLoadingHrAdmin] = useState(false)

  const openHrAdminReport = async () => {
    setLoadingHrAdmin(true)
    try {
      const [
        hrBal,
        adminBal,
        coreBal,
        lsgb,
        lsgbUsed,
        hrRevenueUsed,
        recruitmentItems,
        trainingItems,
        internshipItems,
      ] = await Promise.all([
        localOrgPool.getPoolRevenueBalance('hr'),
        localOrgPool.getPoolRevenueBalance('admin'),
        localOrgPool.getPoolRevenueBalance('core'),
        localLsgbRevenue.get(),
        localOrgPool.getLsgbRevenueUsed(),
        localOrgPool.getHRRevenueUsed(),
        localRecruitments.list({ activity_type: 'recruitment' }),
        localRecruitments.list({ activity_type: 'training' }),
        localInternships.list(),
      ])
      const lsgbRevenueTotal = Math.max(0, (parseFloat(lsgb?.balance) || 0) - lsgbUsed)
      // Mirrors GlobalHRPoolPage.reload(): gross HR revenue (recruitment +
      // training + internship fees received) minus what's already been
      // booked against it.
      const grossHrRevenue = [...recruitmentItems, ...trainingItems, ...internshipItems].reduce(
        (s, r) => s + (r.amount_received || 0),
        0,
      )
      const hrRevenueTotal = Math.max(0, grossHrRevenue - hrRevenueUsed)

      setHrAdminPools([
        {
          key: 'hr',
          label: 'HR',
          poolFundLabel: 'Project HR 5% Pool',
          revenueRows: [
            ['Project HR 5% Pool', hrBal.remaining],
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
            ['Project 5% Admin Pool', adminBal.remaining],
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
            ['Core 5% Pool', coreBal.remaining],
            ['Admin 5% Share', adminBal.remaining],
            ['HR Revenue', hrRevenueTotal],
            ['LSGB Revenue', lsgbRevenueTotal],
          ],
          getExpenses: () => localOrgPool.getCoreExpenses(),
        },
      ])
      setActiveReport('hrAdmin')
    } finally {
      setLoadingHrAdmin(false)
    }
  }

  const openReport = (key) => {
    if (key === 'hrAdmin') {
      openHrAdminReport()
      return
    }
    setActiveReport(key)
  }

  return (
    <>
      <div className="mb-3">
        <p className="text-body-secondary small mb-0">
          Generate any report in the system from one place — HR Admin, Expense Management, Forecast
          Expense, Attendance, and Staff & Payroll.
        </p>
      </div>

      <CRow className="g-3">
        {REPORTS.map((r) => (
          <CCol xs={12} sm={6} lg={4} key={r.key}>
            <CCard
              className="h-100 border-0 shadow-sm"
              style={{ cursor: 'pointer' }}
              onClick={() => openReport(r.key)}
            >
              <CCardBody>
                <div className="d-flex align-items-center gap-2 mb-2">
                  <CIcon icon={r.icon} style={{ width: 20, height: 20 }} className="text-primary" />
                  <span className="fw-semibold">{r.title}</span>
                </div>
                <p className="small text-body-secondary mb-0">{r.description}</p>
                {r.key === 'hrAdmin' && loadingHrAdmin && (
                  <p className="small text-body-secondary mb-0 mt-1">Loading balances…</p>
                )}
              </CCardBody>
            </CCard>
          </CCol>
        ))}
      </CRow>

      {activeReport === 'hrAdmin' && hrAdminPools && (
        <ExpensePoolReportModal
          visible
          onClose={() => setActiveReport(null)}
          pools={hrAdminPools}
        />
      )}
      {activeReport === 'staffPayroll' && (
        <ConsolidatedReportModal visible filters={{}} onClose={() => setActiveReport(null)} />
      )}
      {activeReport === 'forecast' && (
        <ForecastReportModal visible onClose={() => setActiveReport(null)} />
      )}
      {activeReport === 'attendance' && (
        <AttendanceReportModal visible onClose={() => setActiveReport(null)} />
      )}
      {activeReport === 'payroll' && (
        <PayrollReportModal visible onClose={() => setActiveReport(null)} />
      )}
    </>
  )
}

export default ReportsPage
