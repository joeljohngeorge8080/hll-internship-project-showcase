import React, { useState } from 'react'
import PropTypes from 'prop-types'
import {
  CAlert,
  CBadge,
  CButton,
  CCol,
  CForm,
  CFormCheck,
  CFormInput,
  CFormLabel,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilPlus } from '@coreui/icons'
import api from '../../../../services/api'
import { localEmployees } from '../../../../services/localEmployees'

const BankAccountTab = ({ employeeId, bankAccounts, canEdit, onSave }) => {
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    bank_name: '',
    account_number: '',
    ifsc: '',
    is_primary: false,
  })
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const empty = { bank_name: '', account_number: '', ifsc: '', is_primary: false }

  const handleAdd = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await api.post(`/employees/${employeeId}/bank-accounts`, form)
      setShowModal(false)
      setForm(empty)
      onSave()
    } catch (err) {
      try {
        await localEmployees.addBankAccount(employeeId, form)
        setShowModal(false)
        setForm(empty)
        onSave()
      } catch (localErr) {
        setError(err.response?.data?.detail || localErr.message || 'Failed to add account')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <strong>Bank Accounts</strong>
        {canEdit && (
          <CButton color="primary" size="sm" onClick={() => setShowModal(true)}>
            <CIcon icon={cilPlus} className="me-1" />
            Add Account
          </CButton>
        )}
      </div>

      {!bankAccounts?.length ? (
        <p className="text-body-secondary">No bank accounts added.</p>
      ) : (
        <CTable hover responsive>
          <CTableHead color="light">
            <CTableRow>
              <CTableHeaderCell>Bank Name</CTableHeaderCell>
              <CTableHeaderCell>Account Number</CTableHeaderCell>
              <CTableHeaderCell>IFSC Code</CTableHeaderCell>
              <CTableHeaderCell>Primary</CTableHeaderCell>
            </CTableRow>
          </CTableHead>
          <CTableBody>
            {bankAccounts.map((acc) => (
              <CTableRow key={acc.id}>
                <CTableDataCell>{acc.bank_name}</CTableDataCell>
                <CTableDataCell>{acc.account_number}</CTableDataCell>
                <CTableDataCell>{acc.ifsc}</CTableDataCell>
                <CTableDataCell>
                  {acc.is_primary && <CBadge color="success">Primary</CBadge>}
                </CTableDataCell>
              </CTableRow>
            ))}
          </CTableBody>
        </CTable>
      )}

      <CModal visible={showModal} onClose={() => setShowModal(false)} backdrop="static">
        <CModalHeader>
          <CModalTitle>Add Bank Account</CModalTitle>
        </CModalHeader>
        <CForm onSubmit={handleAdd}>
          <CModalBody>
            {error && <CAlert color="danger">{error}</CAlert>}
            <CRow className="g-3">
              <CCol md={6}>
                <CFormLabel>Bank Name *</CFormLabel>
                <CFormInput value={form.bank_name} onChange={set('bank_name')} required />
              </CCol>
              <CCol md={6}>
                <CFormLabel>Account Number *</CFormLabel>
                <CFormInput
                  value={form.account_number}
                  onChange={set('account_number')}
                  required
                  pattern="^\d{9,18}$"
                  title="Numeric only, 9-18 digits"
                  minLength={9}
                  maxLength={18}
                />
              </CCol>
              <CCol md={6}>
                <CFormLabel>IFSC Code *</CFormLabel>
                <CFormInput
                  value={form.ifsc}
                  onChange={set('ifsc')}
                  placeholder="SBIN0001234"
                  required
                  pattern="^[A-Za-z0-9]{11}$"
                  title="11 alphanumeric characters"
                  minLength={11}
                  maxLength={11}
                />
              </CCol>
              <CCol md={12}>
                <CFormCheck
                  label="Set as Primary Account"
                  checked={form.is_primary}
                  onChange={(e) => setForm((f) => ({ ...f, is_primary: e.target.checked }))}
                />
              </CCol>
            </CRow>
          </CModalBody>
          <CModalFooter>
            <CButton color="secondary" onClick={() => setShowModal(false)} disabled={saving}>
              Cancel
            </CButton>
            <CButton color="primary" type="submit" disabled={saving}>
              {saving && <CSpinner size="sm" className="me-2" />}
              Add
            </CButton>
          </CModalFooter>
        </CForm>
      </CModal>
    </>
  )
}

BankAccountTab.propTypes = {
  employeeId: PropTypes.string.isRequired,
  bankAccounts: PropTypes.array,
  canEdit: PropTypes.bool.isRequired,
  onSave: PropTypes.func.isRequired,
}

export default BankAccountTab
