// src/modules/ems/expense-management/ProjectExpensesPage.jsx
import React, { useState, useEffect, useCallback } from 'react'
import PropTypes from 'prop-types'
import {
  CCard,
  CCardBody,
  CCardHeader,
  CRow,
  CCol,
  CFormSelect,
  CFormInput,
  CInputGroup,
  CInputGroupText,
  CButton,
  CAlert,
  CBadge,
  CSpinner,
  CTable,
  CTableHead,
  CTableRow,
  CTableHeaderCell,
  CTableBody,
  CTableDataCell,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilTrash, cilPlus } from '@coreui/icons'
import { usePermission } from '../../../hooks/usePermission'
import { MODULE } from '../../../constants/modules'
import useAuth from '../../../hooks/useAuth'
import { localProjects } from '../../../services/localProjects'
import { localProjectExpenses } from '../../../services/localProjectExpenses'

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n || 0)

const monthLabel = (ym) => {
  if (!ym) return '—'
  const [y, m] = ym.split('-')
  return new Date(y, m - 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
}

const POOL_LABELS = { admin: 'Admin', hr: 'HR', core: 'Core' }
const EMPTY_FORM = { pool: '', month: '', amount: '', label: '' }

const ProjectExpenseRow = ({ project, canEdit, currentUser, expanded, onToggle, onChanged }) => {
  const sentAllocations = project.sent_allocations || []
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      setEntries(await localProjectExpenses.list({ projectId: project.id }))
    } finally {
      setLoading(false)
    }
  }, [project.id])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!expanded) return
      if (!cancelled) setLoading(true)
      const rows = await localProjectExpenses.list({ projectId: project.id })
      if (cancelled) return
      setEntries(rows)
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [expanded, project.id])

  const totalActual = entries.reduce((s, e) => s + e.amount, 0)
  const totalSent = sentAllocations.reduce((s, a) => s + a.amount, 0)
  const poolTotal = (pool) =>
    entries.filter((e) => e.pool === pool).reduce((s, e) => s + e.amount, 0)
  const adminTotal = poolTotal('admin')
  const hrTotal = poolTotal('hr')
  const coreTotal = poolTotal('core')

  // Only pool+month combos the Project Officer has actually sent from PMS
  // can be logged against — same lock the table above already shows.
  const availableCombos = sentAllocations.map((a) => ({ pool: a.pool, month: a.month }))
  const monthsForPool = (pool) => availableCombos.filter((c) => c.pool === pool).map((c) => c.month)

  const handleRemove = async (id) => {
    await localProjectExpenses.remove(id)
    await reload()
    onChanged()
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.pool || !form.month || !form.amount || !form.label.trim()) {
      setError('Fill in pool, month, amount, and label.')
      return
    }
    setSaving(true)
    try {
      await localProjectExpenses.create({
        project_id: project.id,
        pool: form.pool,
        month: form.month,
        amount: form.amount,
        label: form.label,
        createdBy: currentUser,
      })
      setForm(EMPTY_FORM)
      await reload()
      onChanged()
    } catch (err) {
      setError(err.message || 'Failed to log expense')
    } finally {
      setSaving(false)
    }
  }

  return (
    <CCard className="shadow-sm mb-2">
      <CCardHeader
        className="bg-transparent fw-semibold d-flex justify-content-between align-items-center"
        role="button"
        onClick={onToggle}
      >
        <span>{project.name || project.title}</span>
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <CBadge color="warning" textColor="dark">
            Sent: {fmt(totalSent)}
          </CBadge>
          <CBadge color="info">Actual logged: {fmt(totalActual)}</CBadge>
          <CBadge color="secondary">Admin total: {fmt(adminTotal)}</CBadge>
          <CBadge color="secondary">HR total: {fmt(hrTotal)}</CBadge>
          <CBadge color="secondary">Core total: {fmt(coreTotal)}</CBadge>
          <span>{expanded ? '▲' : '▼'}</span>
        </div>
      </CCardHeader>
      {expanded && (
        <CCardBody>
          <div style={{ overflowX: 'auto' }} className="mb-3">
            <CTable bordered small align="middle" className="mb-0" style={{ fontSize: '0.75rem' }}>
              <CTableHead color="light">
                <CTableRow>
                  <CTableHeaderCell>Month</CTableHeaderCell>
                  {['admin', 'hr', 'core'].map((pool) => (
                    <CTableHeaderCell key={pool} className="text-center">
                      {POOL_LABELS[pool]}
                    </CTableHeaderCell>
                  ))}
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {(project.monthly_plan || []).map((m) => (
                  <CTableRow key={m.month}>
                    <CTableDataCell className="fw-semibold">{monthLabel(m.month)}</CTableDataCell>
                    {['admin', 'hr', 'core'].map((pool) => {
                      const sent = sentAllocations.find(
                        (a) => a.pool === pool && a.month === m.month,
                      )
                      return (
                        <CTableDataCell
                          key={pool}
                          className="text-center"
                          style={
                            sent
                              ? undefined
                              : {
                                  background: 'var(--cui-tertiary-bg)',
                                  color: 'var(--cui-secondary-color)',
                                }
                          }
                        >
                          {sent ? (
                            <CBadge
                              color="success"
                              shape="rounded-pill"
                              style={{ fontSize: '0.6rem' }}
                            >
                              {fmt(sent.amount)}
                            </CBadge>
                          ) : (
                            <span className="text-body-tertiary" style={{ fontSize: '0.68rem' }}>
                              🔒 Not allowed
                            </span>
                          )}
                        </CTableDataCell>
                      )
                    })}
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          </div>

          {canEdit && (
            <CCard className="mb-3 bg-body-tertiary border-0">
              <CCardBody className="py-3">
                {error && (
                  <CAlert color="danger" className="py-2 small mb-2">
                    {error}
                  </CAlert>
                )}
                {availableCombos.length === 0 ? (
                  <div className="text-body-secondary small">
                    Nothing has been sent from PMS for this project yet — nothing can be logged
                    until the Project Officer sends a pool+month.
                  </div>
                ) : (
                  <form onSubmit={handleAdd}>
                    <CRow className="g-2 align-items-end">
                      <CCol xs={6} md={2}>
                        <label className="form-label small mb-1">Pool</label>
                        <CFormSelect
                          size="sm"
                          value={form.pool}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, pool: e.target.value, month: '' }))
                          }
                        >
                          <option value="">— Pool —</option>
                          {['admin', 'hr', 'core']
                            .filter((pool) => monthsForPool(pool).length > 0)
                            .map((pool) => (
                              <option key={pool} value={pool}>
                                {POOL_LABELS[pool]}
                              </option>
                            ))}
                        </CFormSelect>
                      </CCol>
                      <CCol xs={6} md={3}>
                        <label className="form-label small mb-1">Month</label>
                        <CFormSelect
                          size="sm"
                          value={form.month}
                          disabled={!form.pool}
                          onChange={(e) => setForm((f) => ({ ...f, month: e.target.value }))}
                        >
                          <option value="">— Month —</option>
                          {monthsForPool(form.pool).map((m) => (
                            <option key={m} value={m}>
                              {monthLabel(m)}
                            </option>
                          ))}
                        </CFormSelect>
                      </CCol>
                      <CCol xs={12} md={3}>
                        <label className="form-label small mb-1">Label</label>
                        <CFormInput
                          size="sm"
                          placeholder="e.g. Office rent"
                          value={form.label}
                          onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                        />
                      </CCol>
                      <CCol xs={8} md={2}>
                        <label className="form-label small mb-1">Amount</label>
                        <CInputGroup size="sm">
                          <CInputGroupText>₹</CInputGroupText>
                          <CFormInput
                            type="number"
                            min="0"
                            value={form.amount}
                            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                          />
                        </CInputGroup>
                      </CCol>
                      <CCol xs={4} md={2}>
                        <CButton
                          type="submit"
                          size="sm"
                          color="success"
                          className="w-100"
                          disabled={saving}
                        >
                          {saving ? (
                            <CSpinner size="sm" />
                          ) : (
                            <>
                              <CIcon icon={cilPlus} className="me-1" />
                              Log
                            </>
                          )}
                        </CButton>
                      </CCol>
                    </CRow>
                  </form>
                )}
              </CCardBody>
            </CCard>
          )}

          {loading ? (
            <div className="text-center py-3">
              <CSpinner size="sm" />
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center text-body-tertiary small py-3">
              No expenses logged yet for this project.
            </div>
          ) : (
            <CTable small align="middle" className="mb-0" style={{ fontSize: '0.8rem' }}>
              <CTableHead color="light">
                <CTableRow>
                  <CTableHeaderCell>Pool</CTableHeaderCell>
                  <CTableHeaderCell>Month</CTableHeaderCell>
                  <CTableHeaderCell>Label</CTableHeaderCell>
                  <CTableHeaderCell className="text-end">Amount</CTableHeaderCell>
                  <CTableHeaderCell>Logged by</CTableHeaderCell>
                  {canEdit && <CTableHeaderCell />}
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {entries.map((e) => (
                  <CTableRow key={e.id}>
                    <CTableDataCell>{POOL_LABELS[e.pool] || e.pool}</CTableDataCell>
                    <CTableDataCell>{monthLabel(e.month)}</CTableDataCell>
                    <CTableDataCell>{e.label}</CTableDataCell>
                    <CTableDataCell className="text-end">{fmt(e.amount)}</CTableDataCell>
                    <CTableDataCell>{e.createdBy}</CTableDataCell>
                    {canEdit && (
                      <CTableDataCell>
                        <CButton
                          color="danger"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemove(e.id)}
                        >
                          <CIcon icon={cilTrash} size="sm" />
                        </CButton>
                      </CTableDataCell>
                    )}
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          )}
        </CCardBody>
      )}
    </CCard>
  )
}

ProjectExpenseRow.propTypes = {
  project: PropTypes.object.isRequired,
  canEdit: PropTypes.bool.isRequired,
  currentUser: PropTypes.string.isRequired,
  expanded: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
  onChanged: PropTypes.func.isRequired,
}

const ProjectExpensesPage = () => {
  const canEdit = usePermission(MODULE.EXPENSE_MANAGEMENT, 'edit')
  const { user } = useAuth()
  const currentUser = user?.full_name || user?.employee_id || 'Unknown'
  const [expandedId, setExpandedId] = useState(null)
  const [refreshKey, forceRefresh] = useState(0)
  const [plannedProjects, setPlannedProjects] = useState([])

  useEffect(() => {
    let cancelled = false
    localProjects.list({ pageSize: 1000 }).then(({ items }) => {
      if (cancelled) return
      setPlannedProjects((items || []).filter((p) => p.monthly_plan?.length > 0))
    })
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  return (
    <>
      <div className="mb-3">
        <p className="text-body-secondary small mb-0">
          Every project with a saved Monthly Plan appears here, month by month, as soon as the
          Project Officer plans it. A pool+month shows greyed out and "Not allowed" until the
          Project Officer sends it from the project's PMS Expense tab — only sent pool+months can be
          logged against.
        </p>
      </div>

      {plannedProjects.length === 0 ? (
        <div className="text-center text-body-tertiary py-5">
          No projects have a saved Monthly Plan yet. A Project Officer must plan and save a
          project's Monthly Plan before it appears here.
        </div>
      ) : (
        plannedProjects.map((project) => (
          <ProjectExpenseRow
            key={project.id}
            project={project}
            canEdit={canEdit}
            currentUser={currentUser}
            expanded={expandedId === project.id}
            onToggle={() => setExpandedId((id) => (id === project.id ? null : project.id))}
            onChanged={() => forceRefresh((k) => k + 1)}
          />
        ))
      )}
    </>
  )
}

export default ProjectExpensesPage
