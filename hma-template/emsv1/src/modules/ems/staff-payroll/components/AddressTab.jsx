import React, { useState } from 'react'
import PropTypes from 'prop-types'
import {
  CAlert,
  CButton,
  CCol,
  CForm,
  CFormCheck,
  CFormInput,
  CFormLabel,
  CFormTextarea,
  CRow,
  CSpinner,
} from '@coreui/react'
import api from '../../../../services/api'
import { localEmployees } from '../../../../services/localEmployees'

const AddressTab = ({ employeeId, address, canEdit, onSave }) => {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [sameAsPresent, setSameAsPresent] = useState(false)
  const [form, setForm] = useState({
    present_address: address?.present_address || '',
    permanent_address: address?.permanent_address || '',
    resident_location: address?.resident_location || '',
    state: address?.state || '',
  })
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const handlePresentChange = (e) => {
    const value = e.target.value
    setForm((f) => ({
      ...f,
      present_address: value,
      permanent_address: sameAsPresent ? value : f.permanent_address,
    }))
  }

  const toggleSameAsPresent = (e) => {
    const checked = e.target.checked
    setSameAsPresent(checked)
    if (checked) {
      setForm((f) => ({ ...f, permanent_address: f.present_address }))
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await api.put(`/employees/${employeeId}/addresses`, form)
      setEditing(false)
      onSave()
    } catch (err) {
      try {
        await localEmployees.update(employeeId, { address: form })
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
        <CCol md={6}>
          <CFormLabel>Present Address</CFormLabel>
          <CFormTextarea
            rows={3}
            value={form.present_address}
            onChange={handlePresentChange}
            disabled={!editing}
          />
        </CCol>
        <CCol md={6}>
          <CFormLabel>Permanent Address</CFormLabel>
          <CFormTextarea
            rows={3}
            value={form.permanent_address}
            onChange={set('permanent_address')}
            disabled={!editing || sameAsPresent}
          />
          {editing && (
            <CFormCheck
              className="mt-2"
              id="sameAsPresentAddress"
              label="Same as Present Address"
              checked={sameAsPresent}
              onChange={toggleSameAsPresent}
            />
          )}
        </CCol>
        <CCol md={6}>
          <CFormLabel>State</CFormLabel>
          <CFormInput value={form.state} onChange={set('state')} disabled={!editing} />
        </CCol>
        <CCol md={6}>
          <CFormLabel>Resident Location</CFormLabel>
          <CFormInput
            value={form.resident_location}
            onChange={set('resident_location')}
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

AddressTab.propTypes = {
  employeeId: PropTypes.string.isRequired,
  address: PropTypes.object,
  canEdit: PropTypes.bool.isRequired,
  onSave: PropTypes.func.isRequired,
}

export default AddressTab
