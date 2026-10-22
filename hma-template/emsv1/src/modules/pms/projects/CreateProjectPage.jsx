/**
 * CreateProjectPage — Full project creation form for Project Officers.
 * Route: /pms/projects/create
 */
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CRow,
  CCol,
  CCard,
  CCardBody,
  CCardHeader,
  CForm,
  CFormLabel,
  CFormInput,
  CFormSelect,
  CFormTextarea,
  CButton,
  CSpinner,
  CToaster,
  CToast,
  CToastBody,
  CToastClose,
  CInputGroup,
  CInputGroupText,
  CProgress,
  CBadge,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilArrowLeft, cilSave, cilPlus, cilTrash } from '@coreui/icons'

import { localProjects } from '../../../services/localProjects'

const OFFICER_ID = 'po_001' // Demo: replace with auth context

const expUid = () => `einst_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`

const DEFAULT_INSTALLMENT = (idx, valuation) => ({
  _key: expUid(),
  label: `Installment ${idx + 1}`,
  percentage: '',
  start_date: '',
  end_date: '',
  // will be computed on submit
  amount: 0,
  actual_date: null,
  uc_status: 'Pending',
  admin_pct: 5,
  admin_budget: 0,
  admin_expenses: [],
})

const PERCENTAGE_COLORS = [
  '#4f9ef8',
  '#7c6af7',
  '#2ec4b6',
  '#f77c6a',
  '#f7c948',
  '#56c89a',
  '#f77cb5',
  '#a2c4f0',
  '#f7a84c',
  '#9a6af7',
]

const CreateProjectPage = () => {
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)

  const [form, setForm] = useState({
    title: '',
    phase: 'pipeline',
    funding_agency: '',
    implementing_partner: '',
    location: '',
    start_date: '',
    end_date: '',
    project_valuation: '',
    amount_sanctioned: '',
    amount_released: '',
    amount_utilized: '',
    beneficiaries_target: '',
    notes: '',
  })

  const [numInstallments, setNumInstallments] = useState(1)
  const [installments, setInstallments] = useState([DEFAULT_INSTALLMENT(0, 0)])

  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }))

  // ── Installment helpers ──────────────────────────────────────────────────────

  const setInstField = (idx, field, value) => {
    setInstallments((prev) => {
      const next = [...prev]
      next[idx] = { ...next[idx], [field]: value }
      return next
    })
  }

  const handleNumChange = (n) => {
    const count = Math.max(1, Math.min(10, Number(n) || 1))
    setNumInstallments(count)
    setInstallments((prev) => {
      if (count > prev.length) {
        const additions = Array.from({ length: count - prev.length }, (_, i) =>
          DEFAULT_INSTALLMENT(prev.length + i, 0),
        )
        return [...prev, ...additions]
      }
      return prev.slice(0, count)
    })
  }

  const pctTotal = installments.reduce((s, i) => s + (parseFloat(i.percentage) || 0), 0)
  const pctValid = Math.abs(pctTotal - 100) < 0.01
  const valuation = parseFloat(form.project_valuation) || 0

  // ── Submit ───────────────────────────────────────────────────────────────────

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!pctValid) {
      setToast({
        color: 'danger',
        message: `Installment percentages must sum to 100%. Current total: ${pctTotal.toFixed(1)}%`,
      })
      return
    }
    setSaving(true)
    try {
      const enrichedInstallments = installments.map((inst) => {
        const pct = parseFloat(inst.percentage) || 0
        const amount = valuation * (pct / 100)
        return {
          ...inst,
          percentage: pct,
          amount,
          admin_budget: amount * (inst.admin_pct / 100),
        }
      })

      const project = await localProjects.create({
        ...form,
        assigned_officer_id: OFFICER_ID,
        installments: enrichedInstallments,
      })
      setToast({ color: 'success', message: 'Project created successfully' })
      setTimeout(() => navigate(`/pms/projects/${project.id}`), 1200)
    } catch (err) {
      setToast({ color: 'danger', message: err.message || 'Failed to create project' })
      setSaving(false)
    }
  }

  return (
    <>
      {/* Page header */}
      <div className="d-flex align-items-center gap-3 mb-4">
        <CButton
          color="secondary"
          variant="ghost"
          onClick={() => navigate('/pms/projects/my-projects')}
        >
          <CIcon icon={cilArrowLeft} />
        </CButton>
        <div>
          <h4 className="mb-0 fw-semibold">Create New Project</h4>
          <div className="small text-body-secondary">Fill in the project details below</div>
        </div>
      </div>

      <CForm onSubmit={handleSubmit}>
        <CRow className="g-4">
          {/* ── Left column ─────────────────────────────────────────────────── */}
          <CCol xs={12} lg={8}>
            {/* Basic Info */}
            <CCard className="shadow-sm mb-4">
              <CCardHeader className="bg-transparent fw-semibold pt-3">
                Project Information
              </CCardHeader>
              <CCardBody>
                <div className="mb-3">
                  <CFormLabel className="fw-medium">
                    Project Title <span className="text-danger">*</span>
                  </CFormLabel>
                  <CFormInput
                    placeholder="Enter project title"
                    value={form.title}
                    onChange={(e) => setField('title', e.target.value)}
                    required
                  />
                </div>

                <div className="mb-3">
                  <CFormLabel className="fw-medium">Project Phase</CFormLabel>
                  <CFormSelect
                    value={form.phase}
                    onChange={(e) => setField('phase', e.target.value)}
                  >
                    <option value="pipeline">🔵 Pipeline</option>
                    <option value="approved">🟦 Approved</option>
                    <option value="ongoing">Ongoing</option>
                    <option value="completed">Completed</option>
                  </CFormSelect>
                </div>

                <CRow className="g-3">
                  <CCol xs={12} md={6}>
                    <CFormLabel className="fw-medium">Funding Agency</CFormLabel>
                    <CFormInput
                      placeholder="e.g. Ministry of Health"
                      value={form.funding_agency}
                      onChange={(e) => setField('funding_agency', e.target.value)}
                    />
                  </CCol>
                  <CCol xs={12} md={6}>
                    <CFormLabel className="fw-medium">Implementing Partner</CFormLabel>
                    <CFormInput
                      placeholder="e.g. HLL Lifecare Limited"
                      value={form.implementing_partner}
                      onChange={(e) => setField('implementing_partner', e.target.value)}
                    />
                  </CCol>
                </CRow>

                <CRow className="g-3 mt-1">
                  <CCol xs={12} md={6}>
                    <CFormLabel className="fw-medium">Location</CFormLabel>
                    <CFormInput
                      placeholder="District, State"
                      value={form.location}
                      onChange={(e) => setField('location', e.target.value)}
                    />
                  </CCol>
                  <CCol xs={12} md={6}>
                    <CFormLabel className="fw-medium">Total Beneficiaries (Predicted)</CFormLabel>
                    <CFormInput
                      type="number"
                      placeholder="e.g. 5000"
                      value={form.beneficiaries_target}
                      onChange={(e) =>
                        setField(
                          'beneficiaries_target',
                          e.target.value ? parseInt(e.target.value, 10) : '',
                        )
                      }
                    />
                  </CCol>
                </CRow>
              </CCardBody>
            </CCard>

            {/* Dates */}
            <CCard className="shadow-sm mb-4">
              <CCardHeader className="bg-transparent fw-semibold pt-3">Timeline</CCardHeader>
              <CCardBody>
                <CRow className="g-3">
                  <CCol xs={12} md={6}>
                    <CFormLabel className="fw-medium">Start Date</CFormLabel>
                    <CFormInput
                      type="date"
                      value={form.start_date}
                      onChange={(e) => setField('start_date', e.target.value)}
                    />
                  </CCol>
                  <CCol xs={12} md={6}>
                    <CFormLabel className="fw-medium">
                      End Date (Deadline) <span className="text-danger">*</span>
                    </CFormLabel>
                    <CFormInput
                      type="date"
                      value={form.end_date}
                      onChange={(e) => setField('end_date', e.target.value)}
                      required
                    />
                  </CCol>
                </CRow>
              </CCardBody>
            </CCard>

            {/* Financial Details */}
            <CCard className="shadow-sm mb-4">
              <CCardHeader className="bg-transparent fw-semibold pt-3">
                Financial Details
              </CCardHeader>
              <CCardBody>
                <CRow className="g-3">
                  <CCol xs={12} md={6}>
                    <CFormLabel className="fw-medium">
                      Project Valuation (₹) <span className="text-danger">*</span>
                    </CFormLabel>
                    <CInputGroup>
                      <CInputGroupText>₹</CInputGroupText>
                      <CFormInput
                        type="number"
                        min="0"
                        placeholder="0"
                        value={form.project_valuation}
                        onChange={(e) => setField('project_valuation', e.target.value)}
                        required
                      />
                    </CInputGroup>
                  </CCol>
                  <CCol xs={12} md={6}>
                    <CFormLabel className="fw-medium">Amount Sanctioned (₹)</CFormLabel>
                    <CInputGroup>
                      <CInputGroupText>₹</CInputGroupText>
                      <CFormInput
                        type="number"
                        min="0"
                        placeholder="0"
                        value={form.amount_sanctioned}
                        onChange={(e) => setField('amount_sanctioned', e.target.value)}
                      />
                    </CInputGroup>
                  </CCol>
                  <CCol xs={12} md={6}>
                    <CFormLabel className="fw-medium">Amount Released (₹)</CFormLabel>
                    <CInputGroup>
                      <CInputGroupText>₹</CInputGroupText>
                      <CFormInput
                        type="number"
                        min="0"
                        placeholder="0"
                        value={form.amount_released}
                        onChange={(e) => setField('amount_released', e.target.value)}
                      />
                    </CInputGroup>
                  </CCol>
                  <CCol xs={12} md={6}>
                    <CFormLabel className="fw-medium">Amount Utilized (₹)</CFormLabel>
                    <CInputGroup>
                      <CInputGroupText>₹</CInputGroupText>
                      <CFormInput
                        type="number"
                        min="0"
                        placeholder="0"
                        value={form.amount_utilized}
                        onChange={(e) => setField('amount_utilized', e.target.value)}
                      />
                    </CInputGroup>
                  </CCol>
                </CRow>
              </CCardBody>
            </CCard>

            {/* ── Installments ─────────────────────────────────────────────── */}
            <CCard className="shadow-sm mb-4">
              <CCardHeader className="bg-transparent pt-3 d-flex justify-content-between align-items-center">
                <span className="fw-semibold">Installments</span>
                {/* % total badge */}
                <span
                  className={`small fw-bold ${pctTotal === 0 ? 'text-body-secondary' : pctValid ? 'text-success' : 'text-danger'}`}
                >
                  Total: {pctTotal.toFixed(1)}% {pctTotal > 0 && (pctValid ? '✓' : '≠ 100%')}
                </span>
              </CCardHeader>
              <CCardBody>
                {/* Number of installments */}
                <div className="mb-4">
                  <CFormLabel className="fw-medium">Number of Installments</CFormLabel>
                  <div className="d-flex align-items-center gap-2" style={{ maxWidth: 180 }}>
                    <CButton
                      color="secondary"
                      variant="outline"
                      size="sm"
                      onClick={() => handleNumChange(numInstallments - 1)}
                      disabled={numInstallments <= 1}
                    >
                      −
                    </CButton>
                    <CFormInput
                      type="number"
                      min="1"
                      max="10"
                      className="text-center fw-bold"
                      value={numInstallments}
                      onChange={(e) => handleNumChange(e.target.value)}
                    />
                    <CButton
                      color="secondary"
                      variant="outline"
                      size="sm"
                      onClick={() => handleNumChange(numInstallments + 1)}
                      disabled={numInstallments >= 10}
                    >
                      +
                    </CButton>
                  </div>
                  <div className="small text-body-secondary mt-1">1 – 10 installments allowed</div>
                </div>

                {/* Installment rows */}
                <div className="d-flex flex-column gap-3">
                  {installments.map((inst, idx) => {
                    const pct = parseFloat(inst.percentage) || 0
                    const amt = valuation * (pct / 100)
                    const color = PERCENTAGE_COLORS[idx % PERCENTAGE_COLORS.length]
                    return (
                      <div
                        key={inst._key}
                        className="rounded border p-3"
                        style={{ borderLeft: `4px solid ${color}` }}
                      >
                        {/* Row header */}
                        <div className="d-flex align-items-center justify-content-between mb-2">
                          <span className="fw-semibold small" style={{ color }}>
                            {inst.label}
                          </span>
                          {pct > 0 && valuation > 0 && (
                            <span className="small text-body-secondary">
                              ≈ ₹{amt.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </span>
                          )}
                        </div>

                        <CRow className="g-2">
                          {/* Percentage */}
                          <CCol xs={12} md={2}>
                            <CFormLabel className="small fw-medium mb-1">
                              % Share <span className="text-danger">*</span>
                            </CFormLabel>
                            <CInputGroup size="sm">
                              <CFormInput
                                type="number"
                                min="0"
                                max="100"
                                step="0.1"
                                placeholder="0"
                                value={inst.percentage}
                                onChange={(e) => setInstField(idx, 'percentage', e.target.value)}
                              />
                              <CInputGroupText>%</CInputGroupText>
                            </CInputGroup>
                          </CCol>
                          {/* Start Date */}
                          <CCol xs={12} md={5}>
                            <CFormLabel className="small fw-medium mb-1">Start Date</CFormLabel>
                            <CFormInput
                              type="date"
                              size="sm"
                              value={inst.start_date}
                              onChange={(e) => setInstField(idx, 'start_date', e.target.value)}
                            />
                          </CCol>
                          {/* End Date (Target) */}
                          <CCol xs={12} md={5}>
                            <CFormLabel className="small fw-medium mb-1">
                              End Date (Target Release)
                            </CFormLabel>
                            <CFormInput
                              type="date"
                              size="sm"
                              value={inst.end_date}
                              onChange={(e) => setInstField(idx, 'end_date', e.target.value)}
                            />
                          </CCol>
                        </CRow>

                        {/* Overhead % row */}
                        <div className="mt-2 pt-2 border-top">
                          <div className="small text-body-secondary mb-2">
                            Overhead allocation (editable, default 5% each):
                          </div>
                          <CRow className="g-2">
                            {[{ key: 'admin_pct', label: 'Admin %', color: 'text-warning' }].map(
                              ({ key, label, color: tc }) => (
                                <CCol xs={4} key={key}>
                                  <CFormLabel className={`small fw-medium mb-1 ${tc}`}>
                                    {label}
                                  </CFormLabel>
                                  <CInputGroup size="sm">
                                    <CFormInput
                                      type="number"
                                      min="0"
                                      max="100"
                                      step="0.1"
                                      value={inst[key]}
                                      onChange={(e) =>
                                        setInstField(idx, key, parseFloat(e.target.value) || 0)
                                      }
                                    />
                                    <CInputGroupText>%</CInputGroupText>
                                  </CInputGroup>
                                  {pct > 0 && valuation > 0 && (
                                    <div className="small text-body-tertiary mt-1">
                                      ≈ ₹
                                      {(amt * (inst[key] / 100)).toLocaleString('en-IN', {
                                        maximumFractionDigits: 0,
                                      })}
                                    </div>
                                  )}
                                </CCol>
                              ),
                            )}
                          </CRow>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Progress bar showing % distribution */}
                {pctTotal > 0 && (
                  <div className="mt-4">
                    <div className="small text-body-secondary mb-1">% Distribution</div>
                    <div className="d-flex rounded overflow-hidden" style={{ height: 14 }}>
                      {installments.map((inst, idx) => {
                        const pct = parseFloat(inst.percentage) || 0
                        if (pct <= 0) return null
                        return (
                          <div
                            key={inst._key}
                            title={`${inst.label}: ${pct}%`}
                            style={{
                              width: `${(pct / Math.max(pctTotal, 1)) * 100}%`,
                              background: PERCENTAGE_COLORS[idx % PERCENTAGE_COLORS.length],
                            }}
                          />
                        )
                      })}
                      {pctTotal < 100 && (
                        <div
                          style={{ flexGrow: 1, background: 'var(--cui-border-color)' }}
                          title={`Remaining: ${(100 - pctTotal).toFixed(1)}%`}
                        />
                      )}
                    </div>
                    <div className="d-flex flex-wrap gap-2 mt-2">
                      {installments.map((inst, idx) => {
                        const pct = parseFloat(inst.percentage) || 0
                        if (pct <= 0) return null
                        return (
                          <div key={inst._key} className="d-flex align-items-center gap-1 small">
                            <span
                              style={{
                                display: 'inline-block',
                                width: 10,
                                height: 10,
                                borderRadius: 2,
                                background: PERCENTAGE_COLORS[idx % PERCENTAGE_COLORS.length],
                              }}
                            />
                            {inst.label}: {pct}%
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </CCardBody>
            </CCard>
          </CCol>

          {/* ── Right sidebar ─────────────────────────────────────────────── */}
          <CCol xs={12} lg={4}>
            <CCard className="shadow-sm sticky-top" style={{ top: '80px' }}>
              <CCardHeader className="bg-transparent fw-semibold pt-3">Summary</CCardHeader>
              <CCardBody>
                <div className="mb-3 small">
                  <div className="text-body-secondary mb-1">Title</div>
                  <div className="fw-semibold">{form.title || '—'}</div>
                </div>
                <div className="mb-3 small">
                  <div className="text-body-secondary mb-1">Phase</div>
                  <div className="fw-semibold text-capitalize">{form.phase}</div>
                </div>
                <div className="mb-3 small">
                  <div className="text-body-secondary mb-1">Location</div>
                  <div className="fw-semibold">{form.location || '—'}</div>
                </div>
                <div className="mb-3 small">
                  <div className="text-body-secondary mb-1">End Date</div>
                  <div className="fw-semibold">{form.end_date || '—'}</div>
                </div>
                <div className="mb-3 small">
                  <div className="text-body-secondary mb-1">Valuation</div>
                  <div className="fw-bold fs-5 text-primary">
                    {valuation > 0 ? `₹${valuation.toLocaleString('en-IN')}` : '—'}
                  </div>
                </div>

                {/* Installment summary */}
                {numInstallments > 0 && (
                  <div className="mb-4">
                    <div className="text-body-secondary mb-2 small fw-semibold">
                      Installments ({numInstallments})
                    </div>
                    {installments.map((inst, idx) => {
                      const pct = parseFloat(inst.percentage) || 0
                      const amt = valuation * (pct / 100)
                      return (
                        <div
                          key={inst._key}
                          className="d-flex justify-content-between align-items-center mb-2 small"
                        >
                          <div className="d-flex align-items-center gap-2">
                            <span
                              style={{
                                display: 'inline-block',
                                width: 8,
                                height: 8,
                                borderRadius: 2,
                                background: PERCENTAGE_COLORS[idx % PERCENTAGE_COLORS.length],
                              }}
                            />
                            <span>{inst.label}</span>
                          </div>
                          <div className="text-end">
                            <span className={`fw-semibold ${pct > 0 ? '' : 'text-body-tertiary'}`}>
                              {pct > 0 ? `${pct}%` : '—'}
                            </span>
                            {pct > 0 && valuation > 0 && (
                              <div className="text-body-secondary" style={{ fontSize: '0.7rem' }}>
                                ₹{amt.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}

                    {/* % validation */}
                    {pctTotal > 0 && (
                      <div
                        className={`small fw-semibold mt-2 ${pctValid ? 'text-success' : 'text-danger'}`}
                      >
                        {pctValid
                          ? 'Percentages balance to 100%'
                          : `Total ${pctTotal.toFixed(1)}% — must equal 100%`}
                      </div>
                    )}
                  </div>
                )}

                <div className="d-grid gap-2">
                  <CButton color="primary" type="submit" disabled={saving}>
                    {saving ? (
                      <>
                        <CSpinner size="sm" className="me-2" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <CIcon icon={cilSave} className="me-1" />
                        Create Project
                      </>
                    )}
                  </CButton>
                  <CButton
                    color="secondary"
                    variant="ghost"
                    onClick={() => navigate('/pms/projects/my-projects')}
                  >
                    Cancel
                  </CButton>
                </div>
              </CCardBody>
            </CCard>
          </CCol>
        </CRow>
      </CForm>

      <CToaster placement="top-end">
        {toast && (
          <CToast
            autohide
            delay={4000}
            visible
            color={toast.color}
            className="text-white"
            onClose={() => setToast(null)}
          >
            <div className="d-flex">
              <CToastBody>{toast.message}</CToastBody>
              <CToastClose className="me-2 m-auto" white />
            </div>
          </CToast>
        )}
      </CToaster>
    </>
  )
}

export default CreateProjectPage
