import React, { useCallback, useEffect, useState } from 'react'
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CFormInput,
  CFormSelect,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
} from '@coreui/react'

import { usePermission } from '../../../hooks/usePermission'
import { MODULE } from '../../../constants/modules'
import { localHolidays } from '../../../services/localHolidays'
import { localAttendance } from '../../../services/localAttendance'

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const pad = (n) => String(n).padStart(2, '0')

const TODAY = new Date().toISOString().slice(0, 10)
const _thisYear = new Date().getFullYear()
const _thisMonth = new Date().getMonth() + 1
const CAL_YEARS = Array.from({ length: 5 }, (_, i) => _thisYear - 1 + i)

const CELL_BG = {
  sunday: '#f3f4f6',
  saturday: '#f3f4f6',
  custom: '#fffbeb',
  working: '#ffffff',
  empty: '#fafafa',
}

const HOLIDAY_PILL = {
  sunday: { bg: '#e5e7eb', text: '#6b7280' },
  saturday: { bg: '#e5e7eb', text: '#6b7280' },
  custom: { bg: '#fde68a', text: '#92400e' },
}

const GeneralCalendar = ({ year: initialYear, month: initialMonth }) => {
  // Test deployment: auto-deploy to Docker Hub on master2 push
  const canEdit = usePermission(MODULE.ATTENDANCE, 'edit')

  const [year, setYear] = useState(initialYear || _thisYear)
  const [month, setMonth] = useState(initialMonth || _thisMonth)
  const [holidayMap, setHolidayMap] = useState({})
  const [hoveredDate, setHoveredDate] = useState(null)
  const [addDate, setAddDate] = useState(null)
  const [addName, setAddName] = useState('')
  const [addError, setAddError] = useState('')

  const reload = useCallback(async () => {
    setHolidayMap(await localHolidays.getMonthMap(year, month))
  }, [year, month])

  useEffect(() => {
    let cancelled = false
    localHolidays.getMonthMap(year, month).then((map) => {
      if (!cancelled) setHolidayMap(map)
    })
    return () => {
      cancelled = true
    }
  }, [year, month])

  const handlePrevMonth = () => {
    if (month === 1) {
      setMonth(12)
      setYear((y) => y - 1)
    } else {
      setMonth((m) => m - 1)
    }
  }

  const handleNextMonth = () => {
    if (month === 12) {
      setMonth(1)
      setYear((y) => y + 1)
    } else {
      setMonth((m) => m + 1)
    }
  }

  // Build grid
  const daysInMonth = new Date(year, month, 0).getDate()
  const firstDow = new Date(year, month - 1, 1).getDay()
  const startOffset = (firstDow + 6) % 7
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7
  const cells = []
  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - startOffset + 1
    cells.push(dayNum >= 1 && dayNum <= daysInMonth ? dayNum : null)
  }
  const weeks = []
  for (let r = 0; r < cells.length / 7; r++) {
    weeks.push(cells.slice(r * 7, r * 7 + 7))
  }

  const handleCellClick = (dateStr) => {
    if (!canEdit || holidayMap[dateStr]) return
    setAddDate(dateStr)
    setAddName('')
    setAddError('')
  }

  const handleAddSave = async () => {
    if (!addName.trim()) {
      setAddError('Please enter a holiday name.')
      return
    }
    let created = null
    try {
      created = await localHolidays.addHoliday({ date: addDate, name: addName })
      await localAttendance.applyHolidayToDate(addDate, addName)
      setAddDate(null)
      reload()
    } catch (e) {
      // Roll back the holiday row if it was inserted but applying it to
      // attendance failed, so a partial failure never leaves an orphaned
      // custom holiday that silently blocks re-adding the same date.
      if (created) {
        try {
          await localHolidays.deleteHoliday(created.id)
        } catch {
          // best-effort rollback; surface the original error below regardless
        }
      }
      setAddError(e.message)
      reload()
    }
  }

  const handleDelete = async (e, id, dateStr) => {
    e.stopPropagation()
    await localHolidays.deleteHoliday(id)
    if (dateStr) await localAttendance.revertHolidayFromDate(dateStr)
    reload()
  }

  const sundayCount = Object.values(holidayMap).filter((h) => h.type === 'sunday').length
  const satCount = Object.values(holidayMap).filter((h) => h.type === 'saturday').length
  const customCount = Object.values(holidayMap).filter((h) => h.type === 'custom').length

  return (
    <>
      <CCard className="shadow-sm">
        <CCardHeader className="py-3">
          {/* Top row: title + navigation */}
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-3 mb-2">
            <strong className="fs-6">General Holiday Calendar</strong>

            {/* Month / Year navigation */}
            <div className="d-flex align-items-center gap-2">
              <CButton
                color="secondary"
                variant="outline"
                size="sm"
                onClick={handlePrevMonth}
                style={{ lineHeight: 1, padding: '3px 9px', fontWeight: 700 }}
              >
                ‹
              </CButton>

              <CFormSelect
                size="sm"
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                style={{ width: 130 }}
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </CFormSelect>

              <CFormSelect
                size="sm"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                style={{ width: 90 }}
              >
                {CAL_YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </CFormSelect>

              <CButton
                color="secondary"
                variant="outline"
                size="sm"
                onClick={handleNextMonth}
                style={{ lineHeight: 1, padding: '3px 9px', fontWeight: 700 }}
              >
                ›
              </CButton>
            </div>
          </div>

          {/* Bottom row: legend + hint */}
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div className="small text-body-secondary">
              <span className="me-2">
                <span
                  style={{
                    display: 'inline-block',
                    width: 10,
                    height: 10,
                    background: '#e5e7eb',
                    borderRadius: 2,
                    marginRight: 4,
                    verticalAlign: 'middle',
                  }}
                />
                {sundayCount} Sunday{sundayCount !== 1 ? 's' : ''}
              </span>
              <span className="me-2">
                <span
                  style={{
                    display: 'inline-block',
                    width: 10,
                    height: 10,
                    background: '#e5e7eb',
                    borderRadius: 2,
                    marginRight: 4,
                    verticalAlign: 'middle',
                  }}
                />
                {satCount} 2nd/4th Saturday{satCount !== 1 ? 's' : ''}
              </span>
              <span>
                <span
                  style={{
                    display: 'inline-block',
                    width: 10,
                    height: 10,
                    background: '#fde68a',
                    borderRadius: 2,
                    marginRight: 4,
                    verticalAlign: 'middle',
                  }}
                />
                {customCount} custom holiday{customCount !== 1 ? 's' : ''}
              </span>
            </div>
            {canEdit && (
              <span className="text-body-secondary small fst-italic">
                Click any working day to mark as holiday
              </span>
            )}
          </div>
        </CCardHeader>

        <CCardBody className="p-0">
          {/* Day header row */}
          <div
            style={{
              display: 'flex',
              background: '#f8f9fa',
              borderBottom: '2px solid #dee2e6',
            }}
          >
            {DAY_LABELS.map((label, i) => (
              <div
                key={label}
                style={{
                  width: '14.28%',
                  textAlign: 'center',
                  fontWeight: 700,
                  fontSize: 11,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  padding: '10px 0',
                  color: i >= 5 ? '#9ca3af' : '#374151',
                }}
              >
                {label}
              </div>
            ))}
          </div>

          {/* Calendar weeks */}
          {weeks.map((week, wi) => (
            <div key={wi} style={{ display: 'flex', borderBottom: '1px solid #f3f4f6' }}>
              {week.map((dayNum, di) => {
                if (!dayNum) {
                  return (
                    <div
                      key={di}
                      style={{
                        width: '14.28%',
                        minHeight: 90,
                        background: CELL_BG.empty,
                        borderRight: '1px solid #f3f4f6',
                      }}
                    />
                  )
                }

                const dateStr = `${year}-${pad(month)}-${pad(dayNum)}`
                const h = holidayMap[dateStr]
                const isCustom = h?.type === 'custom'
                const isClickable = canEdit && !h
                const isToday = dateStr === TODAY
                const isHovered = hoveredDate === dateStr
                const pill = h ? HOLIDAY_PILL[h.type] : null

                return (
                  <div
                    key={di}
                    onClick={() => isClickable && handleCellClick(dateStr)}
                    onMouseEnter={() => isClickable && setHoveredDate(dateStr)}
                    onMouseLeave={() => setHoveredDate(null)}
                    title={isClickable ? 'Click to mark as holiday' : undefined}
                    style={{
                      width: '14.28%',
                      minHeight: 90,
                      borderRight: '1px solid #f3f4f6',
                      background: isHovered ? '#eff6ff' : h ? CELL_BG[h.type] : CELL_BG.working,
                      cursor: isClickable ? 'pointer' : 'default',
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      padding: '10px 6px 8px',
                      transition: 'background 0.12s',
                    }}
                  >
                    {/* Date circle */}
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: '50%',
                        background: isToday ? '#2563eb' : 'transparent',
                        border: isToday ? 'none' : '2px solid transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: isToday ? 700 : 600,
                        fontSize: 15,
                        color: isToday ? '#ffffff' : h ? '#6b7280' : '#111827',
                        marginBottom: 6,
                        flexShrink: 0,
                      }}
                    >
                      {dayNum}
                    </div>

                    {/* Holiday label pill */}
                    {h && (
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 500,
                          color: pill.text,
                          background: pill.bg,
                          borderRadius: 4,
                          padding: '2px 6px',
                          textAlign: 'center',
                          lineHeight: 1.4,
                          maxWidth: '100%',
                          wordBreak: 'break-word',
                        }}
                      >
                        {h.name}
                      </div>
                    )}

                    {/* Hover hint for working days */}
                    {isHovered && (
                      <div
                        style={{
                          fontSize: 10,
                          color: '#2563eb',
                          marginTop: 4,
                          fontWeight: 500,
                        }}
                      >
                        + Add holiday
                      </div>
                    )}

                    {/* Delete button for custom holidays */}
                    {isCustom && canEdit && (
                      <button
                        onClick={(e) => handleDelete(e, h.id, dateStr)}
                        title="Remove holiday"
                        style={{
                          position: 'absolute',
                          top: 4,
                          right: 5,
                          background: '#fef2f2',
                          border: '1px solid #fecaca',
                          borderRadius: '50%',
                          width: 18,
                          height: 18,
                          fontSize: 11,
                          color: '#dc2626',
                          cursor: 'pointer',
                          lineHeight: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          padding: 0,
                        }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </CCardBody>
      </CCard>

      {/* Add Holiday Modal */}
      <CModal visible={Boolean(addDate)} onClose={() => setAddDate(null)} size="sm">
        <CModalHeader>
          <CModalTitle>Add Holiday</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <div className="text-body-secondary small mb-2">
            {addDate && (
              <>
                {new Date(addDate + 'T00:00:00').toLocaleDateString('en-IN', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </>
            )}
          </div>
          {addError && (
            <CAlert color="danger" className="py-1 small mb-2">
              {addError}
            </CAlert>
          )}
          <CFormInput
            placeholder="Holiday name (e.g. Diwali, Republic Day)"
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddSave()}
            autoFocus
          />
          <div className="small text-body-secondary mt-2">
            Employees marked Absent on this date will be updated to Holiday (no deduction).
          </div>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" size="sm" onClick={() => setAddDate(null)}>
            Cancel
          </CButton>
          <CButton color="primary" size="sm" onClick={handleAddSave}>
            Save Holiday
          </CButton>
        </CModalFooter>
      </CModal>
    </>
  )
}

export default GeneralCalendar
