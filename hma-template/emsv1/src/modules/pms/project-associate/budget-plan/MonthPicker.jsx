import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { CButton, CFormCheck, CPopover } from '@coreui/react'

const monthLabel = (ym) => {
  if (!ym) return '—'
  const [y, m] = ym.split('-')
  return new Date(y, m - 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
}

const MonthPicker = ({ months, excludeMonth, label, onConfirm, disabled = false }) => {
  const [open, setOpen] = useState(false)
  const [checked, setChecked] = useState([])
  const options = months.filter((m) => m !== excludeMonth)

  const toggle = (m) =>
    setChecked((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]))

  const handleConfirm = () => {
    if (checked.length === 0) return
    onConfirm(checked)
    setChecked([])
    setOpen(false)
  }

  if (options.length === 0) return null

  return (
    <CPopover
      visible={open}
      onHide={() => setOpen(false)}
      placement="bottom"
      content={
        <div style={{ minWidth: 180 }}>
          {options.map((m) => (
            <CFormCheck
              key={m}
              id={`mp-${m}-${label}`}
              label={monthLabel(m)}
              checked={checked.includes(m)}
              onChange={() => toggle(m)}
              className="mb-1"
            />
          ))}
          <CButton size="sm" color="primary" className="mt-2 w-100" onClick={handleConfirm}>
            Confirm ({checked.length} selected — split equally)
          </CButton>
        </div>
      }
    >
      <CButton
        size="sm"
        color="secondary"
        variant="outline"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        {label}
      </CButton>
    </CPopover>
  )
}

MonthPicker.propTypes = {
  months: PropTypes.arrayOf(PropTypes.string).isRequired,
  excludeMonth: PropTypes.string,
  label: PropTypes.string.isRequired,
  onConfirm: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
}

export default MonthPicker
