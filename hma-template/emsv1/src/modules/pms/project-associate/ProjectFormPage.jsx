/**
 * ProjectFormPage.jsx — Create / Edit project form.
 * Routes: /pms/projects/create  &  /pms/projects/:id/edit
 */
import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  CCard,
  CCardBody,
  CCardHeader,
  CRow,
  CCol,
  CForm,
  CFormLabel,
  CFormInput,
  CFormTextarea,
  CFormSelect,
  CFormCheck,
  CButton,
  CBadge,
  CAlert,
  CToaster,
  CToast,
  CToastBody,
  CToastClose,
  CSpinner,
  CProgress,
  CInputGroup,
  CInputGroupText,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import {
  cilSave,
  cilXCircle,
  cilPeople,
  cilEnvelopeLetter,
  cilInfo,
  cilArrowLeft,
  cilPhone,
  cilPlus,
} from '@coreui/icons'
import { localProjects, localOfficers } from '../../../services/localProjects'
import { createUserAccount } from '../../../services/userAccounts'
import useAuth from '../../../hooks/useAuth'
import useRole from '../../../hooks/useRole'
import { ROLE } from '../../../constants/roles'

const calculateDuration = (start, end) => {
  if (!start || !end) return ''
  const s = new Date(start)
  const e = new Date(end)
  const diffTime = e - s
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  if (isNaN(diffDays) || diffDays < 0) return ''
  if (diffDays >= 30) {
    return `${Math.round(diffDays / 30.4)} mo`
  }
  return `${diffDays}d`
}

const calculateDaysLeft = (targetDate, ucStatus) => {
  if (ucStatus === 'Approved') return '✓ Done'
  if (!targetDate) return ''
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(targetDate)
  target.setHours(0, 0, 0, 0)
  const diffDays = Math.ceil((target - today) / (1000 * 60 * 60 * 24))
  if (isNaN(diffDays)) return ''
  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`
  if (diffDays === 0) return 'Due today'
  return `${diffDays}d left`
}

const INST_COLORS = [
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
const instUid = () => `inst_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`
const makeInst = (idx) => ({
  _key: instUid(),
  label: `Installment ${idx + 1}`,
  percentage: '',
  start_date: '',
  end_date: '',
  uc_status: 'Pending',
  uc_target_date: '',
  payment_received_date: '',
  actual_uc_submission_date: '',
  documents_checklist: [],
  // Additional UCs beyond the first — an installment can span a financial-year
  // break and need more than one Utilization Certificate (issue #138).
  extra_ucs: [],
})

const makeExtraUc = () => ({
  _key: instUid(),
  uc_status: 'Pending',
  uc_target_date: '',
  actual_uc_submission_date: '',
})

const EMPTY_FORM = {
  name: '',
  project_code: '',
  project_type: 'Other Public Health',
  description: '',
  funding_agency: '',
  implementing_partner: '',
  location: '',
  district: '',
  status: 'pipeline',
  phase: 'pipeline',
  project_value: '',
  amount_received: '',
  expense_accounted: '',
  committed_expense: '',
  start_date: '',
  end_date: '',
  beneficiaries_target: '',
  beneficiaries_completed: '',
  officer_ids: [], // multi-officer (replaces single officer_id)
  officer_id: '', // kept for backward compat / single-view
  admin_pct: 5,
  hr_pct: 5,
  core_pct: 5,
  remarks: '',
}

const formatNoteTimestamp = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const ProjectFormPage = () => {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = Boolean(id)
  const { user } = useAuth()
  const role = useRole()

  const [form, setForm] = useState(EMPTY_FORM)
  const [officers, setOfficers] = useState([])
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const [emailNotice, setEmailNotice] = useState(false)
  // A Project Officer can only edit projects they're actually assigned to —
  // the route itself (MODULE.PMS_PROJECTS) is role-gated, not per-project, so
  // this component has to enforce ownership itself for that role.
  const [accessDenied, setAccessDenied] = useState(false)

  // Invite a Project Officer who isn't in the picklist yet by email — looks
  // them up in Staff & Payroll, grants system access, and sends the SES invite.
  const [showInviteInput, setShowInviteInput] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteError, setInviteError] = useState('')
  const [inviting, setInviting] = useState(false)

  // Installments state
  const [numInstallments, setNumInstallments] = useState(1)
  const [installments, setInstallments] = useState([makeInst(0)])

  // Notes & field personnel details — persisted immediately (edit mode only,
  // since both need an existing project_id to attach to)
  const [notes, setNotes] = useState([])
  const [newNote, setNewNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [personnelDetails, setPersonnelDetails] = useState([])
  const [newPersonnel, setNewPersonnel] = useState({ name: '', age: '', phone: '' })
  const [savingPersonnel, setSavingPersonnel] = useState(false)

  const setInstField = (idx, field, value) =>
    setInstallments((prev) => {
      const next = [...prev]
      next[idx] = { ...next[idx], [field]: value }
      return next
    })

  // Additional UCs beyond the first — one installment can need more than one
  // Utilization Certificate when it spans a financial-year break (issue #138).
  const addExtraUc = (idx) =>
    setInstallments((prev) => {
      const next = [...prev]
      next[idx] = {
        ...next[idx],
        extra_ucs: [...(next[idx].extra_ucs || []), makeExtraUc()],
      }
      return next
    })

  const removeExtraUc = (idx, ucIdx) =>
    setInstallments((prev) => {
      const next = [...prev]
      next[idx] = {
        ...next[idx],
        extra_ucs: (next[idx].extra_ucs || []).filter((_, i) => i !== ucIdx),
      }
      return next
    })

  const setExtraUcField = (idx, ucIdx, field, value) =>
    setInstallments((prev) => {
      const next = [...prev]
      const extraUcs = [...(next[idx].extra_ucs || [])]
      extraUcs[ucIdx] = { ...extraUcs[ucIdx], [field]: value }
      next[idx] = { ...next[idx], extra_ucs: extraUcs }
      return next
    })

  // Installment Amount is just percentage × project value re-expressed in
  // rupees — percentage stays the one persisted source of truth (see
  // handleSubmit's enrichedInstallments). Typing into Amount back-computes
  // percentage instead of storing a second, independently-editable number
  // that could drift out of sync with it. The draft holds the raw typed
  // string while focused so the field doesn't reformat itself mid-keystroke.
  const [instAmountDraft, setInstAmountDraft] = useState({})
  const setInstAmount = (idx, value) => {
    setInstAmountDraft((prev) => ({ ...prev, [idx]: value }))
    const amt = parseFloat(value) || 0
    const pct = valuation > 0 ? (amt / valuation) * 100 : 0
    setInstField(idx, 'percentage', (Math.round(pct * 10000) / 10000).toString())
  }
  const clearInstAmountDraft = (idx) =>
    setInstAmountDraft((prev) => {
      const next = { ...prev }
      delete next[idx]
      return next
    })

  const handleNumChange = (n) => {
    const count = Math.max(1, Math.min(10, Number(n) || 1))
    setNumInstallments(count)
    setInstallments((prev) => {
      if (count > prev.length)
        return [
          ...prev,
          ...Array.from({ length: count - prev.length }, (_, i) => makeInst(prev.length + i)),
        ]
      return prev.slice(0, count)
    })
  }

  const pctTotal = installments.reduce((s, i) => s + (parseFloat(i.percentage) || 0), 0)
  const pctValid = Math.abs(pctTotal - 100) < 0.01
  const valuation = parseFloat(form.project_value) || 0

  useEffect(() => {
    let cancelled = false
    // When role=PA, only show officers from their own projects (or all active for new projects)
    localOfficers.getAvailable().then((available) => {
      if (!cancelled) setOfficers(available)
    })

    if (isEdit) {
      localProjects.getById(id).then(async (project) => {
        if (cancelled || !project) return

        if (role === ROLE.PROJECT_OFFICER) {
          const poUuid = await localProjects.resolveEmployeeUuidByCode(user?.employee_id)
          const ownsProject =
            (project.officer_ids || []).includes(poUuid) || project.officer_id === poUuid
          if (!ownsProject) {
            if (!cancelled) setAccessDenied(true)
            return
          }
        }

        setForm({
          name: project.name || '',
          project_code: project.project_code || '',
          project_type: project.project_type || 'Other Public Health',
          description: project.description || '',
          funding_agency: project.funding_agency || '',
          implementing_partner: project.implementing_partner || '',
          location: project.location || '',
          district: project.district || '',
          status: project.status || 'pipeline',
          phase: project.phase || 'pipeline',
          project_value: project.project_value || '',
          amount_received: project.amount_received || '',
          expense_accounted: project.expense_accounted || '',
          committed_expense: project.committed_expense || '',
          beneficiaries_target: project.beneficiaries_target || '',
          beneficiaries_completed: project.beneficiaries_completed || '',
          start_date: project.start_date || '',
          end_date: project.end_date || '',
          // Multi-officer: load officer_ids[], fallback to single officer_id
          officer_ids: project.officer_ids?.length
            ? project.officer_ids
            : project.officer_id
              ? [project.officer_id]
              : [],
          officer_id: project.officer_id || '',
          admin_pct: project.admin_pct ?? 5,
          hr_pct: project.hr_pct ?? 5,
          core_pct: project.core_pct ?? 5,
          remarks: project.remarks || '',
        })

        if (project.installments && project.installments.length > 0) {
          setInstallments(project.installments.map((inst, idx) => ({ ...inst, _key: instUid() })))
          setNumInstallments(project.installments.length)
        }

        setNotes(project.notes || [])
        setPersonnelDetails(project.personnel_details || [])
      })
    }
    return () => {
      cancelled = true
    }
  }, [id, isEdit, role, user?.employee_id])

  const set = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: null }))
  }

  const handleAddNote = async () => {
    if (!newNote.trim() || savingNote) return
    setSavingNote(true)
    try {
      const updated = await localProjects.addNote(id, newNote)
      setNotes(updated.notes || [])
      setNewNote('')
    } catch (err) {
      setToast({ color: 'danger', message: err.message })
    }
    setSavingNote(false)
  }

  const handleDeleteNote = async (noteId) => {
    try {
      const updated = await localProjects.deleteNote(id, noteId)
      setNotes(updated.notes || [])
    } catch (err) {
      setToast({ color: 'danger', message: err.message })
    }
  }

  const handleAddPersonnel = async () => {
    if (!newPersonnel.name.trim() && !newPersonnel.age && !newPersonnel.phone.trim()) return
    if (savingPersonnel) return
    setSavingPersonnel(true)
    try {
      const updated = await localProjects.addPersonnelDetail(id, newPersonnel)
      setPersonnelDetails(updated.personnel_details || [])
      setNewPersonnel({ name: '', age: '', phone: '' })
    } catch (err) {
      setToast({ color: 'danger', message: err.message })
    }
    setSavingPersonnel(false)
  }

  const handleDeletePersonnel = async (detailId) => {
    try {
      const updated = await localProjects.deletePersonnelDetail(id, detailId)
      setPersonnelDetails(updated.personnel_details || [])
    } catch (err) {
      setToast({ color: 'danger', message: err.message })
    }
  }

  // Toggle an officer in/out of the multi-select list
  const toggleOfficer = (officerId) => {
    setForm((prev) => {
      const ids = prev.officer_ids || []
      const next = ids.includes(officerId)
        ? ids.filter((id) => id !== officerId)
        : [...ids, officerId]
      const primary = next[0] || ''
      if (primary) setEmailNotice(true)
      else setEmailNotice(false)
      return { ...prev, officer_ids: next, officer_id: primary }
    })
  }

  // Look an email up in Staff & Payroll, grant them system access (creating
  // their login + sending the SES invite if they don't have one yet), and
  // assign them to this project. Does not create new employee records — the
  // email must already belong to someone in Staff & Payroll.
  const handleInviteOfficerByEmail = async () => {
    const email = inviteEmail.trim().toLowerCase()
    setInviteError('')
    if (!email) return
    setInviting(true)
    try {
      const candidate = await localOfficers.findByEmail(email)
      if (!candidate) {
        setInviteError(
          'No Staff & Payroll employee found with that email. Ask HR to add them first.',
        )
        return
      }
      if ((form.officer_ids || []).includes(candidate.id)) {
        setInviteError(`${candidate.name} is already assigned to this project.`)
        return
      }
      try {
        await createUserAccount({
          full_name: candidate.name,
          google_email: candidate.email || email,
          role: ROLE.PROJECT_OFFICER,
          employee_id: candidate.employee_id,
        })
      } catch (err) {
        // Already registered is fine — they keep their existing login, just no fresh invite email.
        if (err.response?.status !== 409) throw err
      }
      setOfficers((prev) => (prev.some((o) => o.id === candidate.id) ? prev : [...prev, candidate]))
      setForm((prev) => {
        const next = [...(prev.officer_ids || []), candidate.id]
        return { ...prev, officer_ids: next, officer_id: next[0] }
      })
      setEmailNotice(true)
      setInviteEmail('')
      setShowInviteInput(false)
      setToast({ color: 'success', message: `${candidate.name} granted access and assigned` })
    } catch (err) {
      setInviteError(err.response?.data?.detail || err.message || 'Failed to grant access')
    } finally {
      setInviting(false)
    }
  }

  const validate = () => {
    const e = {}
    if (!form.name.trim()) e.name = 'Project name is required'
    if (!form.project_code?.trim()) e.project_code = 'Project code is required'
    if (!form.project_value || isNaN(Number(form.project_value)))
      e.project_value = 'Enter a valid project value'
    if (!form.start_date) e.start_date = 'Start date is required'
    if (!form.location.trim()) e.location = 'Location is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (accessDenied) return
    if (!validate()) return

    setSaving(true)
    try {
      const enrichedInstallments = installments.map((inst) => {
        const pct = parseFloat(inst.percentage) || 0
        const amount = valuation * (pct / 100)
        return {
          ...inst,
          percentage: pct,
          amount,
          uc_status: inst.uc_status || 'Pending',
          actual_date: null,
        }
      })

      const officerIds = form.officer_ids || (form.officer_id ? [form.officer_id] : [])
      const primaryOfficerId = officerIds[0] || null

      const data = {
        ...form,
        project_value: Number(form.project_value),
        amount_received: Number(form.amount_received) || 0,
        expense_accounted: Number(form.expense_accounted) || 0,
        committed_expense: Number(form.committed_expense) || 0,
        beneficiaries_target: Number(form.beneficiaries_target) || 0,
        beneficiaries_completed: Number(form.beneficiaries_completed) || 0,
        admin_pct: Number(form.admin_pct) || 0,
        hr_pct: Number(form.hr_pct) || 0,
        core_pct: Number(form.core_pct) || 0,
        installments: enrichedInstallments,
        officer_ids: officerIds,
        officer_id: primaryOfficerId,
        // Default the responsible PA to whichever Associate's specialization matches this
        // project's type (only on create; edit preserves the existing/reassigned owner —
        // the Coordinator can change it from the project detail page). Falls back to the
        // creating user if no specialization match is found (e.g. created by a Coordinator).
        // A PA creating their own project always keeps themselves as owner rather than
        // being auto-matched to a different specialist — otherwise projects_select RLS
        // (PA sees only project_associate_id = self) hides the row from its own creator
        // immediately after save, surfacing as a silent "new row violates row-level
        // security policy" failure on the RETURNING clause.
        //
        // project_associate_id is a genuine employees.id UUID FK — user.employee_id is
        // the human-readable code (e.g. "PA001"), so it must be resolved via
        // resolveEmployeeUuidByCode rather than used directly, or the insert fails with
        // "invalid input syntax for type uuid".
        ...(isEdit
          ? {}
          : {
              project_associate_id:
                role === ROLE.PROJECT_ASSOCIATE
                  ? await localProjects.resolveEmployeeUuidByCode(user?.employee_id)
                  : (await localProjects.listPaEmployees()).find((pa) =>
                      localProjects.specializationMatchesProjectType(
                        pa.specialization,
                        form.project_type,
                      ),
                    )?.employee_id ||
                    (await localProjects.resolveEmployeeUuidByCode(user?.employee_id)),
            }),
      }

      let savedProject
      if (isEdit) {
        savedProject = await localProjects.update(id, data)
        // Sync the multi-officer list via the new assignOfficers API
        await localProjects.assignOfficers(id, officerIds)
        setToast({ color: 'success', message: 'Project updated successfully' })
      } else {
        savedProject = await localProjects.create(data)
        if (officerIds.length > 0) {
          await localProjects.assignOfficers(savedProject.id, officerIds)
        }
        setToast({ color: 'success', message: 'Project created successfully' })
      }

      setTimeout(() => navigate(`/pms/projects/${savedProject.id}`), 1200)
    } catch (err) {
      setToast({ color: 'danger', message: err.message })
    }
    setSaving(false)
  }

  const selectedOfficers = officers.filter((o) => (form.officer_ids || []).includes(o.id))
  const primaryOfficer = selectedOfficers[0] || null

  if (accessDenied) {
    return (
      <CAlert color="danger" className="d-flex align-items-center gap-2">
        <CIcon icon={cilXCircle} />
        <div>
          You don't have access to edit this project — it isn't assigned to you.{' '}
          <CButton
            color="link"
            className="p-0 align-baseline"
            onClick={() => navigate('/pms/projects')}
          >
            Back to Projects
          </CButton>
        </div>
      </CAlert>
    )
  }

  return (
    <>
      {/* Back + Title */}
      <div className="mb-4">
        <CButton
          color="secondary"
          variant="ghost"
          size="sm"
          className="mb-2"
          onClick={() => navigate(isEdit ? `/pms/projects/${id}` : '/pms/projects')}
        >
          <CIcon icon={cilArrowLeft} className="me-1" />
          Back
        </CButton>
        <h4 className="fw-bold mb-1">{isEdit ? 'Edit Project' : 'Create New Project'}</h4>
        <p className="text-body-secondary mb-0 small">
          {isEdit
            ? 'Update the project details and officer assignment'
            : 'Fill in the details to create a new project and assign a project officer'}
        </p>
      </div>

      <CForm onSubmit={handleSubmit} noValidate>
        <CRow className="g-4">
          {/* Left column */}
          <CCol xs={12} lg={8}>
            {/* Project Details */}
            <CCard className="border-0 shadow-sm mb-4" style={{ borderRadius: '12px' }}>
              <CCardHeader className="bg-transparent border-bottom py-3">
                <h6 className="fw-bold mb-0">Project Details</h6>
              </CCardHeader>
              <CCardBody>
                <CRow className="g-3">
                  <CCol xs={12}>
                    <CFormLabel className="fw-semibold small">
                      Project Name <span className="text-danger">*</span>
                    </CFormLabel>
                    <CFormInput
                      placeholder="e.g., Rural Water Supply Scheme — Wayanad"
                      value={form.name}
                      onChange={(e) => set('name', e.target.value)}
                      invalid={!!errors.name}
                    />
                    {errors.name && <div className="text-danger small mt-1">{errors.name}</div>}
                  </CCol>
                  <CCol xs={12} md={6}>
                    <CFormLabel className="fw-semibold small">
                      Project Code <span className="text-danger">*</span>
                    </CFormLabel>
                    <CFormInput
                      placeholder="e.g., RWS-W-001"
                      value={form.project_code || ''}
                      onChange={(e) => set('project_code', e.target.value)}
                      invalid={!!errors.project_code}
                    />
                    {errors.project_code && (
                      <div className="text-danger small mt-1">{errors.project_code}</div>
                    )}
                  </CCol>
                  <CCol xs={12} md={6}>
                    <CFormLabel className="fw-semibold small">Project Type</CFormLabel>
                    <CFormSelect
                      value={form.project_type || ''}
                      onChange={(e) => set('project_type', e.target.value)}
                    >
                      <option value="Consultancy">Consultancy</option>
                      <option value="Other Public Health">Other Public Health</option>
                      <option value="M-CUP">M-CUP</option>
                    </CFormSelect>
                  </CCol>
                  <CCol xs={12}>
                    <CFormLabel className="fw-semibold small">Description</CFormLabel>
                    <CFormTextarea
                      rows={3}
                      placeholder="Brief description of the project objectives..."
                      value={form.description}
                      onChange={(e) => set('description', e.target.value)}
                    />
                  </CCol>
                  <CCol xs={12} md={6}>
                    <CFormLabel className="fw-semibold small">Funding Agency</CFormLabel>
                    <CFormInput
                      placeholder="e.g., NABARD, MNRE, NHM..."
                      value={form.funding_agency}
                      onChange={(e) => set('funding_agency', e.target.value)}
                    />
                  </CCol>
                  <CCol xs={12} md={6}>
                    <CFormLabel className="fw-semibold small">Implementing Partner</CFormLabel>
                    <CFormInput
                      placeholder="e.g., Kudumbashree, KSEB..."
                      value={form.implementing_partner}
                      onChange={(e) => set('implementing_partner', e.target.value)}
                    />
                  </CCol>
                  <CCol xs={12} md={6}>
                    <CFormLabel className="fw-semibold small">
                      Location <span className="text-danger">*</span>
                    </CFormLabel>
                    <CFormInput
                      placeholder="e.g., Wayanad, Kerala"
                      value={form.location}
                      onChange={(e) => set('location', e.target.value)}
                      invalid={!!errors.location}
                    />
                    {errors.location && (
                      <div className="text-danger small mt-1">{errors.location}</div>
                    )}
                  </CCol>
                  <CCol xs={12} md={6}>
                    <CFormLabel className="fw-semibold small">District</CFormLabel>
                    <CFormInput
                      placeholder="e.g., Wayanad"
                      value={form.district}
                      onChange={(e) => set('district', e.target.value)}
                    />
                  </CCol>
                  <CCol xs={12} md={6}>
                    <CFormLabel className="fw-semibold small">
                      Start Date <span className="text-danger">*</span>
                    </CFormLabel>
                    <CFormInput
                      type="date"
                      value={form.start_date}
                      onChange={(e) => set('start_date', e.target.value)}
                      invalid={!!errors.start_date}
                    />
                    {errors.start_date && (
                      <div className="text-danger small mt-1">{errors.start_date}</div>
                    )}
                  </CCol>
                  <CCol xs={12} md={6}>
                    <CFormLabel className="fw-semibold small">End Date</CFormLabel>
                    <CFormInput
                      type="date"
                      value={form.end_date}
                      onChange={(e) => set('end_date', e.target.value)}
                    />
                  </CCol>
                </CRow>
              </CCardBody>
            </CCard>

            {/* Financial Details */}
            <CCard className="border-0 shadow-sm mb-4" style={{ borderRadius: '12px' }}>
              <CCardHeader className="bg-transparent border-bottom py-3">
                <h6 className="fw-bold mb-0">💰 Financial Details</h6>
              </CCardHeader>
              <CCardBody>
                <CRow className="g-3">
                  <CCol xs={12} md={6}>
                    <CFormLabel className="fw-semibold small">
                      Project Value (₹) <span className="text-danger">*</span>
                    </CFormLabel>
                    <CFormInput
                      type="number"
                      placeholder="e.g., 4500000"
                      value={form.project_value}
                      onChange={(e) => set('project_value', e.target.value)}
                      invalid={!!errors.project_value}
                    />
                    {errors.project_value && (
                      <div className="text-danger small mt-1">{errors.project_value}</div>
                    )}
                    {form.project_value && !isNaN(Number(form.project_value)) && (
                      <div className="text-body-secondary small mt-1">
                        ₹{Number(form.project_value).toLocaleString('en-IN')}
                      </div>
                    )}
                  </CCol>
                  <CCol xs={12} md={6}>
                    <CFormLabel className="fw-semibold small">Amount Received (₹)</CFormLabel>
                    <CFormInput
                      type="number"
                      placeholder="e.g., 2800000"
                      value={form.amount_received}
                      onChange={(e) => set('amount_received', e.target.value)}
                    />
                    {form.amount_received && !isNaN(Number(form.amount_received)) && (
                      <div className="text-success small mt-1">
                        ₹{Number(form.amount_received).toLocaleString('en-IN')}
                      </div>
                    )}
                  </CCol>
                  <CCol xs={12} md={6}>
                    <CFormLabel className="fw-semibold small">Expense Accounted (₹)</CFormLabel>
                    <CFormInput
                      type="number"
                      placeholder="e.g., 1950000"
                      value={form.expense_accounted}
                      onChange={(e) => set('expense_accounted', e.target.value)}
                    />
                    {form.expense_accounted && !isNaN(Number(form.expense_accounted)) && (
                      <div className="text-warning small mt-1">
                        ₹{Number(form.expense_accounted).toLocaleString('en-IN')}
                      </div>
                    )}
                  </CCol>
                  <CCol xs={12} md={6}>
                    <CFormLabel className="fw-semibold small">Committed Expense (₹)</CFormLabel>
                    <CFormInput
                      type="number"
                      placeholder="e.g., 380000"
                      value={form.committed_expense}
                      onChange={(e) => set('committed_expense', e.target.value)}
                    />
                    {form.committed_expense && !isNaN(Number(form.committed_expense)) && (
                      <div className="text-body-secondary small mt-1">
                        ₹{Number(form.committed_expense).toLocaleString('en-IN')}
                      </div>
                    )}
                  </CCol>
                  {/* Live fund balance preview */}
                  {form.project_value && (
                    <CCol xs={12}>
                      {(() => {
                        const pv = Number(form.project_value) || 0
                        const ea = Number(form.expense_accounted) || 0
                        const ce = Number(form.committed_expense) || 0
                        const balance1 = pv - ea - ce
                        const balance2 = pv - ea
                        return (
                          <div className="d-flex flex-column gap-3">
                            <div
                              className="rounded-3 p-3"
                              style={{
                                background:
                                  balance1 >= 0 ? 'rgba(6,214,160,0.08)' : 'rgba(231,76,60,0.08)',
                                border: `1.5px solid ${balance1 >= 0 ? '#06d6a044' : '#e74c3c44'}`,
                              }}
                            >
                              <div className="d-flex justify-content-between align-items-center">
                                <span className="small fw-semibold text-body-secondary">
                                  Fund Balance (auto-computed)
                                </span>
                                <span
                                  className="fw-bold fs-6"
                                  style={{ color: balance1 >= 0 ? '#06d6a0' : '#e74c3c' }}
                                >
                                  ₹{balance1.toLocaleString('en-IN')}
                                </span>
                              </div>
                              <div
                                className="text-body-secondary mt-1"
                                style={{ fontSize: '0.72rem' }}
                              >
                                Project Value − Expense Accounted − Committed Expense
                              </div>
                            </div>

                            <div
                              className="rounded-3 p-3"
                              style={{
                                background:
                                  balance2 >= 0 ? 'rgba(6,214,160,0.08)' : 'rgba(231,76,60,0.08)',
                                border: `1.5px solid ${balance2 >= 0 ? '#06d6a044' : '#e74c3c44'}`,
                              }}
                            >
                              <div className="d-flex justify-content-between align-items-center">
                                <span className="small fw-semibold text-body-secondary">
                                  Fund Balance (auto-computed)
                                </span>
                                <span
                                  className="fw-bold fs-6"
                                  style={{ color: balance2 >= 0 ? '#06d6a0' : '#e74c3c' }}
                                >
                                  ₹{balance2.toLocaleString('en-IN')}
                                </span>
                              </div>
                              <div
                                className="text-body-secondary mt-1"
                                style={{ fontSize: '0.72rem' }}
                              >
                                Project Value − Expense Accounted
                              </div>
                            </div>
                          </div>
                        )
                      })()}
                    </CCol>
                  )}
                  <CCol xs={12} md={4}>
                    <CFormLabel className="fw-semibold small">Admin Overhead (%)</CFormLabel>
                    <CFormInput
                      type="number"
                      step="0.1"
                      min="0"
                      max="5"
                      value={form.admin_pct}
                      onChange={(e) => set('admin_pct', e.target.value)}
                    />
                  </CCol>
                  <CCol xs={12} md={4}>
                    <CFormLabel className="fw-semibold small">HR Overhead (%)</CFormLabel>
                    <CFormInput
                      type="number"
                      step="0.1"
                      min="0"
                      max="5"
                      value={form.hr_pct}
                      onChange={(e) => set('hr_pct', e.target.value)}
                    />
                  </CCol>
                  <CCol xs={12} md={4}>
                    <CFormLabel className="fw-semibold small">Core Overhead (%)</CFormLabel>
                    <CFormInput
                      type="number"
                      step="0.1"
                      min="0"
                      max="5"
                      value={form.core_pct}
                      onChange={(e) => set('core_pct', e.target.value)}
                    />
                  </CCol>
                  <CCol xs={12}>
                    <div
                      className="rounded-3 p-3"
                      style={{
                        background: 'rgba(67,97,238,0.05)',
                        border: '1.5px solid rgba(67,97,238,0.18)',
                      }}
                    >
                      <div className="fw-semibold small mb-1" style={{ color: '#4361ee' }}>
                        📐 Budget Distribution Rule
                      </div>
                      <div className="small text-body-secondary">
                        Each installment received is automatically split as:
                        <ul className="mb-0 mt-1 ps-3">
                          <li>
                            <strong>HR Pool (Max 5%)</strong> — computed from total project value ÷
                            project duration months
                          </li>
                          <li>
                            <strong>Core Pool (Max 5%)</strong> — computed from total project value
                            ÷ project duration months
                          </li>
                          <li>
                            <strong>Admin Overhead (Max 5%)</strong> — per installment; also
                            editable later from the project&apos;s Budget &amp; Payroll tab
                          </li>
                          <li>
                            <strong>Project Budget (Remaining)</strong> — designed by Project
                            Officer after receipt
                          </li>
                        </ul>
                        When project value is not set, HR &amp; Core fallback to the specified
                        percentage of each installment ÷ installment months.
                      </div>
                    </div>
                  </CCol>
                  <CCol xs={12} md={6}>
                    <CFormLabel className="fw-semibold small">
                      Total Beneficiaries (Predicted Target)
                    </CFormLabel>
                    <CFormInput
                      type="number"
                      placeholder="e.g., 5000"
                      value={form.beneficiaries_target}
                      onChange={(e) => set('beneficiaries_target', e.target.value)}
                    />
                  </CCol>
                  <CCol xs={12} md={6}>
                    <CFormLabel className="fw-semibold small">
                      Beneficiaries Completed (Till Date)
                    </CFormLabel>
                    <CFormInput
                      type="number"
                      placeholder="e.g., 1500"
                      value={form.beneficiaries_completed}
                      onChange={(e) => set('beneficiaries_completed', e.target.value)}
                    />
                  </CCol>
                </CRow>
              </CCardBody>
            </CCard>

            {/* Status & Phase */}
            <CCard className="border-0 shadow-sm" style={{ borderRadius: '12px' }}>
              <CCardHeader className="bg-transparent border-bottom py-3">
                <h6 className="fw-bold mb-0">Status & Phase</h6>
              </CCardHeader>
              <CCardBody>
                <CRow className="g-3">
                  <CCol xs={12} md={6}>
                    <CFormLabel className="fw-semibold small">Project Status</CFormLabel>
                    <CFormSelect
                      value={form.status}
                      onChange={(e) => set('status', e.target.value)}
                    >
                      <option value="pipeline">Pipeline</option>
                      <option value="approved">Approved</option>
                      <option value="ongoing">Ongoing</option>
                      <option value="completed">Completed</option>
                    </CFormSelect>
                  </CCol>
                  <CCol xs={12} md={6}>
                    <CFormLabel className="fw-semibold small">Project Phase</CFormLabel>
                    <CFormSelect value={form.phase} onChange={(e) => set('phase', e.target.value)}>
                      <option value="design_and_initiation">Design and Initiation</option>
                      <option value="implementation">Implementation</option>
                      <option value="monitoring_and_evaluation">Monitoring and Evaluation</option>
                    </CFormSelect>
                  </CCol>
                  <CCol xs={12}>
                    <CFormLabel className="fw-semibold small">Remarks</CFormLabel>
                    <CFormTextarea
                      rows={2}
                      placeholder="Any additional remarks about this project..."
                      value={form.remarks}
                      onChange={(e) => set('remarks', e.target.value)}
                    />
                  </CCol>
                </CRow>
              </CCardBody>
            </CCard>

            {/* Notes */}
            {isEdit && (
              <CCard className="border-0 shadow-sm mt-4" style={{ borderRadius: '12px' }}>
                <CCardHeader className="bg-transparent border-bottom py-3">
                  <h6 className="fw-bold mb-0">📝 Notes</h6>
                  <div className="text-body-secondary small mt-1">
                    Optional. Each entry is stamped with the date and time it was added.
                  </div>
                </CCardHeader>
                <CCardBody>
                  <div className="d-flex flex-column gap-2 mb-3">
                    {notes.length === 0 && (
                      <div className="text-body-secondary small fst-italic">No notes yet.</div>
                    )}
                    {notes.map((n) => (
                      <div
                        key={n.id}
                        className="rounded-3 p-3 d-flex justify-content-between align-items-start gap-2"
                        style={{ background: 'var(--cui-tertiary-bg, #f8f9fa)' }}
                      >
                        <div>
                          <div className="small">{n.note}</div>
                          <div className="text-body-secondary" style={{ fontSize: '0.72rem' }}>
                            {formatNoteTimestamp(n.created_at)}
                          </div>
                        </div>
                        <CButton
                          color="danger"
                          variant="ghost"
                          size="sm"
                          style={{ padding: '2px 6px', lineHeight: 1 }}
                          onClick={() => handleDeleteNote(n.id)}
                        >
                          ✕
                        </CButton>
                      </div>
                    ))}
                  </div>
                  <div className="d-flex gap-2">
                    <CFormTextarea
                      rows={2}
                      placeholder="Add a note..."
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                    />
                    <CButton
                      color="primary"
                      variant="outline"
                      onClick={handleAddNote}
                      disabled={savingNote || !newNote.trim()}
                      className="flex-shrink-0"
                    >
                      Add
                    </CButton>
                  </div>
                </CCardBody>
              </CCard>
            )}

            {/* Field Personnel Details */}
            {isEdit && (
              <CCard className="border-0 shadow-sm mt-4" style={{ borderRadius: '12px' }}>
                <CCardHeader className="bg-transparent border-bottom py-3">
                  <h6 className="fw-bold mb-0">
                    <CIcon icon={cilPhone} className="me-2 text-primary" />
                    Field Personnel Details
                  </h6>
                  <div className="text-body-secondary small mt-1">
                    Optional. Record name, age, and phone number of field personnel on this project.
                  </div>
                </CCardHeader>
                <CCardBody>
                  <div className="d-flex flex-column gap-2 mb-3">
                    {personnelDetails.length === 0 && (
                      <div className="text-body-secondary small fst-italic">
                        No field personnel added yet.
                      </div>
                    )}
                    {personnelDetails.map((p) => (
                      <div
                        key={p.id}
                        className="rounded-3 p-3 d-flex justify-content-between align-items-center gap-2"
                        style={{ background: 'var(--cui-tertiary-bg, #f8f9fa)' }}
                      >
                        <div className="small">
                          <span className="fw-semibold">{p.name || 'Unnamed'}</span>
                          {p.age && <span className="text-body-secondary"> · Age {p.age}</span>}
                          {p.phone && <span className="text-body-secondary"> · {p.phone}</span>}
                        </div>
                        <CButton
                          color="danger"
                          variant="ghost"
                          size="sm"
                          style={{ padding: '2px 6px', lineHeight: 1 }}
                          onClick={() => handleDeletePersonnel(p.id)}
                        >
                          ✕
                        </CButton>
                      </div>
                    ))}
                  </div>
                  <CRow className="g-2 align-items-end">
                    <CCol xs={12} md={5}>
                      <CFormLabel className="small fw-medium mb-1">Name</CFormLabel>
                      <CFormInput
                        size="sm"
                        placeholder="e.g., Anil Kumar"
                        value={newPersonnel.name}
                        onChange={(e) => setNewPersonnel((p) => ({ ...p, name: e.target.value }))}
                      />
                    </CCol>
                    <CCol xs={6} md={2}>
                      <CFormLabel className="small fw-medium mb-1">Age</CFormLabel>
                      <CFormInput
                        size="sm"
                        type="number"
                        min="0"
                        placeholder="e.g., 32"
                        value={newPersonnel.age}
                        onChange={(e) => setNewPersonnel((p) => ({ ...p, age: e.target.value }))}
                      />
                    </CCol>
                    <CCol xs={6} md={3}>
                      <CFormLabel className="small fw-medium mb-1">Phone</CFormLabel>
                      <CFormInput
                        size="sm"
                        placeholder="e.g., 9876543210"
                        value={newPersonnel.phone}
                        onChange={(e) => setNewPersonnel((p) => ({ ...p, phone: e.target.value }))}
                      />
                    </CCol>
                    <CCol xs={12} md={2}>
                      <CButton
                        color="primary"
                        variant="outline"
                        className="w-100"
                        onClick={handleAddPersonnel}
                        disabled={savingPersonnel}
                      >
                        + Add
                      </CButton>
                    </CCol>
                  </CRow>
                </CCardBody>
              </CCard>
            )}

            {/* Installments */}
            <CCard className="border-0 shadow-sm mt-4" style={{ borderRadius: '12px' }}>
              <CCardHeader className="bg-transparent border-bottom py-3 d-flex justify-content-between align-items-center">
                <h6 className="fw-bold mb-0">📅 Installments</h6>
                <span
                  className={`small fw-bold ${pctTotal === 0 ? 'text-body-secondary' : pctValid ? 'text-success' : 'text-danger'}`}
                >
                  Total: {pctTotal.toFixed(1)}% {pctTotal > 0 && (pctValid ? '✓' : '≠ 100%')}
                </span>
              </CCardHeader>
              <CCardBody>
                <div className="mb-4">
                  <CFormLabel className="fw-semibold small">Number of Installments</CFormLabel>
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
                  <div className="small text-body-secondary mt-1">1 – 10 installments</div>
                </div>

                <div className="d-flex flex-column gap-3">
                  {installments.map((inst, idx) => {
                    const pct = parseFloat(inst.percentage) || 0
                    const amt = valuation * (pct / 100)
                    const color = INST_COLORS[idx % INST_COLORS.length]
                    return (
                      <div
                        key={inst._key}
                        className="rounded border p-3"
                        style={{ borderLeft: `4px solid ${color}` }}
                      >
                        <div className="d-flex align-items-center justify-content-between mb-2">
                          <span className="fw-semibold small" style={{ color }}>
                            {inst.label}
                          </span>
                        </div>
                        <CRow className="g-2">
                          <CCol xs={12} md={2}>
                            <CFormLabel className="small fw-medium mb-1">% Share *</CFormLabel>
                            <CInputGroup size="sm">
                              <CFormInput
                                type="number"
                                min="0"
                                max="100"
                                step="0.1"
                                placeholder="0"
                                value={inst.percentage}
                                onChange={(e) => {
                                  clearInstAmountDraft(idx)
                                  setInstField(idx, 'percentage', e.target.value)
                                }}
                              />
                              <CInputGroupText>%</CInputGroupText>
                            </CInputGroup>
                          </CCol>
                          <CCol xs={12} md={2}>
                            <CFormLabel className="small fw-medium mb-1">Amount</CFormLabel>
                            <CInputGroup size="sm">
                              <CInputGroupText>₹</CInputGroupText>
                              <CFormInput
                                type="number"
                                min="0"
                                step="1"
                                placeholder="0"
                                disabled={!valuation}
                                value={instAmountDraft[idx] ?? (amt ? Math.round(amt) : '')}
                                onChange={(e) => setInstAmount(idx, e.target.value)}
                                onBlur={() => clearInstAmountDraft(idx)}
                              />
                            </CInputGroup>
                          </CCol>
                          <CCol xs={12} md={3}>
                            <CFormLabel className="small fw-medium mb-1">
                              Payment Received Date
                            </CFormLabel>
                            <CFormInput
                              type="date"
                              size="sm"
                              value={inst.payment_received_date || ''}
                              onChange={(e) =>
                                setInstField(idx, 'payment_received_date', e.target.value)
                              }
                            />
                          </CCol>
                          <CCol xs={12} md={3}>
                            <div className="d-flex justify-content-between align-items-center mb-1">
                              <CFormLabel className="small fw-medium mb-0">Start Date</CFormLabel>
                              {inst.start_date && inst.end_date && (
                                <span
                                  className="small text-primary-emphasis fw-semibold"
                                  style={{ fontSize: '0.75rem' }}
                                >
                                  Duration: {calculateDuration(inst.start_date, inst.end_date)}
                                </span>
                              )}
                            </div>
                            <CFormInput
                              type="date"
                              size="sm"
                              value={inst.start_date}
                              onChange={(e) => setInstField(idx, 'start_date', e.target.value)}
                            />
                          </CCol>
                          <CCol xs={12} md={2}>
                            <CFormLabel className="small fw-medium mb-1">
                              End Date (Target)
                            </CFormLabel>
                            <CFormInput
                              type="date"
                              size="sm"
                              value={inst.end_date}
                              onChange={(e) => setInstField(idx, 'end_date', e.target.value)}
                            />
                          </CCol>

                          {/* UC Tracking — one row per UC. An installment can span a
                              financial-year break and need more than one Utilization
                              Certificate (a temporary UC at FY-end, plus the final one),
                              so additional UC rows can be added below the first. */}
                          <CCol xs={12} md={3}>
                            <CFormLabel className="small fw-medium mb-1">UC Status</CFormLabel>
                            <CFormInput
                              size="sm"
                              placeholder="e.g. Pending, Submitted, Approved"
                              value={inst.uc_status || ''}
                              onChange={(e) => setInstField(idx, 'uc_status', e.target.value)}
                            />
                          </CCol>
                          <CCol xs={12} md={3}>
                            <div className="d-flex justify-content-between align-items-center mb-1">
                              <CFormLabel className="small fw-medium mb-0">
                                UC Target Date
                              </CFormLabel>
                              {inst.uc_target_date && (
                                <span
                                  className="small text-danger fw-semibold"
                                  style={{ fontSize: '0.75rem' }}
                                >
                                  {calculateDaysLeft(
                                    inst.uc_target_date,
                                    inst.uc_status || 'Pending',
                                  )}
                                </span>
                              )}
                            </div>
                            <CFormInput
                              type="date"
                              size="sm"
                              value={inst.uc_target_date || ''}
                              onChange={(e) => setInstField(idx, 'uc_target_date', e.target.value)}
                            />
                          </CCol>
                          <CCol xs={12} md={3}>
                            <CFormLabel className="small fw-medium mb-1">
                              UC Submission Date
                            </CFormLabel>
                            <CFormInput
                              type="date"
                              size="sm"
                              value={inst.actual_uc_submission_date || ''}
                              onChange={(e) =>
                                setInstField(idx, 'actual_uc_submission_date', e.target.value)
                              }
                            />
                          </CCol>
                          <CCol xs={12} md={3} className="d-flex align-items-end">
                            <CButton
                              color="primary"
                              variant="outline"
                              size="sm"
                              title="Add another UC for this installment"
                              onClick={() => addExtraUc(idx)}
                            >
                              + Add UC
                            </CButton>
                          </CCol>

                          {/* Extra UCs beyond the first */}
                          {(inst.extra_ucs || []).map((uc, ucIdx) => (
                            <React.Fragment key={uc._key || ucIdx}>
                              <CCol xs={12} md={3}>
                                <CFormLabel className="small fw-medium mb-1">
                                  UC {ucIdx + 2} Status
                                </CFormLabel>
                                <CFormInput
                                  size="sm"
                                  placeholder="e.g. Pending, Submitted, Approved"
                                  value={uc.uc_status || ''}
                                  onChange={(e) =>
                                    setExtraUcField(idx, ucIdx, 'uc_status', e.target.value)
                                  }
                                />
                              </CCol>
                              <CCol xs={12} md={3}>
                                <CFormLabel className="small fw-medium mb-1">
                                  UC {ucIdx + 2} Target Date
                                </CFormLabel>
                                <CFormInput
                                  type="date"
                                  size="sm"
                                  value={uc.uc_target_date || ''}
                                  onChange={(e) =>
                                    setExtraUcField(idx, ucIdx, 'uc_target_date', e.target.value)
                                  }
                                />
                              </CCol>
                              <CCol xs={12} md={3}>
                                <CFormLabel className="small fw-medium mb-1">
                                  UC {ucIdx + 2} Submission Date
                                </CFormLabel>
                                <CFormInput
                                  type="date"
                                  size="sm"
                                  value={uc.actual_uc_submission_date || ''}
                                  onChange={(e) =>
                                    setExtraUcField(
                                      idx,
                                      ucIdx,
                                      'actual_uc_submission_date',
                                      e.target.value,
                                    )
                                  }
                                />
                              </CCol>
                              <CCol xs={12} md={3} className="d-flex align-items-end">
                                <CButton
                                  color="danger"
                                  variant="ghost"
                                  size="sm"
                                  title="Remove this UC"
                                  onClick={() => removeExtraUc(idx, ucIdx)}
                                >
                                  ✕ Remove
                                </CButton>
                              </CCol>
                            </React.Fragment>
                          ))}

                          {/* Documents checklist builder */}
                          <CCol xs={12}>
                            <CFormLabel className="small fw-medium mb-1">
                              📎 Documents to Submit (Checklist)
                            </CFormLabel>
                            <div className="d-flex flex-column gap-1">
                              {(inst.documents_checklist || []).map((doc, dIdx) => (
                                <div key={dIdx} className="d-flex align-items-center gap-2">
                                  <CFormCheck
                                    id={`doc-check-${idx}-${dIdx}`}
                                    checked={doc.checked || false}
                                    onChange={() => {
                                      const updated = [...(inst.documents_checklist || [])]
                                      updated[dIdx] = { ...updated[dIdx], checked: !doc.checked }
                                      setInstField(idx, 'documents_checklist', updated)
                                    }}
                                  />
                                  <span
                                    className="small text-body-secondary flex-grow-1 px-2 py-1 rounded"
                                    style={{
                                      background: doc.checked
                                        ? 'rgba(25,135,84,0.08)'
                                        : 'var(--cui-tertiary-bg, #f8f9fa)',
                                      border: doc.checked
                                        ? '1px solid rgba(25,135,84,0.3)'
                                        : '1px solid var(--cui-border-color)',
                                      textDecoration: doc.checked ? 'line-through' : 'none',
                                      transition: 'all 0.15s',
                                    }}
                                  >
                                    {doc.name}
                                  </span>
                                  <CButton
                                    color="danger"
                                    variant="ghost"
                                    size="sm"
                                    style={{ padding: '2px 6px', lineHeight: 1 }}
                                    onClick={() =>
                                      setInstField(
                                        idx,
                                        'documents_checklist',
                                        (inst.documents_checklist || []).filter(
                                          (_, i) => i !== dIdx,
                                        ),
                                      )
                                    }
                                  >
                                    ✕
                                  </CButton>
                                </div>
                              ))}
                              <div className="d-flex gap-2 mt-1">
                                <CFormInput
                                  size="sm"
                                  placeholder="e.g. Audit Report, Bills & Vouchers…"
                                  id={`doc-input-${inst._key}`}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault()
                                      const val = e.target.value.trim()
                                      if (val) {
                                        setInstField(idx, 'documents_checklist', [
                                          ...(inst.documents_checklist || []),
                                          { name: val, checked: false },
                                        ])
                                        e.target.value = ''
                                      }
                                    }
                                  }}
                                />
                                <CButton
                                  color="primary"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    const input = document.getElementById(`doc-input-${inst._key}`)
                                    const val = input?.value?.trim()
                                    if (val) {
                                      setInstField(idx, 'documents_checklist', [
                                        ...(inst.documents_checklist || []),
                                        { name: val, checked: false },
                                      ])
                                      input.value = ''
                                    }
                                  }}
                                >
                                  + Add
                                </CButton>
                              </div>
                              <div
                                className="small text-body-secondary"
                                style={{ fontSize: '0.75rem' }}
                              >
                                Type a document name and press Enter or click + Add. Check the box
                                when a document is uploaded.
                              </div>
                            </div>
                          </CCol>
                        </CRow>
                      </div>
                    )
                  })}
                </div>

                {pctTotal > 0 && (
                  <div className="mt-4">
                    <div className="small text-body-secondary mb-1">% Distribution</div>
                    <div className="d-flex rounded overflow-hidden" style={{ height: 12 }}>
                      {installments.map((inst, idx) => {
                        const p = parseFloat(inst.percentage) || 0
                        return p > 0 ? (
                          <div
                            key={inst._key}
                            style={{
                              width: `${(p / Math.max(pctTotal, 1)) * 100}%`,
                              background: INST_COLORS[idx % INST_COLORS.length],
                            }}
                            title={`${inst.label}: ${p}%`}
                          />
                        ) : null
                      })}
                      {pctTotal < 100 && (
                        <div style={{ flexGrow: 1, background: 'var(--cui-border-color)' }} />
                      )}
                    </div>
                    <div className="d-flex flex-wrap gap-2 mt-2">
                      {installments.map((inst, idx) => {
                        const p = parseFloat(inst.percentage) || 0
                        return p > 0 ? (
                          <div key={inst._key} className="d-flex align-items-center gap-1 small">
                            <span
                              style={{
                                display: 'inline-block',
                                width: 10,
                                height: 10,
                                borderRadius: 2,
                                background: INST_COLORS[idx % INST_COLORS.length],
                              }}
                            />
                            {inst.label}: {p}%
                          </div>
                        ) : null
                      })}
                    </div>
                  </div>
                )}
              </CCardBody>
            </CCard>
          </CCol>

          {/* Right column: Officer assignment */}
          <CCol xs={12} lg={4}>
            <CCard
              className="border-0 shadow-sm mb-4"
              style={{ borderRadius: '12px', border: '2px solid transparent' }}
            >
              <CCardHeader className="bg-transparent border-bottom py-3">
                <h6 className="fw-bold mb-0">
                  <CIcon icon={cilPeople} className="me-2 text-primary" />
                  Assign Project Officers
                </h6>
                <div className="text-body-secondary small mt-1">
                  Select one or more officers. The first selected becomes the primary contact.
                </div>
              </CCardHeader>
              <CCardBody>
                {officers.length === 0 ? (
                  <div className="text-body-secondary small fst-italic py-2">
                    No active Project Officers found in Staff &amp; Payroll.
                  </div>
                ) : (
                  <div className="d-flex flex-column gap-2">
                    {officers.map((o, idx) => {
                      const selected = (form.officer_ids || []).includes(o.id)
                      const isPrimary = selected && (form.officer_ids || [])[0] === o.id
                      return (
                        <div
                          key={o.id}
                          onClick={() => toggleOfficer(o.id)}
                          className="d-flex align-items-center gap-3 rounded-3 px-3 py-2"
                          style={{
                            cursor: 'pointer',
                            border: selected
                              ? '2px solid rgba(67,97,238,0.5)'
                              : '1px solid var(--cui-border-color)',
                            background: selected ? 'rgba(67,97,238,0.06)' : 'transparent',
                            transition: 'all 0.15s',
                          }}
                        >
                          <div
                            className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center fw-bold flex-shrink-0"
                            style={{
                              width: 36,
                              height: 36,
                              fontSize: '0.9rem',
                              opacity: selected ? 1 : 0.45,
                            }}
                          >
                            {o.name.charAt(0)}
                          </div>
                          <div className="flex-grow-1 min-w-0">
                            <div className="fw-semibold small text-truncate">{o.name}</div>
                            <div className="text-body-secondary" style={{ fontSize: '0.72rem' }}>
                              {o.designation}
                            </div>
                          </div>
                          {isPrimary && (
                            <CBadge
                              color="primary"
                              shape="rounded-pill"
                              style={{ fontSize: '0.6rem' }}
                            >
                              Primary
                            </CBadge>
                          )}
                          {selected && !isPrimary && (
                            <CBadge
                              color="success"
                              shape="rounded-pill"
                              style={{ fontSize: '0.6rem' }}
                            >
                              Assigned
                            </CBadge>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Invite a Project Officer by email who isn't in the picklist above */}
                <div className="mt-3">
                  {!showInviteInput ? (
                    <CButton
                      color="link"
                      size="sm"
                      className="p-0 text-decoration-none"
                      onClick={() => setShowInviteInput(true)}
                    >
                      <CIcon icon={cilPlus} className="me-1" />
                      Invite Project Officer by email
                    </CButton>
                  ) : (
                    <div>
                      <CFormLabel className="small fw-medium mb-1">
                        Staff &amp; Payroll email
                      </CFormLabel>
                      <div className="d-flex gap-2">
                        <CFormInput
                          size="sm"
                          type="email"
                          placeholder="name@hll.co.in"
                          value={inviteEmail}
                          disabled={inviting}
                          onChange={(e) => setInviteEmail(e.target.value)}
                        />
                        <CButton
                          color="primary"
                          size="sm"
                          disabled={inviting || !inviteEmail.trim()}
                          onClick={handleInviteOfficerByEmail}
                        >
                          {inviting ? <CSpinner size="sm" /> : 'Grant Access'}
                        </CButton>
                        <CButton
                          color="secondary"
                          variant="ghost"
                          size="sm"
                          disabled={inviting}
                          onClick={() => {
                            setShowInviteInput(false)
                            setInviteEmail('')
                            setInviteError('')
                          }}
                        >
                          Cancel
                        </CButton>
                      </div>
                      <div className="text-body-secondary mt-1" style={{ fontSize: '0.72rem' }}>
                        Must match an existing Staff &amp; Payroll email. Grants login access and
                        sends an invite via AWS SES.
                      </div>
                      {inviteError && (
                        <div className="text-danger mt-1" style={{ fontSize: '0.75rem' }}>
                          {inviteError}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Email notice when officers selected */}
                {selectedOfficers.length > 0 && (
                  <CAlert
                    color="info"
                    className="mt-3 py-2 px-3 mb-0 d-flex align-items-start gap-2"
                    style={{ fontSize: '0.8rem' }}
                  >
                    <CIcon icon={cilEnvelopeLetter} className="mt-1 flex-shrink-0 text-info" />
                    <div>
                      <strong>Email access will be granted</strong>
                      <br />
                      {selectedOfficers.length} officer{selectedOfficers.length > 1 ? 's' : ''} will
                      receive an invite via <strong>AWS SES</strong>.
                    </div>
                  </CAlert>
                )}
              </CCardBody>
            </CCard>

            {/* Save actions */}
            <div className="d-grid gap-2">
              <CButton
                type="submit"
                color="primary"
                size="lg"
                className="fw-semibold shadow-sm"
                disabled={saving}
              >
                {saving ? (
                  <>
                    <CSpinner size="sm" className="me-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CIcon icon={cilSave} className="me-2" />
                    {isEdit ? 'Update Project' : 'Create Project'}
                  </>
                )}
              </CButton>
              <CButton
                color="secondary"
                variant="outline"
                onClick={() => navigate(isEdit ? `/pms/projects/${id}` : '/pms/projects')}
                disabled={saving}
              >
                <CIcon icon={cilXCircle} className="me-1" />
                Cancel
              </CButton>
            </div>

            {/* Info hint */}
            <CAlert
              color="light"
              className="mt-3 py-2 px-3 border d-flex align-items-start gap-2"
              style={{ fontSize: '0.75rem' }}
            >
              <CIcon icon={cilInfo} className="mt-1 flex-shrink-0 text-body-secondary" />
              <div className="text-body-secondary">
                Project Officers will receive a login link via email and can then view &amp; edit
                their assigned projects, manage tasks, and submit procurement requests.
              </div>
            </CAlert>
          </CCol>
        </CRow>
      </CForm>

      <CToaster placement="top-end">
        {toast && (
          <CToast
            autohide
            delay={3000}
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

export default ProjectFormPage
