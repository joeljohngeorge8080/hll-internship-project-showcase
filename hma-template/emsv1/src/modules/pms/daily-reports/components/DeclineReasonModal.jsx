/**
 * DeclineReasonModal — Modal for Project Officer to enter decline reason.
 *
 * Required textarea, Confirm/Cancel buttons.
 */
import React, { useState } from 'react'
import PropTypes from 'prop-types'
import {
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CButton,
  CFormTextarea,
  CFormLabel,
  CFormFeedback,
  CSpinner,
} from '@coreui/react'

const DeclineReasonModal = ({ visible, onClose, onConfirm, loading = false }) => {
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  const handleConfirm = () => {
    if (!reason.trim()) {
      setError('Please provide a reason for declining this report')
      return
    }
    if (reason.trim().length < 10) {
      setError('Reason must be at least 10 characters')
      return
    }
    setError('')
    onConfirm(reason.trim())
  }

  const handleClose = () => {
    setReason('')
    setError('')
    onClose()
  }

  return (
    <CModal visible={visible} onClose={handleClose} alignment="center">
      <CModalHeader closeButton>
        <CModalTitle>Decline Report</CModalTitle>
      </CModalHeader>
      <CModalBody>
        <p className="text-body-secondary mb-3">
          Please provide a reason for declining this report. The field personnel will see this
          reason and can resubmit with corrections.
        </p>
        <CFormLabel htmlFor="decline-reason" className="fw-medium">
          Decline Reason <span className="text-danger">*</span>
        </CFormLabel>
        <CFormTextarea
          id="decline-reason"
          rows={4}
          placeholder="e.g. Receipt image is blurry, please re-upload a clear photo..."
          value={reason}
          onChange={(e) => {
            setReason(e.target.value)
            if (error) setError('')
          }}
          invalid={!!error}
        />
        {error && <CFormFeedback invalid>{error}</CFormFeedback>}
        <div className="text-body-tertiary mt-1" style={{ fontSize: '0.75rem' }}>
          {reason.length} characters (minimum 10)
        </div>
      </CModalBody>
      <CModalFooter>
        <CButton color="secondary" variant="ghost" onClick={handleClose} disabled={loading}>
          Cancel
        </CButton>
        <CButton color="danger" onClick={handleConfirm} disabled={loading}>
          {loading ? (
            <>
              <CSpinner size="sm" className="me-1" />
              Declining...
            </>
          ) : (
            'Confirm Decline'
          )}
        </CButton>
      </CModalFooter>
    </CModal>
  )
}

DeclineReasonModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  loading: PropTypes.bool,
}

export default DeclineReasonModal
