import React, { useMemo } from 'react'

const LEAVE_TYPE_BG = {
  SL: '#f8d7da',
  CL: '#cff4fc',
  OD: '#d1e7dd',
  COFF: '#fff3cd',
}

const STATUS_BG = {
  Present: '#d1e7dd',
  Absent: '#f8d7da',
  'Half Day': '#ffe5b4',
  'On Leave': '#e2d9f3',
  Holiday: '#e9ecef',
  'Weekly Off': '#e9ecef',
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const pad = (n) => String(n).padStart(2, '0')

const getCellStyle = (rec, isSelected) => {
  if (isSelected) return { background: 'var(--cui-primary)', color: '#fff', cursor: 'crosshair' }
  if (!rec) return { background: '#f8f9fa', cursor: 'default' }
  if (rec.status === 'On Leave' && rec.leave_type) {
    return { background: LEAVE_TYPE_BG[rec.leave_type] || '#e2d9f3', cursor: 'crosshair' }
  }
  return { background: STATUS_BG[rec.status] || '#fff', cursor: 'crosshair' }
}

const MonthCalendar = ({
  year,
  month,
  records,
  selectedDates,
  onDragStart,
  onDragEnter,
  onDragEnd,
}) => {
  const { weeks, recordMap } = useMemo(() => {
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
    const rMap = {}
    for (const rec of records) {
      rMap[rec.date] = rec
    }
    return { weeks: ws, recordMap: rMap }
  }, [year, month, records])

  return (
    <div style={{ userSelect: 'none' }} onMouseLeave={onDragEnd}>
      <div style={{ display: 'flex' }}>
        {DAY_LABELS.map((label) => (
          <div
            key={label}
            style={{
              width: '14.28%',
              textAlign: 'center',
              fontWeight: 600,
              padding: '4px 0',
              fontSize: 12,
              borderBottom: '2px solid #dee2e6',
            }}
          >
            {label}
          </div>
        ))}
      </div>

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
                    background: '#f8f9fa',
                  }}
                />
              )
            }
            const dateStr = `${year}-${pad(month)}-${pad(dayNum)}`
            const rec = recordMap[dateStr]
            const isSelected = selectedDates.has(dateStr)
            const cellStyle = getCellStyle(rec, isSelected)
            const statusLabel =
              rec?.status === 'On Leave' && rec?.leave_type ? rec.leave_type : rec?.status

            return (
              <div
                key={di}
                style={{
                  width: '14.28%',
                  minHeight: 64,
                  border: '1px solid #dee2e6',
                  padding: 4,
                  ...cellStyle,
                }}
                onMouseDown={() => onDragStart(dateStr)}
                onMouseEnter={() => onDragEnter(dateStr)}
                onMouseUp={onDragEnd}
              >
                <div style={{ fontWeight: 600, fontSize: 13 }}>{dayNum}</div>
                {statusLabel && (
                  <div style={{ fontSize: 10, marginTop: 2, opacity: isSelected ? 0.9 : 0.7 }}>
                    {statusLabel}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

export default MonthCalendar
