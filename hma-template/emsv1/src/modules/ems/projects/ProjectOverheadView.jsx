import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  CContainer,
  CCard,
  CCardBody,
  CCardHeader,
  CRow,
  CCol,
  CButton,
  CBadge,
  CTable,
  CTableHead,
  CTableRow,
  CTableHeaderCell,
  CTableBody,
  CTableDataCell,
  CNav,
  CNavItem,
  CNavLink,
  CTabContent,
  CTabPane,
  CProgress,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilArrowLeft, cilMoney, cilPeople, cilChartPie } from '@coreui/icons'
import { localProjects } from '../../../services/localProjects'
import { localOrgPool } from '../../../services/localOrgPool'

const ProjectOverheadView = () => {
  const { id } = useParams()
  const navigate = useNavigate()

  const [project, setProject] = useState(null)
  const [activeTab, setActiveTab] = useState(0)

  const [hrSummary, setHrSummary] = useState(null)
  const [coreSummary, setCoreSummary] = useState(null)

  const [hrCharges, setHrCharges] = useState([])
  const [coreCharges, setCoreCharges] = useState([])

  useEffect(() => {
    let cancelled = false
    localProjects.getById(id).then(async (p) => {
      if (cancelled || !p) return
      setProject(p)
      setHrSummary(await localOrgPool.getProjectHRBudgetSummary(id))
      setCoreSummary(await localOrgPool.getProjectCoreBudgetSummary(id))
      setHrCharges(await localOrgPool.getProjectHRCharges(id))
      setCoreCharges(await localOrgPool.getProjectCoreCharges(id))
    })
    return () => {
      cancelled = true
    }
  }, [id])

  const formatCurrency = (amt) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amt || 0)

  const formatDate = (d) =>
    d
      ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : ''

  if (!project) return <div className="p-5 text-center">Loading...</div>

  const renderSummaryCard = (title, summary, icon, color) => {
    if (!summary || !summary.isActive) {
      return (
        <CCard className="shadow-sm h-100">
          <CCardBody className="d-flex align-items-center justify-content-center text-body-tertiary">
            Not participating in {title} pool.
          </CCardBody>
        </CCard>
      )
    }

    const utilPct = summary.poolBudget > 0 ? (summary.totalCharged / summary.poolBudget) * 100 : 0

    return (
      <CCard className={`shadow-sm h-100 border-top border-4 border-top-${color}`}>
        <CCardHeader className="bg-transparent fw-semibold pt-3">
          <CIcon icon={icon} className={`me-2 text-${color}`} />
          {title} Summary
        </CCardHeader>
        <CCardBody>
          <CRow className="g-3 mb-3 text-center">
            <CCol xs={4}>
              <div className="text-body-secondary" style={{ fontSize: '0.7rem' }}>
                Monthly Pool Budget
              </div>
              <div className={`fw-bold text-${color}`}>{formatCurrency(summary.monthlyBudget)}</div>
            </CCol>
            <CCol xs={4}>
              <div className="text-body-secondary" style={{ fontSize: '0.7rem' }}>
                Total Pool Budget
              </div>
              <div className="fw-bold">{formatCurrency(summary.poolBudget)}</div>
            </CCol>
            <CCol xs={4}>
              <div className="text-body-secondary" style={{ fontSize: '0.7rem' }}>
                Charged Till Date
              </div>
              <div className="fw-bold text-danger">{formatCurrency(summary.totalCharged)}</div>
            </CCol>
          </CRow>
          <div className="d-flex justify-content-between small text-body-secondary mb-1">
            <span>Utilization</span>
            <span className="fw-medium">{utilPct.toFixed(1)}%</span>
          </div>
          <CProgress
            value={utilPct}
            color={utilPct > 90 ? 'danger' : utilPct > 70 ? 'warning' : 'success'}
            height={8}
          />
          <div className="mt-3 text-center small text-body-secondary">
            Pool Share: <strong>{summary.sharePct}%</strong> of{' '}
            {formatCurrency(summary.totalMonthlyPool)} global pool.
          </div>
        </CCardBody>
      </CCard>
    )
  }

  const renderChargesTable = (charges, poolName) => {
    if (charges.length === 0) {
      return (
        <div className="text-center py-4 text-body-tertiary small border rounded bg-light">
          No {poolName} charges assigned to this project yet.
        </div>
      )
    }

    return (
      <CTable hover align="middle" className="mb-0 border" style={{ fontSize: '0.85rem' }}>
        <CTableHead color="light">
          <CTableRow>
            <CTableHeaderCell>Date</CTableHeaderCell>
            <CTableHeaderCell>Expense Label</CTableHeaderCell>
            <CTableHeaderCell>Total Global Expense</CTableHeaderCell>
            <CTableHeaderCell>Charged to this Project</CTableHeaderCell>
          </CTableRow>
        </CTableHead>
        <CTableBody>
          {charges.map((c) => (
            <CTableRow key={c.id}>
              <CTableDataCell className="text-body-secondary">{formatDate(c.date)}</CTableDataCell>
              <CTableDataCell>
                <div className="fw-medium">{c.label}</div>
                {c.notes && <div className="text-body-tertiary small mt-1">{c.notes}</div>}
              </CTableDataCell>
              <CTableDataCell className="text-body-secondary">
                {formatCurrency(c.amount)}
              </CTableDataCell>
              <CTableDataCell className="fw-semibold text-danger">
                {formatCurrency(c.myAmount)}
              </CTableDataCell>
            </CTableRow>
          ))}
        </CTableBody>
      </CTable>
    )
  }

  return (
    <CContainer lg className="py-4">
      <div className="d-flex align-items-center gap-3 mb-4">
        <CButton
          color="secondary"
          variant="ghost"
          onClick={() => navigate('/ems/projects/overheads')}
        >
          <CIcon icon={cilArrowLeft} />
        </CButton>
        <div>
          <h4 className="fw-bold mb-0">Project Overheads: {project.title || project.name}</h4>
          <div className="text-body-secondary small mt-1">
            {project.project_code} • {project.status}
          </div>
        </div>
      </div>

      <CRow className="g-4 mb-4">
        <CCol xs={12} md={6}>
          {renderSummaryCard('HR', hrSummary, cilPeople, 'primary')}
        </CCol>
        <CCol xs={12} md={6}>
          {renderSummaryCard('Core', coreSummary, cilMoney, 'info')}
        </CCol>
      </CRow>

      <CCard className="shadow-sm">
        <CCardHeader className="bg-transparent fw-semibold pt-3">
          Detailed Expense Listing
        </CCardHeader>
        <CCardBody>
          <CNav variant="underline" className="mb-3">
            <CNavItem>
              <CNavLink active={activeTab === 0} onClick={() => setActiveTab(0)} role="button">
                HR Charges ({hrCharges.length})
              </CNavLink>
            </CNavItem>
            <CNavItem>
              <CNavLink active={activeTab === 1} onClick={() => setActiveTab(1)} role="button">
                Core Charges ({coreCharges.length})
              </CNavLink>
            </CNavItem>
          </CNav>
          <CTabContent>
            <CTabPane visible={activeTab === 0}>{renderChargesTable(hrCharges, 'HR')}</CTabPane>
            <CTabPane visible={activeTab === 1}>{renderChargesTable(coreCharges, 'Core')}</CTabPane>
          </CTabContent>
        </CCardBody>
      </CCard>
    </CContainer>
  )
}

export default ProjectOverheadView
