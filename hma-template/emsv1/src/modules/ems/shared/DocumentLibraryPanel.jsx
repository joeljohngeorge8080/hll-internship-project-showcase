import React, { useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CFormInput,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CSpinner,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import {
  cilCloudUpload,
  cilCloudDownload,
  cilExternalLink,
  cilImage,
  cilTrash,
} from '@coreui/icons'

const fmtSize = (bytes) => {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

const isPreviewable = (mimeType) =>
  Boolean(mimeType) && (mimeType.startsWith('image/') || mimeType === 'application/pdf')

const isImage = (mimeType) => Boolean(mimeType) && mimeType.startsWith('image/')

// File-type → badge color. The color encodes real information (what kind of
// file this is, at a glance in a dense grid), not decoration — reuses hues
// already meaningful elsewhere in the app (blue = primary, green = PMS
// accent, orange = --hma-accent-orange) plus two additions (red, purple)
// for categories with no existing token.
const FILE_TYPE_META = {
  pdf: { label: 'PDF', rgb: '211, 47, 47' },
  doc: { label: 'DOC', rgb: '9, 114, 211' },
  docx: { label: 'DOC', rgb: '9, 114, 211' },
  xls: { label: 'XLS', rgb: '16, 185, 129' },
  xlsx: { label: 'XLS', rgb: '16, 185, 129' },
  csv: { label: 'CSV', rgb: '16, 185, 129' },
  ppt: { label: 'PPT', rgb: '236, 114, 17' },
  pptx: { label: 'PPT', rgb: '236, 114, 17' },
  zip: { label: 'ZIP', rgb: '124, 58, 237' },
  rar: { label: 'RAR', rgb: '124, 58, 237' },
  '7z': { label: '7Z', rgb: '124, 58, 237' },
  txt: { label: 'TXT', rgb: '100, 116, 139' },
}
const DEFAULT_FILE_TYPE = { label: 'FILE', rgb: '100, 116, 139' }

const fileTypeMeta = (fileName) => {
  const match = /\.([a-z0-9]+)$/i.exec(fileName || '')
  const ext = match ? match[1].toLowerCase() : ''
  return FILE_TYPE_META[ext] || DEFAULT_FILE_TYPE
}

/**
 * Generic page-level file library: upload any file type to a Supabase
 * storage bucket, browse it as a card grid with preview/view/download/delete
 * actions. Backed by a documentsService with the shape of
 * localInternshipDocuments.js / localRecruitmentDocuments.js /
 * localLsgbDocuments.js (list/upload/remove/getSignedUrl).
 */
const DocumentLibraryPanel = ({
  documentsService,
  title = 'Files',
  canEdit = false,
  currentUser = 'Unknown',
}) => {
  const [docs, setDocs] = useState([])
  const [thumbUrls, setThumbUrls] = useState({})
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState('')
  const [removeTarget, setRemoveTarget] = useState(null)
  const [removing, setRemoving] = useState(false)
  const [preview, setPreview] = useState(null) // { doc, url }
  const [previewLoading, setPreviewLoading] = useState(false)
  const fileInputRef = useRef(null)

  const reload = () => {
    setLoading(true)
    documentsService
      .list()
      .then(setDocs)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true) // eslint-disable-line react-hooks/set-state-in-effect
    documentsService
      .list()
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
  }, [documentsService])

  // Thumbnails: fetch a signed URL once per image file so the card grid can
  // render an actual preview instead of a generic icon. The URL only needs
  // to stay valid long enough for the browser's initial fetch — once the
  // <img> has loaded, the rendered bitmap doesn't care that the signed URL
  // later expires.
  useEffect(() => {
    let cancelled = false
    const pending = docs.filter((d) => isImage(d.mime_type) && !(d.id in thumbUrls))
    if (!pending.length) return
    Promise.all(
      pending.map((d) =>
        documentsService
          .getSignedUrl(d.storage_path)
          .then((url) => [d.id, url])
          .catch(() => null),
      ),
    ).then((pairs) => {
      if (cancelled) return
      const next = {}
      pairs.forEach((p) => {
        if (p) next[p[0]] = p[1]
      })
      if (Object.keys(next).length) setThumbUrls((prev) => ({ ...prev, ...next }))
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docs])

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || [])
    if (!files.length) return
    setError('')
    setUploading(true)
    try {
      for (const file of files) {
        await documentsService.upload(file, currentUser)
      }
      reload()
    } catch (e) {
      setError(e.message)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handlePreview = async (doc) => {
    setError('')
    setPreviewLoading(true)
    try {
      const url = await documentsService.getSignedUrl(doc.storage_path)
      setPreview({ doc, url })
    } catch (e) {
      setError(e.message)
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleView = async (doc) => {
    setError('')
    try {
      const url = await documentsService.getSignedUrl(doc.storage_path)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (e) {
      setError(e.message)
    }
  }

  const handleDownload = async (doc) => {
    setError('')
    try {
      const url = await documentsService.getSignedUrl(doc.storage_path, { download: doc.file_name })
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
      await documentsService.remove(removeTarget)
      setRemoveTarget(null)
      reload()
    } catch (e) {
      setError(e.message)
    } finally {
      setRemoving(false)
    }
  }

  const filteredDocs = docs.filter((d) =>
    d.file_name.toLowerCase().includes(query.trim().toLowerCase()),
  )
  const totalSize = docs.reduce((sum, d) => sum + (d.size_bytes || 0), 0)

  return (
    <CCard className="mb-3">
      <CCardHeader className="fw-semibold">{title}</CCardHeader>
      <CCardBody>
        <div className="hma-file-toolbar">
          {canEdit && (
            <div
              className={`hma-file-dropzone${dragActive ? ' hma-file-dropzone--active' : ''}`}
              onDragOver={(e) => {
                e.preventDefault()
                setDragActive(true)
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragActive(false)
                handleFiles(e.dataTransfer.files)
              }}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
            >
              {uploading ? (
                <CSpinner size="sm" />
              ) : (
                <>
                  <CIcon icon={cilCloudUpload} size="sm" />
                  <span>Drop files or click to upload</span>
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

          {docs.length > 0 && (
            <CFormInput
              size="sm"
              className="hma-file-search"
              placeholder="Search files..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          )}

          {docs.length > 0 && (
            <span className="hma-file-count">
              {docs.length} file{docs.length === 1 ? '' : 's'} · {fmtSize(totalSize)}
            </span>
          )}
        </div>

        {error && (
          <CAlert color="danger" className="small py-2">
            {error}
          </CAlert>
        )}

        {loading ? (
          <div className="text-body-secondary small">Loading files…</div>
        ) : docs.length === 0 ? (
          <div className="hma-empty-state">
            <CIcon icon={cilCloudUpload} className="hma-empty-state__icon" />
            <div className="hma-empty-state__title">No files yet</div>
            <div className="hma-empty-state__desc">
              {canEdit
                ? 'Drop a file above, or click to browse.'
                : 'Nothing has been uploaded here yet.'}
            </div>
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="hma-empty-state">
            <div className="hma-empty-state__title">No matches</div>
            <div className="hma-empty-state__desc">No file names match &quot;{query}&quot;.</div>
          </div>
        ) : (
          <div className="hma-file-grid">
            {filteredDocs.map((doc) => {
              const typeMeta = fileTypeMeta(doc.file_name)
              const thumb = thumbUrls[doc.id]
              return (
                <div className="hma-file-card" key={doc.id}>
                  <div className="hma-file-card__thumb">
                    {thumb ? (
                      <img src={thumb} alt="" loading="lazy" />
                    ) : (
                      <span
                        className="hma-file-card__badge"
                        style={{ '--badge-rgb': typeMeta.rgb }}
                      >
                        {typeMeta.label}
                      </span>
                    )}
                  </div>
                  <div className="hma-file-card__body">
                    <div className="hma-file-card__name" title={doc.file_name}>
                      {doc.file_name}
                    </div>
                    <div className="hma-file-card__meta">
                      {fmtSize(doc.size_bytes)} · {fmtDate(doc.uploaded_at)}
                    </div>
                  </div>
                  <div className="hma-file-card__actions">
                    {isPreviewable(doc.mime_type) && (
                      <button
                        type="button"
                        className="hma-file-card__action"
                        title="Preview"
                        onClick={() => handlePreview(doc)}
                      >
                        <CIcon icon={cilImage} size="sm" />
                      </button>
                    )}
                    <button
                      type="button"
                      className="hma-file-card__action"
                      title="View in new tab"
                      onClick={() => handleView(doc)}
                    >
                      <CIcon icon={cilExternalLink} size="sm" />
                    </button>
                    <button
                      type="button"
                      className="hma-file-card__action"
                      title="Download"
                      onClick={() => handleDownload(doc)}
                    >
                      <CIcon icon={cilCloudDownload} size="sm" />
                    </button>
                    {canEdit && (
                      <button
                        type="button"
                        className="hma-file-card__action hma-file-card__action--danger"
                        title="Delete"
                        onClick={() => setRemoveTarget(doc)}
                      >
                        <CIcon icon={cilTrash} size="sm" />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CCardBody>

      <CModal
        visible={Boolean(preview)}
        onClose={() => setPreview(null)}
        alignment="center"
        size="lg"
      >
        <CModalHeader>
          <CModalTitle className="small">{preview?.doc?.file_name}</CModalTitle>
        </CModalHeader>
        <CModalBody className="text-center">
          {previewLoading ? (
            <CSpinner size="sm" />
          ) : preview?.doc?.mime_type === 'application/pdf' ? (
            <iframe
              title="preview"
              src={preview.url}
              style={{ width: '100%', height: '70vh', border: 0 }}
            />
          ) : (
            <img
              src={preview?.url}
              alt={preview?.doc?.file_name}
              style={{ maxWidth: '100%', maxHeight: '70vh' }}
            />
          )}
        </CModalBody>
      </CModal>

      <CModal
        visible={Boolean(removeTarget)}
        onClose={() => setRemoveTarget(null)}
        alignment="center"
        size="sm"
      >
        <CModalHeader>
          <CModalTitle>Delete file?</CModalTitle>
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

DocumentLibraryPanel.propTypes = {
  documentsService: PropTypes.shape({
    list: PropTypes.func.isRequired,
    upload: PropTypes.func.isRequired,
    remove: PropTypes.func.isRequired,
    getSignedUrl: PropTypes.func.isRequired,
  }).isRequired,
  title: PropTypes.string,
  canEdit: PropTypes.bool,
  currentUser: PropTypes.string,
}

export default DocumentLibraryPanel
