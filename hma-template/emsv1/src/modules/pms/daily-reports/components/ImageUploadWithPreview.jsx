/**
 * ImageUploadWithPreview — Multi-file upload with thumbnail strip.
 *
 * Accepts JPG/PNG/PDF, max 5MB each, up to 5 files.
 * Stores as base64 data URLs (swap to FormData + S3 later).
 */
import React, { useRef, useCallback } from 'react'
import PropTypes from 'prop-types'
import { CButton, CAlert } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilCloudUpload, cilTrash, cilFile } from '@coreui/icons'

const MAX_FILES = 5
const MAX_SIZE = 5 * 1024 * 1024 // 5MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'application/pdf']
const ACCEPTED_EXT = '.jpg,.jpeg,.png,.pdf'

const ImageUploadWithPreview = ({ value = [], onChange, maxFiles = MAX_FILES }) => {
  const inputRef = useRef(null)
  const [error, setError] = React.useState(null)

  const fileToBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () =>
        resolve({
          file_url: reader.result,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
        })
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

  const handleFiles = useCallback(
    async (files) => {
      setError(null)
      const remaining = maxFiles - value.length

      if (remaining <= 0) {
        setError(`Maximum ${maxFiles} files allowed`)
        return
      }

      const validFiles = []
      for (const file of Array.from(files).slice(0, remaining)) {
        if (!ACCEPTED_TYPES.includes(file.type)) {
          setError(`${file.name}: Only JPG, PNG, and PDF files are accepted`)
          continue
        }
        if (file.size > MAX_SIZE) {
          setError(`${file.name}: File exceeds 5MB limit`)
          continue
        }
        validFiles.push(file)
      }

      if (validFiles.length > 0) {
        const newAttachments = await Promise.all(validFiles.map(fileToBase64))
        onChange([...value, ...newAttachments])
      }
    },
    [value, onChange, maxFiles],
  )

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault()
      e.stopPropagation()
      handleFiles(e.dataTransfer.files)
    },
    [handleFiles],
  )

  const handleRemove = (index) => {
    const updated = value.filter((_, i) => i !== index)
    onChange(updated)
  }

  const isPdf = (item) => item.file_type === 'application/pdf'

  return (
    <div className="image-upload-container">
      {/* Drop zone */}
      <div
        className="upload-dropzone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <CIcon icon={cilCloudUpload} size="xl" className="text-body-secondary mb-2" />
        <div className="small text-body-secondary">
          <strong>Click to upload</strong> or drag and drop
        </div>
        <div className="text-body-tertiary" style={{ fontSize: '0.75rem' }}>
          JPG, PNG, or PDF (max 5MB, up to {maxFiles} files)
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_EXT}
          multiple
          className="d-none"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {error && (
        <CAlert
          color="danger"
          className="py-1 px-2 mt-2 mb-0 small"
          dismissible
          onClose={() => setError(null)}
        >
          {error}
        </CAlert>
      )}

      {/* Preview strip */}
      {value.length > 0 && (
        <div className="upload-preview-strip mt-2">
          {value.map((item, idx) => (
            <div key={idx} className="upload-preview-item">
              {isPdf(item) ? (
                <div className="upload-preview-pdf">
                  <CIcon icon={cilFile} size="lg" />
                  <span className="small text-truncate d-block" style={{ maxWidth: '80px' }}>
                    {item.file_name}
                  </span>
                </div>
              ) : (
                <img src={item.file_url} alt={item.file_name} className="upload-preview-img" />
              )}
              <CButton
                color="danger"
                variant="ghost"
                size="sm"
                className="upload-preview-remove"
                onClick={(e) => {
                  e.stopPropagation()
                  handleRemove(idx)
                }}
              >
                <CIcon icon={cilTrash} size="sm" />
              </CButton>
            </div>
          ))}
        </div>
      )}

      {value.length > 0 && (
        <div className="text-body-tertiary mt-1" style={{ fontSize: '0.75rem' }}>
          {value.length}/{maxFiles} files uploaded
        </div>
      )}
    </div>
  )
}

ImageUploadWithPreview.propTypes = {
  value: PropTypes.arrayOf(
    PropTypes.shape({
      file_url: PropTypes.string,
      file_name: PropTypes.string,
      file_type: PropTypes.string,
    }),
  ),
  onChange: PropTypes.func.isRequired,
  maxFiles: PropTypes.number,
}

export default ImageUploadWithPreview
