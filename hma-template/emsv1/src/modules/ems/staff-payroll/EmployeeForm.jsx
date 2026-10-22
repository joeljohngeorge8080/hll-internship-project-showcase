import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import {
  CAccordion,
  CAccordionBody,
  CAccordionHeader,
  CAccordionItem,
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CForm,
  CFormFeedback,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormTextarea,
  CRow,
  CSpinner,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilArrowLeft, cilPlus, cilTrash } from '@coreui/icons'

import { usePermission } from '../../../hooks/usePermission'
import { MODULE } from '../../../constants/modules'
import { localEmployees } from '../../../services/localEmployees'
import { localEmployeePhotos } from '../../../services/localEmployeePhotos'
import api from '../../../services/api'
import ProfilePhotoUpload from './components/ProfilePhotoUpload'
import { DESIGNATIONS, DEPARTMENTS } from '../../../constants/employeeConstants'

// ─── option lists ─────────────────────────────────────────────────────────────

const GENDERS = ['Male', 'Female', 'Other']
const CATEGORIES = ['Permanent', 'FTC', 'TPC']
const STATUSES = ['Active', 'Inactive', 'Resigned', 'Retired']
const MARITAL = ['Single', 'Married', 'Divorced', 'Widowed']
const BLOOD = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']
const RELATIONSHIPS = [
  'Father',
  'Mother',
  'Husband',
  'Wife',
  'Son',
  'Daughter',
  'Brother',
  'Sister',
  'Other',
]

const DEFAULT = {
  employee_id: '',
  first_name: '',
  middle_name: '',
  last_name: '',
  gender: '',
  marital_status: '',
  blood_group: '',
  date_of_birth: '',
  employee_category: '',
  status: 'Active',
  joined_date: '',
  exit_date: '',
  initial_salary: '',
  contact: { personal_email: '', working_email: '', mobile: '', phone: '', emergency_contact: '' },
  address: { resident_location: '', present_address: '', permanent_address: '', state: '' },
  employment: {
    designation: '',
    designation_text: '',
    department: '',
    department_other: '',
    reporting_to: '',
    working_region: '',
    working_state: '',
    start_date: '',
  },
  identification: {
    pan_number: '',
    aadhar_number: '',
    passport_number: '',
    uan_number: '',
    esi_number: '',
    pf_number: '',
  },
  bank_accounts: [],
  family_members: [],
}

// ─── tiny helpers ─────────────────────────────────────────────────────────────

const Req = () => <span className="text-danger ms-1">*</span>

const F = ({ label, required, error, hint, children }) => (
  <div>
    <CFormLabel className={required ? 'fw-semibold' : ''}>
      {label}
      {required && <Req />}
    </CFormLabel>
    {children}
    {error && (
      <CFormFeedback invalid className="d-block">
        {error.message}
      </CFormFeedback>
    )}
    {hint && !error && <div className="form-text text-body-secondary">{hint}</div>}
  </div>
)

// ─── EmployeeForm ─────────────────────────────────────────────────────────────

const EmployeeForm = () => {
  const { id } = useParams()
  const isEdit = Boolean(id && id !== 'new')
  const navigate = useNavigate()
  const canEdit = usePermission(MODULE.STAFF_PAYROLL, 'edit')

  const [fetching, setFetching] = useState(isEdit)
  const [fetchError, setFetchError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [photo, setPhoto] = useState(null)
  // A newly picked file pending upload — held here rather than uploaded
  // immediately because in create mode the employee's uuid (the storage
  // path prefix) doesn't exist yet until the record is saved.
  const [photoFile, setPhotoFile] = useState(null)
  const [managers, setManagers] = useState([])
  // The route param can be either the employee's uuid or their human-readable
  // employee_id (localEmployees.getById accepts both). Saves need the real
  // uuid — child tables' employee_id columns are uuid FKs — so this is set
  // from the loaded record's own `id` once fetched, and used everywhere below
  // instead of the raw route param.
  const [resolvedId, setResolvedId] = useState(id)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    control,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: DEFAULT })

  // ── dynamic arrays ──────────────────────────────────────────────────────────

  const {
    fields: bankFields,
    append: addBank,
    remove: removeBank,
  } = useFieldArray({ control, name: 'bank_accounts' })

  const {
    fields: familyFields,
    append: addFamily,
    remove: removeFamily,
  } = useFieldArray({ control, name: 'family_members' })

  const watchedStatus = watch('status')
  const watchedDept = watch('employment.department') || ''
  const watchedDeptOther = watch('employment.department_other') || ''
  const watchedFirst = watch('first_name') || ''
  const watchedLast = watch('last_name') || ''
  const isProjectDept = watchedDept === 'SDP'

  // ── load for edit mode ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!isEdit) return
    const load = async () => {
      setFetching(true)
      setFetchError('')
      try {
        let data = null
        try {
          const res = await api.get(`/employees/${id}`)
          data = res.data
        } catch {
          data = await localEmployees.getById(id)
        }
        if (!data) {
          setFetchError('Employee not found')
          return
        }
        if (data.id) setResolvedId(data.id)
        reset({
          employee_id: data.employee_id || '',
          first_name: data.first_name || '',
          middle_name: data.middle_name || '',
          last_name: data.last_name || '',
          gender: data.gender || '',
          marital_status: data.marital_status || '',
          blood_group: data.blood_group || '',
          date_of_birth: data.date_of_birth || '',
          employee_category: data.employee_category || '',
          status: data.status || 'Active',
          joined_date: data.joined_date || '',
          exit_date: data.exit_date || '',
          initial_salary: data.current_salary || '',
          contact: {
            personal_email: data.contact?.personal_email || '',
            working_email: data.contact?.working_email || '',
            mobile: data.contact?.mobile || '',
            phone: data.contact?.phone || '',
            emergency_contact: data.contact?.emergency_contact || '',
          },
          address: {
            resident_location: data.address?.resident_location || '',
            present_address: data.address?.present_address || '',
            permanent_address: data.address?.permanent_address || '',
            state: data.address?.state || '',
          },
          employment: {
            designation: data.employment?.designation || '',
            designation_text: data.employment?.designation_text || '',
            department: DEPARTMENTS.includes(data.employment?.department)
              ? data.employment.department
              : data.employment?.department
                ? 'OTHER'
                : '',
            department_other: DEPARTMENTS.includes(data.employment?.department)
              ? ''
              : data.employment?.department || '',
            reporting_to: data.employment?.reporting_to || '',
            working_region: data.employment?.working_region || '',
            working_state: data.employment?.working_state || '',
            start_date: data.employment?.start_date || '',
          },
          identification: {
            pan_number: data.identification?.pan_number || '',
            aadhar_number: data.identification?.aadhar_number || '',
            passport_number: data.identification?.passport_number || '',
            uan_number: data.identification?.uan_number || '',
            esi_number: data.identification?.esi_number || '',
            pf_number: data.identification?.pf_number || '',
          },
          bank_accounts: data.bank_accounts || [],
          family_members: data.family_members || [],
        })
        if (data.photo_url) setPhoto(await localEmployeePhotos.getSignedUrl(data.photo_url))
      } catch {
        setFetchError('Failed to load employee data.')
      } finally {
        setFetching(false)
      }
    }
    load()
  }, [id, isEdit, reset])

  // ── managers list for "Reporting To" ─────────────────────────────────────────
  // employee_employment.reporting_to is a uuid FK to employees.id, not the
  // human-readable employee_id — must be picked from a list, not typed freely
  // (a typed employee_id like "EMP002" fails Postgres uuid parsing on save).
  useEffect(() => {
    let cancelled = false
    localEmployees.list({ pageSize: 500 }).then((res) => {
      if (!cancelled) setManagers((res.items || []).filter((e) => e.id !== resolvedId))
    })
    return () => {
      cancelled = true
    }
  }, [resolvedId])

  // ── guards ───────────────────────────────────────────────────────────────────

  if (!canEdit) {
    return (
      <CAlert color="danger">
        <strong>Access Denied.</strong> This page is restricted to HR users.
      </CAlert>
    )
  }

  if (fetching) {
    return (
      <div className="text-center py-5">
        <CSpinner color="primary" />
        <p className="mt-2 text-body-secondary small">Loading employee record…</p>
      </div>
    )
  }

  if (fetchError) {
    return <CAlert color="danger">{fetchError}</CAlert>
  }

  // ── submit ───────────────────────────────────────────────────────────────────

  const onSubmit = async (form) => {
    setSubmitError('')
    try {
      let saved = null

      // Resolve actual department: if OTHER was picked, use the typed value
      const resolvedDept =
        form.employment?.department === 'OTHER'
          ? form.employment?.department_other || 'OTHER'
          : form.employment?.department || ''

      const { department_other: _deptOther, ...restEmployment } = form.employment || {}
      const payload = {
        ...form,
        employment: { ...restEmployment, department: resolvedDept },
      }

      if (isEdit) {
        try {
          await api.put(`/employees/${resolvedId}`, payload)
        } catch {
          await localEmployees.update(resolvedId, payload)
        }
        if (photoFile) await localEmployeePhotos.upload(resolvedId, photoFile)
        navigate(`/ems/staff-payroll/${resolvedId}`)
      } else {
        try {
          const { data } = await api.post('/employees', payload)
          saved = data
        } catch {
          saved = await localEmployees.create(payload)
        }
        if (photoFile) await localEmployeePhotos.upload(saved.id, photoFile)
        navigate(`/ems/staff-payroll/${saved.id}`)
      }
    } catch (err) {
      setSubmitError(err.message || 'Failed to save employee. Please try again.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const back = () => navigate(isEdit ? `/ems/staff-payroll/${resolvedId}` : '/ems/staff-payroll')

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <CForm onSubmit={handleSubmit(onSubmit)} noValidate>
      {/* ── Header bar ── */}
      <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
        <div className="d-flex align-items-center gap-3">
          <CButton color="link" className="ps-0 text-decoration-none" type="button" onClick={back}>
            <CIcon icon={cilArrowLeft} className="me-1" />
            {isEdit ? 'Back to Profile' : 'Back to Staff List'}
          </CButton>
          <h5 className="mb-0">{isEdit ? 'Edit Employee' : 'Add New Employee'}</h5>
        </div>
        <div className="d-flex gap-2">
          <CButton color="secondary" type="button" onClick={back}>
            Cancel
          </CButton>
          <CButton color="primary" type="submit" disabled={isSubmitting}>
            {isSubmitting && <CSpinner size="sm" className="me-2" />}
            {isEdit ? 'Save Changes' : 'Create Employee'}
          </CButton>
        </div>
      </div>

      {submitError && (
        <CAlert color="danger" dismissible onClose={() => setSubmitError('')} className="mb-3">
          {submitError}
        </CAlert>
      )}

      {/* ══ SECTION 1: Core Identity ══════════════════════════════════════════ */}
      <CCard className="mb-3 border-top border-top-primary border-3">
        <CCardHeader className="d-flex justify-content-between">
          <strong>Employee Identity</strong>
          <span className="text-danger small">
            <Req /> Required fields
          </span>
        </CCardHeader>
        <CCardBody>
          {/* Photo + fields side by side */}
          <div className="d-flex gap-4 align-items-start mb-3">
            <div className="d-flex flex-column align-items-center gap-1" style={{ minWidth: 96 }}>
              <ProfilePhotoUpload
                photo={photo}
                name={`${watchedFirst} ${watchedLast}`.trim() || 'Employee'}
                size={96}
                canEdit
                onChange={setPhotoFile}
              />
              <span className="text-body-secondary" style={{ fontSize: 11 }}>
                Click to upload
              </span>
            </div>
            <div className="flex-grow-1">
              <div className="text-body-secondary small mb-2">
                Accepted: JPG, PNG, WebP &mdash; max 2 MB
              </div>
            </div>
          </div>
          <CRow className="g-3">
            {/* Employee ID */}
            <CCol md={3}>
              <F
                label="Employee ID"
                required
                error={errors.employee_id}
                hint="e.g. EMP001 — 4–20 uppercase letters/numbers"
              >
                <CFormInput
                  {...register('employee_id', {
                    required: 'Employee ID is required',
                    pattern: {
                      value: /^[A-Z0-9]{4,20}$/,
                      message: 'Must be 4–20 uppercase letters and numbers only',
                    },
                  })}
                  placeholder="EMP001"
                  className={errors.employee_id ? 'is-invalid' : ''}
                />
              </F>
            </CCol>

            {/* First Name */}
            <CCol md={3}>
              <F label="First Name" required error={errors.first_name}>
                <CFormInput
                  {...register('first_name', { required: 'First name is required' })}
                  className={errors.first_name ? 'is-invalid' : ''}
                />
              </F>
            </CCol>

            {/* Middle Name */}
            <CCol md={3}>
              <F label="Middle Name">
                <CFormInput {...register('middle_name')} />
              </F>
            </CCol>

            {/* Last Name */}
            <CCol md={3}>
              <F label="Last Name">
                <CFormInput {...register('last_name')} />
              </F>
            </CCol>

            {/* Gender */}
            <CCol md={3}>
              <F label="Gender">
                <CFormSelect {...register('gender')}>
                  <option value="">Select gender</option>
                  {GENDERS.map((g) => (
                    <option key={g}>{g}</option>
                  ))}
                </CFormSelect>
              </F>
            </CCol>

            {/* Date of Birth */}
            <CCol md={3}>
              <F label="Date of Birth">
                <CFormInput type="date" {...register('date_of_birth')} />
              </F>
            </CCol>

            {/* Marital Status */}
            <CCol md={3}>
              <F label="Marital Status">
                <CFormSelect {...register('marital_status')}>
                  <option value="">Select</option>
                  {MARITAL.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </CFormSelect>
              </F>
            </CCol>

            {/* Blood Group */}
            <CCol md={3}>
              <F label="Blood Group">
                <CFormSelect {...register('blood_group')}>
                  <option value="">Select</option>
                  {BLOOD.map((b) => (
                    <option key={b}>{b}</option>
                  ))}
                </CFormSelect>
              </F>
            </CCol>

            {/* Employee Category */}
            <CCol md={3}>
              <F label="Employee Category">
                <CFormSelect {...register('employee_category')}>
                  <option value="">Select</option>
                  {CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </CFormSelect>
              </F>
            </CCol>

            {/* Status — edit mode routes through "Change Status" instead: that
                flow logs status_history and requires exit date/remarks, while
                this form's own status field is not persisted on save. */}
            <CCol md={3}>
              <F
                label="Status"
                hint={isEdit ? 'Use "Change Status" on the profile page to change' : undefined}
              >
                <CFormSelect {...register('status')} disabled={isEdit}>
                  {STATUSES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </CFormSelect>
              </F>
            </CCol>

            {/* Joined Date */}
            <CCol md={3}>
              <F label="Joined Date">
                <CFormInput type="date" {...register('joined_date')} />
              </F>
            </CCol>

            {/* Initial Salary */}
            <CCol md={3}>
              <F
                label={isEdit ? 'Current Salary' : 'Initial Salary'}
                hint={
                  isEdit
                    ? 'Use "Update Salary" to change'
                    : 'Optional — creates first salary record'
                }
              >
                <CFormInput
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 25000"
                  {...register('initial_salary')}
                  disabled={isEdit}
                />
              </F>
            </CCol>

            {/* Exit Date — only when status is Resigned or Retired. In edit mode
                this is display-only; the actual exit date is set via "Change
                Status" (which persists it, unlike this form's own field). */}
            {(watchedStatus === 'Resigned' || watchedStatus === 'Retired') && (
              <CCol md={3}>
                <F
                  label="Exit Date"
                  required={!isEdit}
                  error={errors.exit_date}
                  hint={isEdit ? 'Set via "Change Status" on the profile page' : undefined}
                >
                  <CFormInput
                    type="date"
                    {...register('exit_date', {
                      required: !isEdit ? 'Exit date required for this status' : false,
                    })}
                    disabled={isEdit}
                    className={errors.exit_date ? 'is-invalid' : ''}
                  />
                </F>
              </CCol>
            )}
          </CRow>
        </CCardBody>
      </CCard>

      {/* ══ OPTIONAL DETAILS ═════════════════════════════════════════════════ */}
      <CAccordion alwaysOpen className="mb-3">
        {/* 1 — Contact Information */}
        <CAccordionItem itemKey={1}>
          <CAccordionHeader>
            <span className="fw-semibold">Contact Information</span>
          </CAccordionHeader>
          <CAccordionBody>
            <CRow className="g-3">
              <CCol md={4}>
                <F
                  label="Working Email"
                  error={errors.contact?.working_email}
                  hint="Official work email address"
                >
                  <CFormInput
                    type="email"
                    {...register('contact.working_email', {
                      pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Invalid email' },
                    })}
                    className={errors.contact?.working_email ? 'is-invalid' : ''}
                  />
                </F>
              </CCol>
              <CCol md={4}>
                <F label="Personal Email" error={errors.contact?.personal_email}>
                  <CFormInput
                    type="email"
                    {...register('contact.personal_email', {
                      pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Invalid email' },
                    })}
                    className={errors.contact?.personal_email ? 'is-invalid' : ''}
                  />
                </F>
              </CCol>
              <CCol md={4}>
                <F label="Mobile" error={errors.contact?.mobile}>
                  <CFormInput
                    {...register('contact.mobile', {
                      pattern: { value: /^[0-9]{10}$/, message: 'Must be 10 digits' },
                    })}
                    placeholder="10-digit number"
                    className={errors.contact?.mobile ? 'is-invalid' : ''}
                  />
                </F>
              </CCol>
              <CCol md={4}>
                <F label="Phone">
                  <CFormInput {...register('contact.phone')} />
                </F>
              </CCol>
              <CCol md={4}>
                <F label="Emergency Contact">
                  <CFormInput {...register('contact.emergency_contact')} />
                </F>
              </CCol>
            </CRow>
          </CAccordionBody>
        </CAccordionItem>

        {/* 2 — Address Information */}
        <CAccordionItem itemKey={2}>
          <CAccordionHeader>
            <span className="fw-semibold">Address Information</span>
          </CAccordionHeader>
          <CAccordionBody>
            <CRow className="g-3">
              <CCol md={4}>
                <F label="Resident Location">
                  <CFormInput
                    {...register('address.resident_location')}
                    placeholder="City / Town"
                  />
                </F>
              </CCol>
              <CCol md={4}>
                <F label="State">
                  <CFormInput {...register('address.state')} placeholder="e.g. Kerala" />
                </F>
              </CCol>
              <CCol md={6}>
                <F label="Present Address">
                  <CFormTextarea rows={3} {...register('address.present_address')} />
                </F>
              </CCol>
              <CCol md={6}>
                <F label="Permanent Address">
                  <CFormTextarea rows={3} {...register('address.permanent_address')} />
                </F>
              </CCol>
            </CRow>
          </CAccordionBody>
        </CAccordionItem>

        {/* 3 — Employment Details */}
        <CAccordionItem itemKey={3}>
          <CAccordionHeader>
            <span className="fw-semibold">Employment Details</span>
          </CAccordionHeader>
          <CAccordionBody>
            <CRow className="g-3">
              <CCol md={4}>
                <F label="Roles">
                  <CFormSelect {...register('employment.designation')}>
                    <option value="">— Select role —</option>
                    {DESIGNATIONS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </CFormSelect>
                </F>
              </CCol>
              <CCol md={4}>
                <F label="Designation">
                  <CFormInput
                    {...register('employment.designation_text')}
                    placeholder="Type the employee's designation"
                  />
                </F>
              </CCol>
              <CCol md={4}>
                <F label="Department">
                  <CFormSelect {...register('employment.department')}>
                    <option value="">— Select department —</option>
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>
                        {d === 'SDP' ? 'SDP (Project Department)' : d}
                      </option>
                    ))}
                  </CFormSelect>
                  {watchedDept === 'OTHER' && (
                    <CFormInput
                      {...register('employment.department_other')}
                      placeholder="Type department name"
                      className="mt-2"
                    />
                  )}
                </F>
              </CCol>
              <CCol md={4}>
                <F label="Reporting To" hint="Manager this employee reports to">
                  <CFormSelect {...register('employment.reporting_to')}>
                    <option value="">— None —</option>
                    {managers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.employee_id} — {m.employee_name}
                      </option>
                    ))}
                  </CFormSelect>
                </F>
              </CCol>
              <CCol md={4}>
                <F label="Working Region">
                  <CFormInput
                    {...register('employment.working_region')}
                    placeholder="e.g. South India"
                  />
                </F>
              </CCol>
              <CCol md={4}>
                <F label="Working State">
                  <CFormInput {...register('employment.working_state')} placeholder="e.g. Kerala" />
                </F>
              </CCol>
              <CCol md={4}>
                <F label="Start Date">
                  <CFormInput type="date" {...register('employment.start_date')} />
                </F>
              </CCol>
            </CRow>
          </CAccordionBody>
        </CAccordionItem>

        {/* 4 — Government IDs */}
        <CAccordionItem itemKey={4}>
          <CAccordionHeader>
            <span className="fw-semibold">Government Identification</span>
          </CAccordionHeader>
          <CAccordionBody>
            <CRow className="g-3">
              {[
                {
                  key: 'pan_number',
                  label: 'PAN Number',
                  ph: 'ABCDE1234F',
                  pattern: /^[A-Z]{5}[0-9]{4}[A-Z]$/,
                  msg: 'Invalid PAN (e.g. ABCDE1234F)',
                },
                {
                  key: 'aadhar_number',
                  label: 'Aadhar Number',
                  ph: '12-digit number',
                  pattern: /^[0-9]{12}$/,
                  msg: 'Must be 12 digits',
                },
                { key: 'passport_number', label: 'Passport Number', ph: 'A1234567' },
                { key: 'uan_number', label: 'UAN Number', ph: '12-digit UAN' },
                { key: 'esi_number', label: 'ESI Number', ph: '17-character ESI' },
                { key: 'pf_number', label: 'PF Number', ph: 'PF account number' },
              ].map(({ key, label, ph, pattern, msg }) => {
                const fieldError = errors.identification?.[key]
                return (
                  <CCol md={4} key={key}>
                    <F label={label} error={fieldError}>
                      <CFormInput
                        {...register(
                          `identification.${key}`,
                          pattern ? { pattern: { value: pattern, message: msg } } : {},
                        )}
                        placeholder={ph}
                        className={fieldError ? 'is-invalid' : ''}
                      />
                    </F>
                  </CCol>
                )
              })}
            </CRow>
          </CAccordionBody>
        </CAccordionItem>

        {/* 5 — Bank Account */}
        <CAccordionItem itemKey={5}>
          <CAccordionHeader>
            <span className="fw-semibold">Bank Accounts</span>
          </CAccordionHeader>
          <CAccordionBody>
            {bankFields.length === 0 && (
              <p className="text-body-secondary mb-3 small">No bank accounts added yet.</p>
            )}
            {bankFields.map((field, i) => (
              <CCard key={field.id} className="mb-3 border">
                <CCardHeader className="d-flex justify-content-between align-items-center py-2">
                  <span className="small fw-semibold">Account {i + 1}</span>
                  <CButton
                    color="danger"
                    variant="ghost"
                    size="sm"
                    type="button"
                    onClick={() => removeBank(i)}
                  >
                    <CIcon icon={cilTrash} />
                  </CButton>
                </CCardHeader>
                <CCardBody>
                  <CRow className="g-3">
                    <CCol md={4}>
                      <F label="Bank Name" error={errors.bank_accounts?.[i]?.bank_name}>
                        <CFormInput
                          {...register(`bank_accounts.${i}.bank_name`)}
                          className={errors.bank_accounts?.[i]?.bank_name ? 'is-invalid' : ''}
                        />
                      </F>
                    </CCol>
                    <CCol md={4}>
                      <F label="Account Number" error={errors.bank_accounts?.[i]?.account_number}>
                        <CFormInput
                          {...register(`bank_accounts.${i}.account_number`)}
                          className={errors.bank_accounts?.[i]?.account_number ? 'is-invalid' : ''}
                        />
                      </F>
                    </CCol>
                    <CCol md={4}>
                      <F label="IFSC Code" error={errors.bank_accounts?.[i]?.ifsc}>
                        <CFormInput
                          {...register(`bank_accounts.${i}.ifsc`, {
                            pattern: {
                              value: /^[A-Z]{4}0[A-Z0-9]{6}$/,
                              message: 'Invalid IFSC (e.g. SBIN0001234)',
                            },
                          })}
                          placeholder="SBIN0001234"
                          className={errors.bank_accounts?.[i]?.ifsc ? 'is-invalid' : ''}
                        />
                      </F>
                    </CCol>
                  </CRow>
                </CCardBody>
              </CCard>
            ))}
            <CButton
              color="secondary"
              variant="outline"
              size="sm"
              type="button"
              onClick={() => addBank({ bank_name: '', account_number: '', ifsc: '' })}
            >
              <CIcon icon={cilPlus} className="me-1" />
              Add Bank Account
            </CButton>
          </CAccordionBody>
        </CAccordionItem>

        {/* 6 — Family Members */}
        <CAccordionItem itemKey={6}>
          <CAccordionHeader>
            <span className="fw-semibold">Family Members</span>
          </CAccordionHeader>
          <CAccordionBody>
            {familyFields.length === 0 && (
              <p className="text-body-secondary mb-3 small">No family members added yet.</p>
            )}
            {familyFields.map((field, i) => (
              <CCard key={field.id} className="mb-3 border">
                <CCardHeader className="d-flex justify-content-between align-items-center py-2">
                  <span className="small fw-semibold">Member {i + 1}</span>
                  <CButton
                    color="danger"
                    variant="ghost"
                    size="sm"
                    type="button"
                    onClick={() => removeFamily(i)}
                  >
                    <CIcon icon={cilTrash} />
                  </CButton>
                </CCardHeader>
                <CCardBody>
                  <CRow className="g-3">
                    <CCol md={3}>
                      <F label="Name" required error={errors.family_members?.[i]?.name}>
                        <CFormInput
                          {...register(`family_members.${i}.name`, {
                            required: 'Name is required',
                          })}
                          className={errors.family_members?.[i]?.name ? 'is-invalid' : ''}
                        />
                      </F>
                    </CCol>
                    <CCol md={3}>
                      <F label="Relationship" required error={errors.family_members?.[i]?.relation}>
                        <CFormSelect
                          {...register(`family_members.${i}.relation`, {
                            required: 'Required',
                          })}
                          className={errors.family_members?.[i]?.relation ? 'is-invalid' : ''}
                        >
                          <option value="">Select</option>
                          {RELATIONSHIPS.map((r) => (
                            <option key={r}>{r}</option>
                          ))}
                        </CFormSelect>
                      </F>
                    </CCol>
                    <CCol md={3}>
                      <F label="Date of Birth">
                        <CFormInput
                          type="date"
                          {...register(`family_members.${i}.date_of_birth`)}
                        />
                      </F>
                    </CCol>
                  </CRow>
                </CCardBody>
              </CCard>
            ))}
            <CButton
              color="secondary"
              variant="outline"
              size="sm"
              type="button"
              onClick={() =>
                addFamily({
                  name: '',
                  relation: '',
                  date_of_birth: '',
                })
              }
            >
              <CIcon icon={cilPlus} className="me-1" />
              Add Family Member
            </CButton>
          </CAccordionBody>
        </CAccordionItem>
      </CAccordion>

      {/* ── Bottom save bar ── */}
      <div className="d-flex justify-content-end gap-2 py-3 border-top mt-1">
        <CButton color="secondary" type="button" onClick={back}>
          Cancel
        </CButton>
        <CButton color="primary" type="submit" disabled={isSubmitting}>
          {isSubmitting && <CSpinner size="sm" className="me-2" />}
          {isEdit ? 'Save Changes' : 'Create Employee'}
        </CButton>
      </div>
    </CForm>
  )
}

export default EmployeeForm
