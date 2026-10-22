import React, { useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilCloudUpload, cilFile, cilTrash } from '@coreui/icons'
import { localProjectDocuments } from '../../../services/localProjectDocuments'

const fmtSize = (bytes) => {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const fmtDate = (iso) => new Date(iso).toLocaleString('en-IN')

const ProjectDocumentsPanel = ({ project, canEdit = false, currentUser = 'Unknown' }) => {
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [removeTarget, setRemoveTarget] = useState(null)
  const [removing, setRemoving] = useState(false)
  const fileInputRef = useRef(null)

  const reload = () => {
    setLoading(true)
    localProjectDocuments
      .list(project.id)
      .then(setDocs)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true) // eslint-disable-line react-hooks/set-state-in-effect
    localProjectDocuments
      .list(project.id)
      .then((rows) => {
        if (!cancelled) setDocs(rows)
      })
      .catch((e) => {
        if (!cancelled) setError(e.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [project.id])

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || [])
    if (!files.length) return
    setError('')
    setUploading(true)
    try {
      for (const file of files) {
        await localProjectDocuments.upload(project.id, file, currentUser)
      }
      reload()
    } catch (e) {
      setError(e.message)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDownload = async (doc) => {
    setError('')
    try {
      const url = await localProjectDocuments.getDownloadUrl(doc.storage_path)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (e) {
      setError(e.message)
    }
  }

  const handleRemove = async () => {
    if (!removeTarget) return
    setRemoving(true)
    setError('')
    try {
      await localProjectDocuments.remove(removeTarget)
      setRemoveTarget(null)
      reload()
    } catch (e) {
      setError(e.message)
    } finally {
      setRemoving(false)
    }
  }

  return (
    <CCard className="border-0 shadow-sm" style={{ borderRadius: '10px' }}>
      <CCardHeader className="bg-transparent fw-semibold">Documents</CCardHeader>
      <CCardBody>
        {canEdit && (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              handleFiles(e.dataTransfer.files)
            }}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: '2px dashed var(--cui-border-color)',
              borderRadius: 8,
              padding: '28px 24px',
              textAlign: 'center',
              cursor: uploading ? 'wait' : 'pointer',
              background: 'var(--cui-tertiary-bg, #f8f9fa)',
              marginBottom: '1rem',
            }}
          >
            {uploading ? (
              <CSpinner size="sm" />
            ) : (
              <>
                <CIcon icon={cilCloudUpload} style={{ width: 28, height: 28, opacity: 0.4 }} />
                <div className="mt-2 fw-semibold small">Drop files here, or click to browse</div>
                <div className="text-body-secondary" style={{ fontSize: '0.72rem' }}>
                  Any file type, up to 25 MB each
                </div>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              style={{ display: 'none' }}
              disabled={uploading}
              onChange={(e) => handleFiles(e.target.files)}
            />
          </div>
        )}

        {error && (
          <CAlert color="danger" className="small py-2">
            {error}
          </CAlert>
        )}

        {loading ? (
          <div className="text-body-secondary small">Loading documents…</div>
        ) : docs.length === 0 ? (
          <div className="text-body-secondary small">No documents uploaded yet.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <CTable hover small responsive className="mb-0">
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>File</CTableHeaderCell>
                  <CTableHeaderCell>Size</CTableHeaderCell>
                  <CTableHeaderCell>Uploaded</CTableHeaderCell>
                  <CTableHeaderCell>By</CTableHeaderCell>
                  <CTableHeaderCell className="text-end">Actions</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {docs.map((doc) => (
                  <CTableRow key={doc.id}>
                    <CTableDataCell>
                      <CIcon icon={cilFile} className="me-2 text-body-secondary" />
                      {doc.file_name}
                    </CTableDataCell>
                    <CTableDataCell className="small text-body-secondary">
                      {fmtSize(doc.size_bytes)}
                    </CTableDataCell>
                    <CTableDataCell className="small text-body-secondary">
                      {fmtDate(doc.uploaded_at)}
                    </CTableDataCell>
                    <CTableDataCell className="small text-body-secondary">
                      {doc.uploaded_by_name}
                    </CTableDataCell>
                    <CTableDataCell className="text-end">
                      <CButton
                        size="sm"
                        color="primary"
                        variant="outline"
                        className="me-2"
                        onClick={() => handleDownload(doc)}
                      >
                        Download
                      </CButton>
                      {canEdit && (
                        <CButton
                          size="sm"
                          color="danger"
                          variant="ghost"
                          onClick={() => setRemoveTarget(doc)}
                        >
                          <CIcon icon={cilTrash} size="sm" />
                        </CButton>
                      )}
                    </CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          </div>
        )}
      </CCardBody>

      <CModal
        visible={Boolean(removeTarget)}
        onClose={() => setRemoveTarget(null)}
        alignment="center"
        size="sm"
      >
        <CModalHeader>
          <CModalTitle>Delete document?</CModalTitle>
        </CModalHeader>
        <CModalBody className="small">
          This permanently deletes &quot;{removeTarget?.file_name}&quot;. This cannot be undone.
        </CModalBody>
        <CModalFooter>
          <CButton
            color="secondary"
            variant="ghost"
            size="sm"
            onClick={() => setRemoveTarget(null)}
          >
            Cancel
          </CButton>
          <CButton color="danger" size="sm" onClick={handleRemove} disabled={removing}>
            {removing ? <CSpinner size="sm" /> : 'Delete'}
          </CButton>
        </CModalFooter>
      </CModal>
    </CCard>
  )
}

ProjectDocumentsPanel.propTypes = {
  project: PropTypes.object.isRequired,
  canEdit: PropTypes.bool,
  currentUser: PropTypes.string,
}

export default ProjectDocumentsPanel
