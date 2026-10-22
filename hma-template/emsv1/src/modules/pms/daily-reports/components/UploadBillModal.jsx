import React, { useState } from 'react'
import PropTypes from 'prop-types'
import {
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CButton,
  CFormInput,
  CFormLabel,
  CFormTextarea,
  CFormFeedback,
  CSpinner,
  CRow,
  CCol,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilCloudUpload, cilFile } from '@coreui/icons'

const UploadBillModal = ({ visible, onClose, onConfirm, loading = false }) => {
  const [form, setForm] = useState({
    reason: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    file: null,
  })
  const [errors, setErrors] = useState({})

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }))
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    setForm((prev) => ({ ...prev, file }))
    if (errors.file) setErrors((prev) => ({ ...prev, file: '' }))
  }

  const validate = () => {
    const errs = {}
    if (!form.reason.trim()) errs.reason = 'Reason/Description is required'
    if (!form.amount || form.amount <= 0) errs.amount = 'Please enter a valid amount'
    if (!form.date) errs.date = 'Date is required'
    if (!form.file) errs.file = 'Please upload a proof document'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = () => {
    if (!validate()) return
    onConfirm(form)
  }

  const handleClose = () => {
    setForm({ reason: '', amount: '', date: new Date().toISOString().split('T')[0], file: null })
    setErrors({})
    onClose()
  }

  return (
    <CModal visible={visible} onClose={handleClose} alignment="center" size="lg">
      <CModalHeader closeButton>
        <CModalTitle>
          <CIcon icon={cilCloudUpload} className="me-2" />
          Upload New Bill
        </CModalTitle>
      </CModalHeader>
      <CModalBody>
        <div className="mb-3">
          <CFormLabel htmlFor="bill-reason" className="fw-medium">
            Reason / Description <span className="text-danger">*</span>
          </CFormLabel>
          <CFormTextarea
            id="bill-reason"
            rows={3}
            placeholder="Describe the purpose of this bill..."
            value={form.reason}
            onChange={(e) => handleChange('reason', e.target.value)}
            invalid={!!errors.reason}
          />
          {errors.reason && <CFormFeedback invalid>{errors.reason}</CFormFeedback>}
        </div>

        <CRow className="g-3 mb-3">
          <CCol xs={12} md={6}>
            <CFormLabel htmlFor="bill-amount" className="fw-medium">
              Amount (INR) <span className="text-danger">*</span>
            </CFormLabel>
            <CFormInput
              id="bill-amount"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="e.g. 1500"
              value={form.amount}
              onChange={(e) => handleChange('amount', e.target.value)}
              invalid={!!errors.amount}
            />
            {errors.amount && <CFormFeedback invalid>{errors.amount}</CFormFeedback>}
          </CCol>

          <CCol xs={12} md={6}>
            <CFormLabel htmlFor="bill-date" className="fw-medium">
              Date of Expense <span className="text-danger">*</span>
            </CFormLabel>
            <CFormInput
              id="bill-date"
              type="date"
              value={form.date}
              onChange={(e) => handleChange('date', e.target.value)}
              invalid={!!errors.date}
            />
            {errors.date && <CFormFeedback invalid>{errors.date}</CFormFeedback>}
          </CCol>
        </CRow>

        <div className="mb-3">
          <CFormLabel htmlFor="bill-file" className="fw-medium">
            Upload Proof (Images/PDF) <span className="text-danger">*</span>
          </CFormLabel>
          <CFormInput
            id="bill-file"
            type="file"
            accept="image/*,.pdf"
            onChange={handleFileChange}
            invalid={!!errors.file}
          />
          {errors.file && <CFormFeedback invalid>{errors.file}</CFormFeedback>}
          <div className="text-body-tertiary mt-1" style={{ fontSize: '0.75rem' }}>
            Max size: 5MB
          </div>
        </div>
      </CModalBody>
      <CModalFooter>
        <CButton color="secondary" variant="ghost" onClick={handleClose} disabled={loading}>
          Cancel
        </CButton>
        <CButton color="primary" onClick={handleSubmit} disabled={loading}>
          {loading ? (
            <>
              <CSpinner size="sm" className="me-1" />
              Uploading...
            </>
          ) : (
            <>
              <CIcon icon={cilFile} className="me-1" />
              Submit Bill
            </>
          )}
        </CButton>
      </CModalFooter>
    </CModal>
  )
}

UploadBillModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  loading: PropTypes.bool,
}

export default UploadBillModal
