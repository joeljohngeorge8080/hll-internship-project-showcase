import React, { useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import CIcon from '@coreui/icons-react'
import { cilCamera } from '@coreui/icons'

// Deterministic colour per name so avatars always look the same
const PALETTE = [
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#f97316',
  '#10b981',
  '#06b6d4',
  '#6366f1',
  '#ef4444',
]
const pickColor = (str = '') => PALETTE[(str.charCodeAt(0) || 0) % PALETTE.length]

const toInitials = (name = '') => {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return (name[0] || '?').toUpperCase()
}

// size      — pixel diameter (default 96 for forms, 64 for list)
// canEdit   — show camera overlay button
// onChange  — called with the raw File when a new file is picked; the caller
//             is responsible for uploading it (see localEmployeePhotos.js)

const ProfilePhotoUpload = ({ photo, name, size = 96, canEdit, onChange }) => {
  const inputRef = useRef(null)
  // Instant local preview while the caller's upload is still in flight —
  // avoids waiting on a network round trip just to see the picked photo.
  const [previewUrl, setPreviewUrl] = useState(null)

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const handleFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      alert('Profile photo must be under 2 MB')
      return
    }
    setPreviewUrl(URL.createObjectURL(file))
    onChange(file)
    e.target.value = '' // allow re-selecting the same file
  }

  const displaySrc = previewUrl || photo
  const bg = pickColor(name)
  const ini = toInitials(name)
  const border = '3px solid var(--cui-border-color, #dee2e6)'
  const radius = '50%'

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      {displaySrc ? (
        <img
          src={displaySrc}
          alt={name || 'Employee'}
          style={{
            width: size,
            height: size,
            borderRadius: radius,
            objectFit: 'cover',
            border,
            display: 'block',
          }}
        />
      ) : (
        <div
          aria-label={name || 'Employee avatar'}
          style={{
            width: size,
            height: size,
            borderRadius: radius,
            background: bg,
            border,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: Math.round(size * 0.34),
            fontWeight: 700,
            userSelect: 'none',
          }}
        >
          {ini}
        </div>
      )}

      {canEdit && (
        <button
          type="button"
          title="Change profile photo"
          onClick={() => inputRef.current?.click()}
          style={{
            position: 'absolute',
            bottom: 1,
            right: 1,
            width: Math.round(size * 0.3),
            height: Math.round(size * 0.3),
            borderRadius: '50%',
            background: 'var(--cui-primary, #0d6efd)',
            border: '2px solid var(--cui-body-bg, #fff)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            boxShadow: '0 1px 4px rgba(0,0,0,.25)',
          }}
        >
          <CIcon
            icon={cilCamera}
            style={{
              color: '#fff',
              width: Math.round(size * 0.15),
              height: Math.round(size * 0.15),
            }}
          />
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={handleFile}
      />
    </div>
  )
}

ProfilePhotoUpload.propTypes = {
  photo: PropTypes.string,
  name: PropTypes.string,
  size: PropTypes.number,
  canEdit: PropTypes.bool.isRequired,
  onChange: PropTypes.func.isRequired,
}

export default ProfilePhotoUpload
