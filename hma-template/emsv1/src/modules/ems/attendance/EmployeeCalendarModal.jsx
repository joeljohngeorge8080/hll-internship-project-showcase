import React, { useEffect, useMemo, useState } from 'react'
import {
  CButton,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CSpinner,
} from '@coreui/react'

import { localAttendance } from '../../../services/localAttendance'
import { localHolidays } from '../../../services/localHolidays'

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

const STATUS_BG = {
  Present: '#d1e7dd',
  Absent: '#f8d7da',
  'Half Day': '#ffe5b4',
  'On Leave': '#e2d9f3',
  Holiday: '#e9ecef',
  'Weekly Off': '#e9ecef',
}
const LEAVE_TYPE_BG = {
  SL: '#f8d7da',
  CL: '#cff4fc',
  OD: '#d1e7dd',
  COFF: '#fff3cd',
}
const HOLIDAY_DEFAULT_BG = '#e9ecef'
const HOLIDAY_CUSTOM_BG = '#fff3cd'

const LEGEND = [
  { label: 'Present', bg: '#d1e7dd' },
  { label: 'Absent', bg: '#f8d7da' },
  { label: 'Half Day', bg: '#ffe5b4' },
  { label: 'Leave (SL/CL/OD/COFF)', bg: '#cff4fc' },
  { label: 'Sunday / 2nd-4th Sat', bg: '#e9ecef' },
  { label: 'Custom Holiday', bg: '#fff3cd' },
]

const getCellBg = (rec, holiday) => {
  if (rec) {
    if (rec.status === 'On Leave' && rec.leave_type) {
      return LEAVE_TYPE_BG[rec.leave_type] || '#e2d9f3'
    }
    return STATUS_BG[rec.status] || '#fff'
  }
  if (holiday) {
    return holiday.type === 'custom' ? HOLIDAY_CUSTOM_BG : HOLIDAY_DEFAULT_BG
  }
  return '#fff'
}

const getCellLabel = (rec, holiday) => {
  if (rec) {
    const s = rec.status === 'On Leave' && rec.leave_type ? rec.leave_type : rec.status
    return s
  }
  return holiday ? holiday.name : null
}

const EmployeeCalendarModal = ({ visible, onClose, employeeId, year, month }) => {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!visible || !employeeId) {
        if (!cancelled) setRecords([])
        return
      }
      if (!cancelled) setLoading(true)
      try {
        const result = await localAttendance.listRecords({ employeeId, year, month, pageSize: 100 })
        if (!cancelled) setRecords(result.items)
      } catch {
        if (!cancelled) setRecords([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [visible, employeeId, year, month])

  const [holidayMap, setHolidayMap] = useState({})
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!visible) {
        if (!cancelled) setHolidayMap({})
        return
      }
      const map = await localHolidays.getMonthMap(year, month)
      if (!cancelled) setHolidayMap(map)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [visible, year, month])

  const recordMap = useMemo(() => {
    const m = {}
    for (const r of records) m[r.date] = r
    return m
  }, [records])

  const { weeks } = useMemo(() => {
    const daysInMonth = new Date(year, month, 0).getDate()
    const firstDow = new Date(year, month - 1, 1).getDay()
    const startOffset = (firstDow + 6) % 7
    const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7
    const cells = []
    for (let i = 0; i < totalCells; i++) {
      const dayNum = i - startOffset + 1
      cells.push(dayNum >= 1 && dayNum <= daysInMonth ? dayNum : null)
    }
    const ws = []
    for (let r = 0; r < cells.length / 7; r++) {
      ws.push(cells.slice(r * 7, r * 7 + 7))
    }
    return { weeks: ws }
  }, [year, month])

  return (
    <CModal visible={visible} onClose={onClose} size="xl" backdrop="static">
      <CModalHeader>
        <CModalTitle>
          {employeeId} — {MONTHS[month - 1]} {year}
        </CModalTitle>
      </CModalHeader>
      <CModalBody>
        {loading ? (
          <div className="text-center py-4">
            <CSpinner color="primary" />
          </div>
        ) : (
          <>
            {/* Legend */}
            <div className="d-flex gap-3 mb-3 flex-wrap align-items-center">
              {LEGEND.map((item) => (
                <div key={item.label} className="d-flex align-items-center gap-1">
                  <div
                    style={{
                      width: 12,
                      height: 12,
                      background: item.bg,
                      border: '1px solid #dee2e6',
                      borderRadius: 2,
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: 11 }}>{item.label}</span>
                </div>
              ))}
            </div>

            {/* Day header */}
            <div style={{ display: 'flex', marginBottom: 2 }}>
              {DAY_LABELS.map((label) => (
                <div
                  key={label}
                  style={{
                    width: '14.28%',
                    textAlign: 'center',
                    fontWeight: 600,
                    fontSize: 12,
                    padding: '4px 0',
                    borderBottom: '2px solid #dee2e6',
                  }}
                >
                  {label}
                </div>
              ))}
            </div>

            {/* Weeks */}
            {weeks.map((week, wi) => (
              <div key={wi} style={{ display: 'flex' }}>
                {week.map((dayNum, di) => {
                  if (!dayNum) {
                    return (
                      <div
                        key={di}
                        style={{
                          width: '14.28%',
                          minHeight: 64,
                          border: '1px solid #dee2e6',
                          background: '#fafafa',
                        }}
                      />
                    )
                  }
                  const dateStr = `${year}-${pad(month)}-${pad(dayNum)}`
                  const rec = recordMap[dateStr]
                  const holiday = holidayMap[dateStr]
                  const bg = getCellBg(rec, holiday)
                  const label = getCellLabel(rec, holiday)
                  // Show holiday annotation below status when the record has a different status
                  const showHolidayNote =
                    holiday && rec && rec.status !== 'Holiday' && rec.status !== 'Weekly Off'

                  return (
                    <div
                      key={di}
                      style={{
                        width: '14.28%',
                        minHeight: 64,
                        border: '1px solid #dee2e6',
                        padding: '4px 6px',
                        background: bg,
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{dayNum}</div>
                      {label && (
                        <div style={{ fontSize: 10, marginTop: 2, opacity: 0.8, lineHeight: 1.3 }}>
                          {label}
                        </div>
                      )}
                      {showHolidayNote && (
                        <div
                          style={{ fontSize: 9, marginTop: 1, color: '#856404', lineHeight: 1.3 }}
                        >
                          {holiday.name}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}

            {records.length === 0 && (
              <p className="text-body-secondary small mt-3 mb-0">
                No attendance records for this month yet. General holidays are shown based on the
                company calendar.
              </p>
            )}
          </>
        )}
      </CModalBody>
      <CModalFooter>
        <CButton color="secondary" onClick={onClose}>
          Close
        </CButton>
      </CModalFooter>
    </CModal>
  )
}

export default EmployeeCalendarModal
