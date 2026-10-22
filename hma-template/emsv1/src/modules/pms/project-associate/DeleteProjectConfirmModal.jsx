/**
 * DeleteProjectConfirmModal.jsx — AWS-style destructive-action confirmation.
 * Delete is only enabled once the user types the project's exact name.
 */
import React, { useState } from 'react'
import {
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CButton,
  CFormInput,
  CAlert,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilTrash, cilWarning } from '@coreui/icons'

const DeleteProjectConfirmModal = ({ visible, project, onClose, onConfirm }) => {
  const [confirmText, setConfirmText] = useState('')
  const [prevVisible, setPrevVisible] = useState(visible)

  // Reset the typed text whenever the modal transitions to visible, without
  // an effect (adjusting state during render, per React's own guidance).
  if (visible !== prevVisible) {
    setPrevVisible(visible)
    if (visible) setConfirmText('')
  }

  const projectName = project?.name || project?.title || ''
  const confirmWord = projectName.split(/\s+/)[0] || projectName
  const isMatch = confirmText.length > 0 && confirmText === confirmWord

  return (
    <CModal visible={visible} onClose={onClose} alignment="center">
      <CModalHeader>
        <CModalTitle>Delete Project</CModalTitle>
      </CModalHeader>
      <CModalBody>
        <CAlert color="danger" className="d-flex align-items-start gap-2">
          <CIcon icon={cilWarning} className="flex-shrink-0 mt-1" />
          <div>
            This permanently deletes <strong>{projectName}</strong> and all of its milestones,
            installments, monthly plans, and expense records. This action cannot be undone.
          </div>
        </CAlert>
        <label className="form-label small text-body-secondary">
          Type <strong>{confirmWord}</strong> to confirm
        </label>
        <CFormInput
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder={confirmWord}
          autoFocus
        />
      </CModalBody>
      <CModalFooter>
        <CButton color="secondary" variant="ghost" onClick={onClose}>
          Cancel
        </CButton>
        <CButton color="danger" disabled={!isMatch} onClick={onConfirm}>
          <CIcon icon={cilTrash} className="me-1" />
          Delete Project
        </CButton>
      </CModalFooter>
    </CModal>
  )
}

export default DeleteProjectConfirmModal
