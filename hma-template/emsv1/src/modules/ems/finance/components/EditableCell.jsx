import React, { useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'

// Excel-style click-to-edit cell body. Renders plain text; clicking (when not
// disabled) swaps in an input. Enter/blur commits via onCommit, Esc cancels.
// type="number" rejects negative or non-numeric drafts (old value restored).
const EditableCell = ({ value = '', onCommit, type = 'text', disabled = false, listId }) => {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const startEdit = () => {
    if (disabled) return
    setDraft(value == null ? '' : String(value))
    setEditing(true)
  }

  if (!editing) {
    return (
      <div
        role={disabled ? undefined : 'button'}
        tabIndex={disabled ? undefined : 0}
        onClick={startEdit}
        onKeyDown={(e) => e.key === 'Enter' && startEdit()}
        style={{ minHeight: '1.4rem', minWidth: '3rem', cursor: disabled ? 'default' : 'text' }}
      >
        {value == null || value === '' ? ' ' : String(value)}
      </div>
    )
  }

  const commit = () => {
    setEditing(false)
    if (type === 'number') {
      const n = Number(draft)
      if (!Number.isFinite(n) || n < 0) return // invalid → keep the old value
      if (n !== Number(value)) onCommit(n)
      return
    }
    const v = String(draft).trim()
    if (v !== String(value ?? '')) onCommit(v)
  }

  return (
    <input
      ref={inputRef}
      className="form-control form-control-sm"
      style={{ minWidth: '6rem' }}
      type={type === 'date' ? 'date' : 'text'}
      inputMode={type === 'number' ? 'decimal' : undefined}
      list={listId}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit()
        if (e.key === 'Escape') setEditing(false)
      }}
    />
  )
}

EditableCell.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onCommit: PropTypes.func.isRequired,
  type: PropTypes.oneOf(['text', 'number', 'date']),
  disabled: PropTypes.bool,
  listId: PropTypes.string,
}

export default EditableCell
