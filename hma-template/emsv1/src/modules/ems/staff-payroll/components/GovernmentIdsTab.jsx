import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { CAlert, CButton, CCol, CForm, CFormInput, CFormLabel, CRow, CSpinner } from '@coreui/react'
import api from '../../../../services/api'
import { localEmployees } from '../../../../services/localEmployees'

const GovernmentIdsTab = ({ employeeId, identification, canEdit, onSave }) => {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    pan_number: identification?.pan_number || '',
    aadhar_number: identification?.aadhar_number || '',
    uan_number: identification?.uan_number || '',
    esi_number: identification?.esi_number || '',
    pf_number: identification?.pf_number || '',
    passport_number: identification?.passport_number || '',
    insurance_number: identification?.insurance_number || '',
  })
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await api.put(`/employees/${employeeId}/identification`, form)
      setEditing(false)
      onSave()
    } catch (err) {
      try {
        // Fallback to local storage if API is unreachable
        await localEmployees.update(employeeId, { identification: form })
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
        {[
          {
            key: 'pan_number',
            label: 'PAN Number',
            placeholder: '10 characters',
            pattern: '^[A-Za-z0-9]{10}$',
            title: '10 characters',
            minLength: 10,
            maxLength: 10,
          },
          {
            key: 'aadhar_number',
            label: 'Aadhaar Number',
            placeholder: '12-digit number',
            pattern: '^\\d{12}$',
            title: '12 digits',
            minLength: 12,
            maxLength: 12,
          },
          {
            key: 'uan_number',
            label: 'UAN Number',
            placeholder: '12-digit UAN',
            pattern: '^\\d{12}$',
            title: '12 digits',
            minLength: 12,
            maxLength: 12,
          },
          {
            key: 'esi_number',
            label: 'ESI Number',
            placeholder: '17-digit ESI',
            pattern: '^\\d{17}$',
            title: '17 digits',
            minLength: 17,
            maxLength: 17,
          },
          { key: 'pf_number', label: 'PF Number', placeholder: 'PF account number' },
          {
            key: 'passport_number',
            label: 'Passport Number',
            placeholder: 'A1234567',
            pattern: '^[A-Za-z][A-Za-z0-9]{7}$',
            title: '1 alphabet followed by 7 alphanumeric characters',
            minLength: 8,
            maxLength: 8,
          },
          {
            key: 'insurance_number',
            label: 'Insurance Number',
            placeholder: '10-digit number',
            pattern: '^\\d{10}$',
            title: '10 digits',
            minLength: 10,
            maxLength: 10,
          },
        ].map(({ key, label, placeholder, pattern, title, minLength, maxLength }) => (
          <CCol md={4} key={key}>
            <CFormLabel>{label}</CFormLabel>
            <CFormInput
              value={form[key]}
              onChange={set(key)}
              disabled={!editing}
              placeholder={placeholder}
              pattern={pattern}
              title={title}
              minLength={minLength}
              maxLength={maxLength}
            />
          </CCol>
        ))}
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

GovernmentIdsTab.propTypes = {
  employeeId: PropTypes.string.isRequired,
  identification: PropTypes.object,
  canEdit: PropTypes.bool.isRequired,
  onSave: PropTypes.func.isRequired,
}

export default GovernmentIdsTab
