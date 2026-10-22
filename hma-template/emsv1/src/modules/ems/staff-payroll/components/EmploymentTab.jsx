import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import {
  CAlert,
  CBadge,
  CButton,
  CCol,
  CForm,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CRow,
  CSpinner,
} from '@coreui/react'
import api from '../../../../services/api'
import { localEmployees } from '../../../../services/localEmployees'
import { DESIGNATIONS, DEPARTMENTS } from '../../../../constants/employeeConstants'

const STATUS_COLORS = {
  Active: 'success',
  Inactive: 'secondary',
  Resigned: 'danger',
  Retired: 'warning',
  Deleted: 'dark',
}

const EmploymentTab = ({ profile, canEdit, onSave }) => {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [managers, setManagers] = useState([])

  const employment = profile.employment || {}
  const isKnownDept = DEPARTMENTS.includes(employment.department)

  const [form, setForm] = useState({
    designation: employment.designation || '',
    designation_text: employment.designation_text || '',
    department: isKnownDept ? employment.department : employment.department ? 'OTHER' : '',
    department_other: isKnownDept ? '' : employment.department || '',
    reporting_to: employment.reporting_to || '',
    working_region: employment.working_region || '',
    working_state: employment.working_state || '',
    start_date: employment.start_date || '',
    end_date: employment.end_date || '',
  })
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  // Reporting_to is a uuid FK to employees.id — must be picked from a list,
  // not typed, or Postgres rejects the save with an invalid uuid error.
  useEffect(() => {
    let cancelled = false
    localEmployees.list({ pageSize: 500 }).then((res) => {
      if (!cancelled) setManagers((res.items || []).filter((e) => e.id !== profile.id))
    })
    return () => {
      cancelled = true
    }
  }, [profile.id])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    const payload = {
      designation: form.designation,
      designation_text: form.designation_text,
      department: form.department === 'OTHER' ? form.department_other || 'OTHER' : form.department,
      reporting_to: form.reporting_to || null,
      working_region: form.working_region,
      working_state: form.working_state,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
    }
    try {
      await api.put(`/employees/${profile.id}/employment`, payload)
      setEditing(false)
      onSave()
    } catch (err) {
      try {
        await localEmployees.update(profile.id, { employment: payload })
        setEditing(false)
        onSave()
      } catch (localErr) {
        setError(err.response?.data?.detail || localErr.message || 'Save failed')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <CForm onSubmit={handleSave}>
      {error && <CAlert color="danger">{error}</CAlert>}

      <div className="mb-3">
        <span className="text-body-secondary small">Status: </span>
        <CBadge color={STATUS_COLORS[profile.status] || 'secondary'} className="ms-1">
          {profile.status}
        </CBadge>
        <span className="text-body-secondary small ms-2">
          — use &quot;Change Status&quot; above to change
        </span>
      </div>

      <CRow className="g-3">
        <CCol md={4}>
          <CFormLabel>Roles *</CFormLabel>
          <CFormSelect
            value={form.designation}
            onChange={set('designation')}
            disabled={!editing}
            required
          >
            <option value="">— Select role —</option>
            {DESIGNATIONS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </CFormSelect>
        </CCol>
        <CCol md={4}>
          <CFormLabel>Designation</CFormLabel>
          <CFormInput
            value={form.designation_text}
            onChange={set('designation_text')}
            disabled={!editing}
            placeholder="Type the employee's designation"
          />
        </CCol>
        <CCol md={4}>
          <CFormLabel>Department</CFormLabel>
          <CFormSelect value={form.department} onChange={set('department')} disabled={!editing}>
            <option value="">— Select department —</option>
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </CFormSelect>
          {form.department === 'OTHER' && (
            <CFormInput
              className="mt-2"
              value={form.department_other}
              onChange={set('department_other')}
              disabled={!editing}
              placeholder="Type department name"
            />
          )}
        </CCol>
        <CCol md={4}>
          <CFormLabel>Reporting To</CFormLabel>
          <CFormSelect value={form.reporting_to} onChange={set('reporting_to')} disabled={!editing}>
            <option value="">— None —</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.employee_id} — {m.employee_name}
              </option>
            ))}
          </CFormSelect>
        </CCol>
        <CCol md={4}>
          <CFormLabel>Working Region</CFormLabel>
          <CFormInput
            value={form.working_region}
            onChange={set('working_region')}
            disabled={!editing}
            placeholder="e.g. South India"
          />
        </CCol>
        <CCol md={4}>
          <CFormLabel>Working State</CFormLabel>
          <CFormInput
            value={form.working_state}
            onChange={set('working_state')}
            disabled={!editing}
            placeholder="e.g. Kerala"
          />
        </CCol>
        <CCol md={4}>
          <CFormLabel>Start Date</CFormLabel>
          <CFormInput
            type="date"
            value={form.start_date}
            onChange={set('start_date')}
            disabled={!editing}
          />
        </CCol>
        <CCol md={4}>
          <CFormLabel>End Date</CFormLabel>
          <CFormInput
            type="date"
            value={form.end_date}
            onChange={set('end_date')}
            disabled={!editing}
          />
        </CCol>
      </CRow>
      {canEdit && (
        <div className="mt-3 d-flex gap-2">
          {editing ? (
            <>
              <CButton color="primary" type="submit" disabled={saving}>
                {saving && <CSpinner size="sm" className="me-2" />}
                Save
              </CButton>
              <CButton
                color="secondary"
                type="button"
                onClick={() => setEditing(false)}
                disabled={saving}
              >
                Cancel
              </CButton>
            </>
          ) : (
            <CButton
              color="primary"
              type="button"
              onClick={(e) => {
                e.preventDefault()
                setEditing(true)
              }}
            >
              Edit
            </CButton>
          )}
        </div>
      )}
    </CForm>
  )
}

EmploymentTab.propTypes = {
  profile: PropTypes.object.isRequired,
  canEdit: PropTypes.bool.isRequired,
  onSave: PropTypes.func.isRequired,
}

export default EmploymentTab
