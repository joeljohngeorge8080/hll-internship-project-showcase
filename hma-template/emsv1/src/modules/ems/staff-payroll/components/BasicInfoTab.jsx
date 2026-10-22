import React, { useState } from 'react'
import PropTypes from 'prop-types'
import {
  CAlert,
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

const GENDER_OPTIONS = ['Male', 'Female', 'Other']
const MARITAL_OPTIONS = ['Single', 'Married', 'Divorced', 'Widowed']

const BasicInfoTab = ({ profile, canEdit, onSave }) => {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    first_name: profile.first_name,
    middle_name: profile.middle_name || '',
    last_name: profile.last_name,
    gender: profile.gender,
    date_of_birth: profile.date_of_birth,
    marital_status: profile.marital_status || '',
    blood_group: profile.blood_group || '',
  })

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await api.put(`/employees/${profile.id}`, form)
      setEditing(false)
      onSave()
    } catch (err) {
      try {
        await localEmployees.update(profile.id, form)
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
      <CRow className="g-3">
        <CCol md={4}>
          <CFormLabel>First Name *</CFormLabel>
          <CFormInput
            value={form.first_name}
            onChange={set('first_name')}
            disabled={!editing}
            required
          />
        </CCol>
        <CCol md={4}>
          <CFormLabel>Middle Name</CFormLabel>
          <CFormInput value={form.middle_name} onChange={set('middle_name')} disabled={!editing} />
        </CCol>
        <CCol md={4}>
          <CFormLabel>Last Name</CFormLabel>
          <CFormInput value={form.last_name} onChange={set('last_name')} disabled={!editing} />
        </CCol>
        <CCol md={4}>
          <CFormLabel>Gender *</CFormLabel>
          <CFormSelect value={form.gender} onChange={set('gender')} disabled={!editing} required>
            {GENDER_OPTIONS.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </CFormSelect>
        </CCol>
        <CCol md={4}>
          <CFormLabel>Date of Birth *</CFormLabel>
          <CFormInput
            type="date"
            value={form.date_of_birth}
            onChange={set('date_of_birth')}
            disabled={!editing}
            required
          />
        </CCol>
        <CCol md={4}>
          <CFormLabel>Marital Status</CFormLabel>
          <CFormSelect
            value={form.marital_status}
            onChange={set('marital_status')}
            disabled={!editing}
          >
            <option value="">— Select —</option>
            {MARITAL_OPTIONS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </CFormSelect>
        </CCol>
        <CCol md={4}>
          <CFormLabel>Blood Group</CFormLabel>
          <CFormInput
            value={form.blood_group}
            onChange={set('blood_group')}
            disabled={!editing}
            placeholder="e.g. O+"
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
            <CButton color="primary" type="button" onClick={(e) => { e.preventDefault(); setEditing(true); }}>
              Edit
            </CButton>
          )}
        </div>
      )}
    </CForm>
  )
}

BasicInfoTab.propTypes = {
  profile: PropTypes.object.isRequired,
  canEdit: PropTypes.bool.isRequired,
  onSave: PropTypes.func.isRequired,
}

export default BasicInfoTab
